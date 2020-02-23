/**
 * @license
 * Copyright (c) 2020 CANDY LINE INC.
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

import 'source-map-support/register';

import cproc from 'child_process';
import RED from 'node-red';
import { DefaultDeviceIdResolver } from './device-id-resolver';

export class DefaultDeviceState {
  static flowsToString(flows, content = null) {
    if (typeof flows === 'string') {
      return flows;
    }
    if (RED.settings.flowFilePretty) {
      return JSON.stringify(flows, null, 4);
    } else if (!content) {
      return JSON.stringify(flows);
    } else {
      return content;
    }
  }

  constructor() {
    this.candyBoardServiceSupported = false;
    this.resolver = new DefaultDeviceIdResolver();
  }

  async init() {
    if (!this.deviceId) {
      this.deviceId = await this.resolver.resolve();
    }
  }

  _candyRun(cat, act, maxRetry, notJson, ...args) {
    return new Promise((resolve, reject) => {
      if (!this.candyBoardServiceSupported) {
        return reject({ code: -1, message: 'CANDY Board Service is missing' });
      }
      maxRetry = maxRetry || 0;
      if (!args) {
        args = [];
      }
      args.unshift(cat, act);

      let retry = 0;
      let runCandyCmd = () => {
        let candy = cproc.spawn('candy', args, { timeout: 1000 });
        let output = '';
        candy.stdout.on('data', data => {
          output += data.toString();
        });
        candy.stderr.on('data', data => {
          output += data.toString();
        });
        candy.on('close', code => {
          output = output.replace(
            /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGK]/g, // eslint-disable-line no-control-regex
            ''
          );
          if (code) {
            RED.log.debug(`[CANDY RED] code: ${code}, output: ${output}`);
            return reject({ code: code, output: output });
          }
          let ret = '';
          if (notJson) {
            ret = (output || '').trim();
          } else {
            try {
              ret = JSON.parse(output);
            } catch (e) {
              RED.log.error(`[CANDY RED] ** JSON Parse Error => ${ret}`);
              RED.log.info(`[CANDY RED] ${e.stack}`);
            }
          }
          return resolve({ code: code, output: ret });
        });
        candy.on('error', err => {
          ++retry;
          if (retry > maxRetry) {
            return reject(err);
          } else {
            setTimeout(runCandyCmd, 10000);
          }
        });
      };
      setTimeout(runCandyCmd, 0);
    });
  }

  async testIfCANDYBoardServiceInstalled(service) {
    await this.init();
    const candyBoardServiceSupported = await new Promise(resolve => {
      let systemctl = cproc.spawn('systemctl', ['is-enabled', service], {
        timeout: 1000
      });
      systemctl.on('close', code => {
        let candyBoardServiceSupported = code === 0;
        resolve(candyBoardServiceSupported);
      });
      systemctl.on('error', () => {
        resolve(false);
      });
    });
    this.candyBoardServiceSupported = candyBoardServiceSupported;
    return this.deviceId;
  }

  async initWithFlowFilePath() {
    await this.init();
  }
}
