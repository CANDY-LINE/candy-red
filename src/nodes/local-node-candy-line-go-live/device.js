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

const debug = debugLogger('candy-red-lwm2m:device');

module.exports = function(RED) {
  class CANDYLINEGoLiveDeviceInquryNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.copyProps = {};
      for (const p of [
        'copyClientAlias',
        'copyClientName',
        'copyModuleIdentifier',
        'copyMsisdn',
        'copyImsi',
        'copyClientVersion',
        'copyMaxNumberOfPeripherals',
        'copyPeripheralRegistrationMethod',
        'copyPeripheralCount'
    ]) {
        if (n[p]) {
          const first = p.substring(4, 5).toLowerCase();
          const sourceProp = `${first}${p.substring(5)}`;
          const destProp = n[`${p}Prop`];
          debug(`sourceProp: ${sourceProp}, destProp: ${destProp}`);
          this.copyProps[sourceProp] = destProp || sourceProp;
        }
      }
      if (
        RED.settings.lwm2m &&
        typeof RED.settings.lwm2m.findDeviceInfo === 'function'
      ) {
        this.init();
      } else {
        this.on('input', (msg, send, done) => {
          this.warn(RED._('device.errors.unsupported'));
          done(new Error(RED._('device.errors.unsupported')));
        });
        setTimeout(() => {
          this.warn(RED._('device.errors.unsupported'));
        }, 1000);
      }
    }

    init() {
      this.on('close', done => {
        done();
      });
      this.on('input', async (msg, send, done) => {
        try {
          debug(`[input] msg => ${JSON.stringify(msg)}`);
          msg = await this.findDeviceInfo(msg);
          send(msg);
          done();
        } catch (err) {
          done(err);
        }
      });
      debug(`CANDYLINEGoLiveDeviceInquryNode has been initialized`);
    }

    async findDeviceInfo(msg) {
      let { payload } = msg;
      if (!payload) {
        payload = {};
      }
      if (typeof payload !== 'object') {
        throw new Error(RED._(`device.errors.payloadIsNotObject`));
      }
      const resultDevice = await RED.settings.lwm2m.findDeviceInfo();
      const sourceProps = Object.keys(this.copyProps);
      if (sourceProps.length < 1) {
        throw new Error(RED._(`device.errors.nothingToCopy`));
      }
      sourceProps.forEach(sourceProp => {
        const destProp = this.copyProps[sourceProp];
        if (typeof resultDevice[sourceProp] !== 'undefined') {
          payload[destProp] = resultDevice[sourceProp];
        }
      });
      msg.payload = payload;
      return msg;
    }
  }
  RED.nodes.registerType('Go-Live-device', CANDYLINEGoLiveDeviceInquryNode);
};
