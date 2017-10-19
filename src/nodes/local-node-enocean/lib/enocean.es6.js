'use strict';

/*
 * EnOcean Module
 */

import setUpEnocean from 'node-enocean';
import { ESP3RadioERP2Parser, ERP2Parser } from './esp3_erp2_parser';
import Promise from 'es6-promises';
import fs from 'fs';

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
              port.emit('learn', ctx);
            }
          }).catch(e => {
            enOceanPortNode.error(that.RED._('enocean.errors.parseError', { error: e, data: JSON.stringify(ctx) }));
          });
        }).catch(e => {
          enOceanPortNode.error(that.RED._('enocean.errors.parseError', { error: e, data: result.payload }));
        });
      }).catch(e => {
        if (e instanceof Error && e.message === 'enocean.info.unsupportedPacketType') {
          enOceanPortNode.info(that.RED._('enocean.info.unsupportedPacketType', { packetType: e.packetType }));
        } else {
          enOceanPortNode.error(that.RED._('enocean.errors.parseError', { error: e, data: JSON.stringify(data) }));
        }
      });
    });
    port.on('error', e => {
      enOceanPortNode.warn(that.RED._('enocean.errors.serialPortError',{ error: e }));
      delete that.pool[portName];
    });
    port.on('close', () => {
      enOceanPortNode.info(that.RED._('enocean.info.serialPortClosed',{ portName: portName }));
      delete that.pool[portName];
    });
    that.pool[portName] = {
      node: enOceanPortNode,
      port: port
    };
    enOceanPortNode.info(that.RED._('enocean.info.serialPortAdded',{ portName: portName }));
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
