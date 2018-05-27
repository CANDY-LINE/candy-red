/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/*
 * EnOcean Module
 */

import SerialPort from 'serialport';
import pareseESP3 from 'serialport-enocean-parser';
import { ESP3RadioERP2Parser, ERP2Parser } from './esp3_erp2_parser';
import fs from 'fs';

const ESP3_PACKET_PARSERS = {
  10: new ESP3RadioERP2Parser() // Packet Type 10: RADIO_ERP2
};

class ESP3PacketParser {
  constructor(RED) {
    this.RED = RED;
  }

  parse(packet) {
    return new Promise((resolve, reject) => {
      let esp3PacketParser = ESP3_PACKET_PARSERS[packet.header.packetType];
      if (esp3PacketParser) {
        resolve({
          parser: esp3PacketParser,
          payload: packet.getRawBuffer()
        });
      } else {
        let e = new Error('enocean.warn.unsupportedPacketType');
        e.packetType = packet.header.packetType;
        reject(e);
      }
    });
  }
}

export class SerialPool {
  constructor(RED) {
    this.pool = {};
    this.esp3PacketParser = new ESP3PacketParser(RED);
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
    let port = new SerialPort(portName, { baudRate: 57600 });
    port.on('open', () => {
      port.emit('ready');
    });
    port.on('data', buffer => {
      return new Promise((resolve) => {
        pareseESP3({
          emit(_, out) {
            return resolve(out);
          }
        }, buffer);
      }).then((data) => {
        return that.esp3PacketParser.parse(data).then(result => {
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
        });
      }).catch(e => {
        if (e instanceof Error && e.message === 'enocean.warn.unsupportedPacketType') {
          if (enOceanPortNode.showEnOceanWarning) {
            enOceanPortNode.warn(that.RED._('enocean.warn.unsupportedPacketType', { packetType: e.packetType }));
          }
        } else {
          enOceanPortNode.error(that.RED._('enocean.errors.parseError', { error: e, data: JSON.stringify(buffer) }));
        }
      });
    });
    port.on('error', e => {
      enOceanPortNode.warn(that.RED._('enocean.errors.serialPortError',{ error: e }));
      delete that.pool[portName];
    });
    port.on('disconnect', () => {
      enOceanPortNode.debug(that.RED._('enocean.debug.serialPortDisconnected',{ portName: portName }));
      delete that.pool[portName];
    });
    port.on('close', () => {
      enOceanPortNode.debug(that.RED._('enocean.debug.serialPortClosed',{ portName: portName }));
      delete that.pool[portName];
    });
    that.pool[portName] = {
      node: enOceanPortNode,
      port: port
    };
    enOceanPortNode.debug(that.RED._('enocean.debug.serialPortAdded',{ portName: portName }));
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
