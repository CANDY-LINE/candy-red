'use strict';

/*
 * EnOcean Module
 */

import setUpEnocean from 'node-enocean';
import { ESP3RadioERP2Parser, ERP2Parser } from './esp3_erp2_parser';
import Promise from 'es6-promises';
import fs from 'fs';
import LRU from 'lru-cache';

let unknown = LRU({
  max: 100,
  maxAge: 1000 * 60 * 60
});

const ESP3_PACKET_PARSERS = {
  10: new ESP3RadioERP2Parser() // Packet Type 10: RADIO_ERP2
};

class ESP3Parser {
  constructor(RED) {
    this.RED = RED;
  }

  parse(data) {
    return new Promise((resolve, reject) => {
      let esp3PacketParser = ESP3_PACKET_PARSERS[data.packetType];
      if (esp3PacketParser) {
        resolve({
          parser: esp3PacketParser,
          payload: data.rawByte
        });
      } else {
        let e = new Error('enocean.errors.unsupportedPacketType');
        e.packetType = data.packetType;
        reject(e);
      }
    });
  }
}

export class SerialPool {
  constructor(RED) {
    this.pool = {};
    this.esp3Parser = new ESP3Parser(RED);
    this.erp2Parser = new ERP2Parser();
    this.RED = RED;
  }

  add(enOceanPortNode) {
    let that = this;
    let portName = enOceanPortNode.serialPort;
    if (!portName) {
      throw new Error('serialPort property is missing!');
    }
    if (!fs.existsSync(portName)) {
      throw new Error(`The port [${portName}] is NOT ready!`);
    }
    if (that.pool[portName]) {
      throw new Error(`The serial port [${portName}] is duplicate!`);
    }
    let port = setUpEnocean();
    port.listen(portName);
    port.on('data', data => {
      that.esp3Parser.parse(data).then(result => {
        result.parser.parse(result.payload).then(ctx => {
          that.erp2Parser.parse(ctx).then(ctx => {
            let originatorIdInt = ctx.originatorIdInt;
            if (!port.emit(`ctx-${originatorIdInt}`, ctx)) {
              that.RED.log.warn(that.RED._('enocean.warn.noNode', { originatorId: ctx.originatorId }));
              port.emit('learn', ctx);
            }
          }).catch(e => {
            that.RED.log.error(that.RED._('enocean.errors.parseError', { error: e, data: JSON.stringify(ctx) }));
          });
        }).catch(e => {
          that.RED.log.error(that.RED._('enocean.errors.parseError', { error: e, data: result.payload }));
        });
      }).catch(e => {
        if (e instanceof Error && e.message === 'enocean.info.unsupportedPacketType') {
          that.RED.log.info(that.RED._('enocean.info.unsupportedPacketType', { packetType: e.packetType }));
        } else {
          that.RED.log.error(that.RED._('enocean.errors.parseError', { error: e, data: JSON.stringify(data) }));
        }
      });
    });
    port.on('error', e => {
      that.RED.log.warn(that.RED._('enocean.errors.serialPortError',{ error: e }));
      delete that.pool[portName];
    });
    port.on('close', () => {
      that.RED.log.info(that.RED._('enocean.info.serialPortClosed',{ portName: portName }));
      delete that.pool[portName];
    });
    that.pool[portName] = {
      node: enOceanPortNode,
      port: port
    };
    that.RED.log.info(that.RED._('enocean.info.serialPortAdded',{ portName: portName }));
  }

  get(portName) {
    let that = this;
    let enocean = that.pool[portName];
    if (!enocean) {
      throw new Error(`The given port ${portName} is missing!`);
    }
    return enocean;
  }

  close(portName) {
    let that = this;
    let enocean = that.pool[portName];
    return new Promise(resolve => {
      if (enocean) {
        delete that.pool[portName];
        enocean.port.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
