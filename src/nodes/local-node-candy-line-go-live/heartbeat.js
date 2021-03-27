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

const debug = debugLogger('candy-red-lwm2m:heartbeat');

module.exports = function(RED) {
  class CANDYLINEGoLivePeripheralHeartbetNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      if (
        RED.settings.lwm2m &&
        typeof RED.settings.lwm2m.reportPeripheralStatus === 'function'
      ) {
        this.filterIgnoredMessages = n.filterIgnoredMessages;
        this.init();
      } else {
        this.warn(
          `ANDY LINE Go Live Client Module is missing. Ignore all reporting messages.`
        );
        this.on('input', async (msg, send, done) => {
          msg.error = `CANDY LINE Go Live Client Module is missing.`;
          send(this.filterIgnoredMessages ? [null, msg] : msg);
          done();
        });
      }
    }

    init() {
      this.status({});
      this.on('close', done => {
        this.status({});
        done();
      });
      this.on('input', async (msg, send, done) => {
        this.status({
          fill: 'red',
          shape: 'ring',
          text: `heartbeat.status.received`
        });
        try {
          debug(`[input] msg => ${JSON.stringify(msg)}`);
          const result = await RED.settings.lwm2m.reportPeripheralStatus(
            msg.payload
          );
          Object.assign(msg, result);
          if (!msg.error) {
            send(this.filterIgnoredMessages ? [msg, null] : msg);
          } else {
            send(this.filterIgnoredMessages ? [null, msg] : msg);
          }
          done();
        } catch (err) {
          done(err);
        } finally {
          setTimeout(() => {
            this.status({});
          }, 1300);
        }
      });
      debug(`CANDYLINEGoLivePeripheralHeartbetNode has been initialized`);
    }
  }
  RED.nodes.registerType('heartbeat', CANDYLINEGoLivePeripheralHeartbetNode);
};
