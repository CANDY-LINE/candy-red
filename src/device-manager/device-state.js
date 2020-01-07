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
import cproc from 'child_process';
import crypto from 'crypto';
import * as chokidar from 'chokidar';
import RED from 'node-red';
import { DefaultDeviceIdResolver } from './device-id-resolver';

export class DeviceState {
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

  constructor(onFlowFileChanged, onFlowFileRemoved) {
    this.candyBoardServiceSupported = false;
    this.flowFileSignature = '';
    this.flowFilePath = '';
    this.resolver = new DefaultDeviceIdResolver();
    this.wartcher = null;
    this.onFlowFileChanged = onFlowFileChanged;
    this.onFlowFileRemoved = onFlowFileRemoved;
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
        candy.on('close', code => {
          output = output.replace(
            /\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGK]/g, // eslint-disable-line no-control-regex
            ''
          );
          if (code) {
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
    // DEBUG USE ONLY
    if (
      process.env.DEVICE_MANAGEMENT_ENABLED === 'true' &&
      process.env.DEVEL === 'true' &&
      !candyBoardServiceSupported
    ) {
      this.candyBoardServiceSupported = true;
    } else {
      this.candyBoardServiceSupported = candyBoardServiceSupported;
    }
    return Promise.resolve([this.deviceId]);
  }

  loadAndSetFlowSignature() {
    return new Promise((resolve, reject) => {
      fs.readFile(this.flowFilePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(this.setFlowSignature(data));
      });
    });
  }

  setFlowSignature(data) {
    let flows;
    if (typeof data === 'string') {
      flows = JSON.parse(data);
    } else {
      flows = data;
    }
    data = JSON.stringify(flows);
    let current = this.flowFileSignature;
    let sha1 = crypto.createHash('sha1');
    sha1.update(data);
    this.flowFileSignature = sha1.digest('hex');
    // true for modified
    return current !== this.flowFileSignature;
  }

  updateFlow(flows) {
    return new Promise((resolve, reject) => {
      let content;
      if (typeof flows === 'string') {
        content = flows;
        try {
          flows = JSON.parse(content);
        } catch (err) {
          return reject(err);
        }
      }
      if (!Array.isArray(flows)) {
        flows = [flows];
        if (!content) {
          content = null;
        }
      }
      content = DeviceState.flowsToString(flows, content);
      this._unwatchFlowFilePath();
      fs.writeFile(this.flowFilePath, content, err => {
        this._watchFlowFilePath();
        if (err) {
          return reject(err);
        }
        this.setFlowSignature(flows);
        return resolve(content);
      });
    });
  }

  _unwatchFlowFilePath() {
    if (!this.watcher || !this.flowFileSignature) {
      return;
    }
    this.watcher.close();
  }

  _watchFlowFilePath() {
    if (this.watcher || !this.flowFileSignature) {
      return;
    }
    this.watcher = chokidar.watch(this.flowFilePath);
    this.watcher.on('change', this.onFlowFileChanged);
    this.watcher.on('unlink', this.onFlowFileRemoved);
  }

  async initWithFlowFilePath(flowFilePath) {
    await this.init();
    if (flowFilePath && this.flowFilePath !== flowFilePath) {
      this.flowFilePath = flowFilePath;
      if (this.watcher) {
        this.watcher.close();
      }
      this.watcher = null;
    } else {
      flowFilePath = this.flowFilePath;
    }
    await new Promise((resolve, reject) => {
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          return resolve(true);
        }
        let flows;
        data = String(data);
        if (!data || !data.trim()) {
          data = '[]';
        }
        try {
          flows = JSON.parse(data);
        } catch (e) {
          RED.log.error(
            `[CANDY RED] Wrong JSON format => ${flowFilePath}. Correct the error or remove it`
          );
          return reject(e);
        }
        this.setFlowSignature(data);
        RED.log.info(
          `[CANDY RED] flowFileSignature: ${this.flowFileSignature}`
        );
        if (!Array.isArray(flows)) {
          return resolve(true);
        }
        resolve();
      });
    });
    return new Promise((resolve, reject) => {
      try {
        this._watchFlowFilePath();
        return resolve();
      } catch (err) {
        return reject(err);
      }
    });
  }
}
