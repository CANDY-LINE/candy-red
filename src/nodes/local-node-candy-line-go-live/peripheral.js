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
      if (
        RED.settings.lwm2m &&
        typeof RED.settings.lwm2m.findPeripheralInfo === 'function' &&
        typeof RED.settings.lwm2m.countPeripheralInfo === 'function'
      ) {
        this.init();
      } else {
        this.on('input', (msg, send, done) => {
          this.warn(RED._('peripheral.errors.unsupported'));
          msg.error = RED._('peripheral.errors.unsupported');
          send(msg);
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
        clearTimeout(this.peripheracCounter);
        this.peripheracCounter = null;
        done();
      });
      this.on('input', async (msg, send, done) => {
        try {
          debug(`[input] msg => ${JSON.stringify(msg)}`);
          const result = await RED.settings.lwm2m.findPeripheralInfo(msg.topic);
          Object.assign(msg, result);
          send(msg);
          done();
        } catch (err) {
          done(err);
        }
      });
      this.schedulePeripheralCount();
      debug(`CANDYLINEGoLivePeripheralInquryNode has been initialized`);
    }

    schedulePeripheralCount(intervalMs = 1000) {
      this.peripheracCounter = setTimeout(async () => {
        if (this.peripheracCounter === null) {
          debug(`peripheracCounter has been stopped.`);
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
      debug(`peripheracCounter has been scheduled.`);
    }
  }
  RED.nodes.registerType(
    'Go-Live-peripheral',
    CANDYLINEGoLivePeripheralInquryNode
  );
};
