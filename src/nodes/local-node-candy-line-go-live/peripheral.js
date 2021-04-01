/**
 * @license
 * Copyright (c) 2021 CANDY LINE INC.
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

import 'source-map-support/register';
import debugLogger from 'debug';

const debug = debugLogger('candy-red-lwm2m:peripheral');
const PERIPHERAL_COUNTER_INTERVAL_MS = 60 * 1000;

module.exports = function(RED) {
  class CANDYLINEGoLivePeripheralInquryNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.finderMethod = n.finderMethod;
      this.copyProps = {};
      if (this.finderMethod === 'payload') {
        this.finderProp = n.finderProp || 'networkAddress';
        for (const p of [
          'copyAlias',
          'copyLastReportedAt',
          'copyReportCount',
          'copyErrorCount',
          'copyLastErrorInfo',
          'copyBatteryPower',
          'copySignalStrength',
          'copyStatsStartedAt'
        ]) {
          if (n[p]) {
            const first = p.substring(4, 5).toLowerCase();
            const sourceProp = `${first}${p.substring(5)}`;
            const destProp = n[`${p}Prop`];
            debug(`sourceProp: ${sourceProp}, destProp: ${destProp}`);
            this.copyProps[sourceProp] = destProp || sourceProp;
          }
        }
      }
      if (
        RED.settings.lwm2m &&
        typeof RED.settings.lwm2m.findPeripheralInfo === 'function' &&
        typeof RED.settings.lwm2m.countPeripheralInfo === 'function'
      ) {
        this.init();
      } else {
        this.on('input', (msg, send, done) => {
          this.warn(RED._('peripheral.errors.unsupported'));
          done(new Error(RED._('peripheral.errors.unsupported')));
          done();
        });
        setTimeout(() => {
          this.warn(RED._('peripheral.errors.unsupported'));
        }, 1000);
      }
    }

    init() {
      this.status({});
      this.on('close', done => {
        this.status({});
        clearTimeout(this.peripheralCounter);
        this.peripheralCounter = null;
        done();
      });
      this.on('input', async (msg, send, done) => {
        try {
          debug(
            `[input] method => ${this.finderMethod}, msg => ${JSON.stringify(
              msg
            )}`
          );
          switch (this.finderMethod) {
            default:
            case 'topic': {
              msg = await this.findByTopic(msg);
              break;
            }
            case 'payload': {
              msg = await this.findByPayload(msg);
              break;
            }
          }
          send(msg);
          done();
        } catch (err) {
          done(err);
        }
      });
      this.schedulePeripheralCount();
      debug(`CANDYLINEGoLivePeripheralInquryNode has been initialized`);
    }

    async findByTopic(msg) {
      let networkAddressQuery = msg.topic;
      if (networkAddressQuery) {
        networkAddressQuery = networkAddressQuery.trim();
        if (networkAddressQuery.indexOf(',') >= 0) {
          networkAddressQuery = networkAddressQuery
            .split(',')
            .map(a => a.trim())
            .filter(a => a);
        }
        if (networkAddressQuery.length === 0) {
          networkAddressQuery = null;
        }
      }
      debug(`networkAddressQuery => ${JSON.stringify(networkAddressQuery)}`);
      const result = await RED.settings.lwm2m.findPeripheralInfo(
        networkAddressQuery
      );
      msg.payload = result;
      return msg;
    }

    async findByPayload(msg) {
      const { payload } = msg;
      if (!payload) {
        throw new Error(RED._(`peripheral.errors.payloadMissing`));
      }
      if (typeof payload !== 'object') {
        throw new Error(RED._(`peripheral.errors.payloadIsNotObject`));
      }
      const networkAddress = payload[this.finderProp];
      if (!networkAddress) {
        throw new Error(RED._(`peripheral.errors.unknown`, { networkAddress }));
      }
      const result = await RED.settings.lwm2m.findPeripheralInfo([
        networkAddress
      ]);
      if (result.length !== 1) {
        throw new Error(RED._(`peripheral.errors.unknown`, { networkAddress }));
      }
      const resultPeripheral = result[0];
      const sourceProps = Object.keys(this.copyProps);
      if (sourceProps.length < 1) {
        throw new Error(RED._(`peripheral.errors.nothingToCopy`));
      }
      sourceProps.forEach(sourceProp => {
        const destProp = this.copyProps[sourceProp];
        payload[destProp] = resultPeripheral[sourceProp];
      });
      return msg;
    }

    schedulePeripheralCount(intervalMs = 1000) {
      this.peripheralCounter = setTimeout(async () => {
        if (this.peripheralCounter === null) {
          debug(`peripheralCounter has been stopped.`);
          return;
        }
        const count = await RED.settings.lwm2m.countPeripheralInfo();
        this.status({
          fill: 'green',
          shape: 'dot',
          text: RED._(`peripheral.status.info`, { count })
        });
        this.schedulePeripheralCount(PERIPHERAL_COUNTER_INTERVAL_MS);
      }, intervalMs);
      debug(`peripheralCounter has been scheduled.`);
    }
  }
  RED.nodes.registerType(
    'Go-Live-peripheral',
    CANDYLINEGoLivePeripheralInquryNode
  );
};
