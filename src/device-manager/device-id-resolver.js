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
import fs from 'fs';
import si from 'systeminformation';
import readline from 'readline';
import consts from './consts';
import RED from 'node-red';

export class DefaultDeviceIdResolver {
  constructor() {
    this.hearbeatIntervalMs = -1;
    this.candyBoardServiceSupported = false;
  }

  resolve() {
    return new Promise((resolve, reject) => {
      return this._resolveLinux(resolve, reject);
    });
  }

  _resolveLinux(resolve, reject) {
    fs.stat(consts.PROC_DT_MODEL_PATH, async err => {
      if (err) {
        return await this._resolveGnenericSerialNumber(resolve, reject);
      }
      fs.stat(consts.PROC_CPUINFO_PATH, async err => {
        if (err) {
          return await this._resolveGnenericSerialNumber(resolve, reject);
        }
        let reader = readline.createInterface({
          terminal: false,
          input: fs.createReadStream(consts.PROC_CPUINFO_PATH)
        });
        let id = '';
        reader.on('line', line => {
          if (line.indexOf('Serial') >= 0 && line.indexOf(':') >= 0) {
            id = line.split(':')[1].trim();
          }
        });
        reader.on('close', async err => {
          if (err || !id) {
            return await this._resolveGnenericSerialNumber(resolve, reject);
          }
          let model = fs
            .readFileSync(consts.PROC_DT_MODEL_PATH)
            .toString()
            .replace(/\0/g, '')
            .trim();
          if (model.match('Raspberry Pi')) {
            return resolve('RPi:' + id);
          } else if (model === 'Tinker Board') {
            return resolve('ATB:' + id);
          } else {
            RED.log.warn(`[CANDY RED] Unknown Linux Device Model: [${model}]`);
            return resolve('DEV:' + id);
          }
        });
      });
    });
  }

  async _resolveGnenericSerialNumber(resolve, reject) {
    const { serial, uuid } = await si.system();
    if (serial) {
      return resolve(`serial:${serial}`);
    } else if (uuid) {
      return resolve(`uuid:${uuid}`);
    } else {
      return reject(new Error('No valid identifier!'));
    }
  }
}
