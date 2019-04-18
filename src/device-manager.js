/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
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
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import { EventEmitter } from 'events';
import cproc from 'child_process';
import crypto from 'crypto';
import path from 'path';
import * as chokidar from 'chokidar';
import RED from 'node-red';

const REBOOT_DELAY_MS = 1000;
const TRACE = process.env.DEBUG || false;

const PROC_CPUINFO_PATH = '/proc/cpuinfo';
const PROC_DT_MODEL_PATH = '/proc/device-tree/model';
const MODEM_INFO_FILE_PATH = '/opt/candy-line/candy-pi-lite/__modem_info';

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
    fs.stat(PROC_DT_MODEL_PATH, err => {
      if (err) {
        return this._resolveMAC(resolve, reject);
      }
      fs.stat(PROC_CPUINFO_PATH, err => {
        if (err) {
          return this._resolveMAC(resolve, reject);
        }
        let reader = readline.createInterface({
          terminal: false,
          input: fs.createReadStream(PROC_CPUINFO_PATH)
        });
        let id = '';
        reader.on('line', line => {
          if (line.indexOf('Serial') >= 0 && line.indexOf(':') >= 0) {
            id = line.split(':')[1].trim();
          }
        });
        reader.on('close', err => {
          if (err || !id) {
            return this._resolveMAC(resolve, reject);
          }
          let model = fs.readFileSync(PROC_DT_MODEL_PATH).toString().replace(/\0/g, '').trim();
          if (model.match('Raspberry Pi')) {
            return resolve('RPi:' + id);
          } else if (model === 'Tinker Board') {
            return resolve('ATB:' + id);
          } else {
            RED.log.warn(`Unknown Linux Device Model: [${model}]`);
            return resolve('DEV:' + id);
          }
        });
      });
    });
  }

  _resolveMAC(resolve, reject) {
    let ifs = os.networkInterfaces();
    for (let key in ifs) {
      if (ifs.hasOwnProperty(key)) {
        for (let i in ifs[key]) {
          let mac = ifs[key][i].mac;
          if (mac && mac !== '00:00:00:00:00:00') {
            return resolve('MAC:' + key + ':' + mac.replace(new RegExp(':', 'g'), '-').toLowerCase());
          }
        }
      }
    }
    reject(new Error('No identifier!'));
  }
}

export class DeviceManager {
  constructor(primary, listenerConfig, accountConfig, deviceState) {
    if (!accountConfig) {
      throw new Error('accountConfig is required');
    }
    this.primary = primary;
    this.listenerConfig = listenerConfig;
    this.accountConfig = accountConfig;
    this.deviceState = deviceState;
    this.prefix = '[CANDY RED] {DeviceManager}:[' + accountConfig.accountFqn + '] ';
    this.cmdQueue = [];
    this.events = new EventEmitter();
    this.events.on('opened', () => {
      this._warn('connected');
      this._resume().then(empty => {
        if (!empty) {
          this._warn('flushed queued commands');
        }
      }).catch(err => {
        this._error(err.stack);
      });
    });
    this.events.on('closed', () => {
      this._warn('disconnected');
      this._reset();
    });
    this.events.on('erro', (err1, err2) => {
      if (err2) {
        this._warn('failed to connect' + (err2.status ? ' :' + err2.status : ''));
      } else {
        this._warn('connection error');
      }
      this._reset();
    });
    this.events.on('ping', () => {
      if (this.pingTimeoutTimer) {
        clearTimeout(this.pingTimeoutTimer);
      }
      this.pingTimeoutTimer = setTimeout(() => {
        this._warn(`ping has not come for more than ${this.hearbeatIntervalMs * 1.5 / 1000} seconds`);
        this.listenerConfig.server.close(); // close event will perform _reset() and start a new connection after 3+ seconds
      }, this.hearbeatIntervalMs * 1.5);
    });
    // receiving an incoming message (sent from a source)
    this.events.send = msg => {
      let payload = msg.payload;
      if (payload) {
        try {
          payload = JSON.parse(payload);
        } catch (_) {
        }
      }
      if (TRACE) {
        this._info('Received!:' + JSON.stringify(payload));
      }
      if (!this.enrolled) {
        if (!payload || !payload.status || Math.floor(payload.status / 100) !== 2) {
          // Terminate everything and never retry
          this.listenerConfig.close();
          this._error('Enrollment error!' +
            ' This device is not allowed to access the account:' +
            accountConfig.accountFqn);
          return;
        } else {
          payload = payload.commands;
          this.enrolled = true;
        }
      }
      this._performCommands(payload).then(result => {
        this._sendToServer(result);
      }).catch(result => {
        if (result instanceof Error) {
          let err = result;
          result = {};
          result.status = 500;
          result.message = err.toString();
          result.stack = err.stack;
        } else if (result && !Array.isArray(result)) {
          result = [result];
        }
        this._sendToServer(result);
      }).catch(err => {
        this._error(err.stack);
      });
    };
    this.listenerConfig.registerInputNode(this.events);
    this.listenerConfig.send = payload => {
      if ((typeof(payload) === 'object') && !(payload instanceof Buffer)) {
        payload = JSON.stringify(payload);
      }
      return this.listenerConfig.broadcast(payload);
    };
    this._reset();
  }

  _info(msg) {
    RED.log.info(this.prefix  + msg);
  }
  _warn(msg) {
    RED.log.warn(this.prefix  + msg);
  }
  _error(msg) {
    RED.log.error(this.prefix  + msg);
  }

  _resume() {
    let current = this.cmdQueue;
    if (current.length === 0) {
      return new Promise(resolve => resolve(true));
    }
    this.cmdQueue = [];
    current = current.map(c => {
      return this.publish(c);
    });
    return Promise.all(current);
  }

  _enqueue(commands) {
    if (commands) {
      this.cmdQueue.push(commands);
    }
  }

  _reset() {
    this.cmdIdx = 0;
    this.commands = {};
    this.enrolled = false;
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      delete this.pingTimeoutTimer;
    }
  }

  publish(commands) {
    return this._sendToServer(commands);
  }

  static restart() {
    // systemctl shuould restart the service
    setTimeout(() => {
      process.exit(219);
    }, REBOOT_DELAY_MS);
  }

  _sendToServer(result) {
    return new Promise(resolve => {
      if (!result || Array.isArray(result) && result.length === 0 || Object.keys(result) === 0) {
        // do nothing
        this._info('No commands to respond to');
        return resolve();
      }
      result = this._numberResponseCommands(result);
      let sent = this.listenerConfig.send(result);
      if (TRACE && sent) {
        this._info('Sent!:' + JSON.stringify(result));
      }
      if (!sent) {
        this._info('Enqueue the commands in order to be sent later on');
        this._enqueue(result);
        return resolve();
      }
      if (!Array.isArray(result)) {
        result = [result];
      }
      if (result.reduce((p, c) => {
        return p || (c && c.restart);
      }, false)) {
        this._warn('Restarting this process!!');
        DeviceManager.restart();
      }
      resolve();
    });
  }

  _nextCmdIdx() {
    this.cmdIdx = (this.cmdIdx + 1) % 65536;
    return this.cmdIdx;
  }

  _numberResponseCommands(result) {
    let processed = result;
    if (!Array.isArray(result)) {
      processed = [result];
    }
    processed.forEach(r => {
      if (r.commands) {
        this._numberRequestCommands(r.commands);
      } else {
        this._numberRequestCommands(r);
      }
    });
    return result;
  }

  _numberRequestCommands(commands) {
    let processed = commands;
    if (!Array.isArray(commands)) {
      processed = [commands];
    }
    processed.forEach(c => {
      if (!c.id) {
        c.id = this._nextCmdIdx();
      }
      this.commands[c.id] = c;
      if (c.done) {
        // done callback
        if (!this.done) {
          this.done = {};
        }
        this.done[c.id] = c.done;
        delete c.done;
      }
      if (c.cat === 'ctrl' && (c.act === 'sequence' || c.act === 'parallel')) {
        this._numberRequestCommands(c.args);
      }
    });
    return commands;
  }

  _performCommands(commands) {
    if (!commands) {
      return new Promise(resolve => resolve()); // do nothing
    }

    if (Array.isArray(commands)) {
      // same as act:parallel
      let promises = commands.map(c => {
        return this._performCommands(c);
      });
      return Promise.all(promises).then(resultArray => {
        let result = resultArray.reduce((a, b) => {
          if (a && b) {
            return a.concat(b);
          } else if (!a) {
            return b;
          }
          return a;
        }, []);
        return new Promise(resolve => resolve(result));
      });
    }

    let command = commands;
    if (command.status) {
      // response to the issued command
      if (command.id) {
        let c = this.commands[command.id];
        if (c) {
          let done;
          if (this.done && this.done[command.id]) {
            done = this.done[command.id];
          }
          if (Math.floor(command.status / 100) !== 2) {
            RED.log.info(`Not-OK status to command: ${JSON.stringify(c)}, status:${JSON.stringify(command)}`);
            try {
              done(command.status, command.results);
            } catch (_) {
            }
          } else if (done) {
            try {
              done();
            } catch (_) {
            }
          }
          if (done) {
            delete this.done[command.id];
          }
          delete this.commands[command.id];
        }
      }
      if (command.commands) {
        return this._performCommands(command.commands);
      }
      if (Math.floor(command.status / 100) !== 2) {
        this._info(`Server returned Not-OK, status:${JSON.stringify(commands)}`);
      }
      return new Promise(resolve => resolve()); // do nothing
    }

    if (!command.id) {
      return new Promise(resolve => resolve({ status: 400, message: 'id missing' }));
    }
    if (!command.cat) {
      return new Promise(resolve => resolve({ status: 400, message: 'category missing' }));
    }

    if (command.cat === 'ctrl') {
      let children = command.args || [];
      if (!Array.isArray(children)) {
        children = [children];
      }
      let promises;
      switch(command.act) {
      case 'sequence':
        promises = children.reduce((p, c) => {
          if (!c) {
            return p;
          }
          let next = p.then(result => {
            return this._performCommand(c, result);
          });
          return next;
        }, new Promise(resolve => resolve())).then(result => {
          return new Promise(resolve => {
            if (result) {
              result.push({ status: 200, id: command.id });
              return resolve(result);
            }
            return resolve({ status: 400, id: command.id });
          });
        });
        return promises;

      case 'parallel':
        promises = children.map(c => {
          return this._performCommands(c);
        });
        return Promise.all(promises).then(resultArray => {
          let result = resultArray.reduce((a, b) => {
            if (a && b) {
              return a.concat(b);
            } else if (!a) {
              return b;
            }
            return a;
          }, []);
          return new Promise(resolve => {
            result.push({ status: 200, id: command.id });
            resolve(result);
          });
        });

      default:
        throw new Error('unknown action:' + command.act);
      }

      return new Promise(resolve => resolve({ status: 400, errCommands: command }));
    }
    return this._performCommand(command);
  }

  _buildErrResult(err, c) {
    if (err instanceof Error) {
      return { status: 500, message: err.toString(), stack: err.stack, id: c.id };
    } else {
      err.id = c.id;
      return err;
    }
  }

  _performCommand(c, result) {
    return new Promise((resolve, reject) => {
      try {
        if (!result) {
          result = [];
        } else if (!Array.isArray(result)) {
          result = [result];
        }
        switch(c.cat) {
        case 'sys':
          return this._performSysCommand(c).then(sysResult => {
            if (sysResult) {
              sysResult.id = c.id;
              result.push(sysResult);
            } else {
              result.push({ status: 200, id: c.id });
            }
            return resolve(result);
          }).catch(err => {
            result.push(this._buildErrResult(err, c));
            return reject(result);
          });
        default:
          result.push(this._buildErrResult({ status: 400 }, c));
          return reject(result);
        }
      } catch (err) {
        result.push(this._buildErrResult(err, c));
        return reject(result);
      }
    });
  }

  _performSysCommand(c) {
    switch(c.act) {
    case 'provision':
      return this._performProvision(c);
    case 'syncflows':
      return this._performSyncFlows(c);
    case 'updateflows':
      return this._performUpdateFlows(c);
    case 'inspect':
      return this._performInspect(c);
    case 'restart':
      return this._performRestart(c);
    default:
      throw new Error('Unsupported action:' + c.act);
    }
  }

  _performInspect(c) {
    return new Promise((resolve, reject) => {
      if (!this.deviceState.candyBoardServiceSupported) {
        return reject({ status: 405 });
      }
      if (!c) {
        return reject({ status: 400 });
      }
      this.deviceState._candyRun('modem', 'show').then(result => {
        let modemInfo = result.output;
        resolve({ status: 200, results: modemInfo });
      }).catch(err => {
        reject(err);
      });
    });
  }

  _performProvision(c) {
    this.hearbeatIntervalMs = c.args.hearbeatIntervalMs;
    return new Promise(resolve => {
      // do stuff if any after provisioning
      return resolve();
    });
  }

  static listAccounts(flows) {
    if (!Array.isArray(flows)) {
      flows = [flows];
    }
    let accounts = flows.filter(f => {
      if (f.type !== 'CANDY EGG account') {
        return false;
      }
      if (!f.managed) {
        return false;
      }
      if (!f.accountFqn) {
        return false;
      }
      if (!f.loginUser) {
        return false;
      }
      return true;
    });
    return accounts;
  }

  _updateLocalFlows(flows) {
    return new Promise((resolve, reject) => {
      let accounts = DeviceManager.listAccounts(flows);
      if (accounts.length === 0) {
        return reject({ status: 400, message: 'invalid flow content' });
      }
      accounts.forEach(a => {
        if (!a.revision) {
          a.revision = 1;
        } else {
          a.revision++;
        }
        a.originator = this.deviceState.deviceId;
      });
      this.deviceState.updateFlow(flows).then(content => {
        resolve({data:content, done: () => {
          this._warn('FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!');
          DeviceManager.restart();
        }});
      }).catch(err => {
        reject(err);
      });
    });
  }

  static flowsToString(flows, content=null) {
    if (typeof(flows) === 'string') {
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

  _performSyncFlows(c) {
    return new Promise((resolve, reject) => {
      try {
        if (c.args.flowUpdateRequired) {
          if (this.deviceState.flowFileSignature !== c.args.expectedSignature) {
            fs.readFile(this.deviceState.flowFilePath, (err, data) => {
              if (err) {
                return reject(err);
              }
              let flows = [];
              try {
                flows = JSON.parse(data);
              } catch (_) {
                return reject({ status: 500, message: 'My flow is invalid' });
              }
              if (c.args.publishable) {
                this._updateLocalFlows(flows).then(result => {
                  return resolve(result);
                }).catch(err => {
                  return reject(err);
                });
              } else {
                return resolve({data: DeviceManager.flowsToString(flows)});
              }
            });
          }
        } else if (this.deviceState.flowFileSignature !== c.args.expectedSignature) {
          // non-primary accounts are NOT allowed to download (to be delivered) flow files
          if (!this.primary) {
            return reject({ status: 405, message: 'not the primary account' });
          }
          return reject({ status: 202, commands: {
            cat: 'sys',
            act: 'deliverflows',
            args: {
              flowId: c.args.flowId
            }
          }});
        } else {
          // 304 Not Modified
          return reject({ status: 304 });
        }
      } catch (err) {
        return reject(err);
      }
    }).then(result => {
      return new Promise(resolve => {
        let status = { status: 202, commands: {
          cat: 'sys',
          act: 'updateflows',
          args: {
            name: path.basename(this.deviceState.flowFilePath),
            signature: this.deviceState.flowFileSignature,
            content: result.data
          },
          done: result.done
        }};
        return resolve(status);
      });
    });
  }

  _performUpdateFlows(c) {
    // non-primary accounts are allowed to upload flow files
    return new Promise((resolve, reject) => {
      try {
        if (!c.args.content) {
          return reject({ status: 400 });
        }
        this.deviceState.updateFlow(c.args.content).then(() => {
          resolve({ status: 200, restart: true });
        }).catch(err => {
          return reject(err);
        });
      } catch (err) {
        return reject(err);
      }
    });
  }

  _performRestart(c) {
    return new Promise((resolve, reject) => {
      if (c) {
        return resolve({ status: 200, restart: true });
      }
      return reject({ status: 400 });
    });
  }
}

export class DeviceState {

  constructor(onFlowFileChanged, onFlowFileRemoved) {
    this.candyBoardServiceSupported = false;
    this.flowFileSignature = '';
    this.flowFilePath = '';
    this.resolver = new DefaultDeviceIdResolver();
    this.wartcher = null;
    this.onFlowFileChanged = onFlowFileChanged;
    this.onFlowFileRemoved = onFlowFileRemoved;
  }

  init() {
    return new Promise(resolve => {
      if (this.deviceId) {
        resolve();
      } else {
        this.resolver.resolve().then(id => {
          this.deviceId = id;
          resolve();
        });
      }
    });
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
          output = output.replace(/\x1B\[([0-9]{1,2}(;[0-9]{1,2})?)?[mGK]/g, '');
          if (code) {
            return reject({ code: code, output: output });
          }
          let ret = '';
          try {
            ret = JSON.parse(output);
          } catch (e) {
            if (!notJson) {
              RED.log.error(`** JSON Parse Error => ${ret}`);
              RED.log.info(e.stack);
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

  testIfCANDYBoardServiceInstalled(service) {
    return this.init().then(() => {
      return new Promise(resolve => {
        let systemctl = cproc.spawn('systemctl', ['is-enabled', service], { timeout: 1000 });
        systemctl.on('close', code => {
          let candyBoardServiceSupported = (code === 0);
          resolve(candyBoardServiceSupported);
        });
        systemctl.on('error', () => {
          resolve(false);
        });
      }).then(candyBoardServiceSupported => {
        if (process.env.DEVICE_MANAGEMENT_ENABLED === 'true' &&
            process.env.DEVEL === 'true' && !candyBoardServiceSupported) {
          candyBoardServiceSupported = true;
        }
        this.candyBoardServiceSupported = candyBoardServiceSupported;
        return Promise.resolve([this.deviceId]);
      });
    });
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
    if (typeof(data) === 'string') {
      flows = JSON.parse(data);
    } else {
      flows = data;
    }
    let accounts = DeviceManager.listAccounts(flows);
    if (accounts.length > 0) {
      accounts.forEach(a => {
        delete a.lastDeliveredAt;
      });
      data = JSON.stringify(flows);
    }
    let current = this.flowFileSignature;
    let sha1 = crypto.createHash('sha1');
    sha1.update(data);
    this.flowFileSignature = sha1.digest('hex');
    // true for modified
    return (current !== this.flowFileSignature);
  }

  updateFlow(flows) {
    return new Promise((resolve, reject) => {
      let content;
      if (typeof(flows) === 'string') {
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
      content = DeviceManager.flowsToString(flows, content);
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

  initWithFlowFilePath(flowFilePath) {
    return this.init().then(() => {
      if (flowFilePath && this.flowFilePath !== flowFilePath) {
        this.flowFilePath = flowFilePath;
        if (this.watcher) {
          this.watcher.close();
        }
        this.watcher = null;
      } else {
        flowFilePath = this.flowFilePath;
      }
      return new Promise((resolve, reject) => {
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
            RED.log.error(`[CANDY RED] Wrong JSON format => ${flowFilePath}. Correct the error or remove it`);
            return reject(e);
          }

          this.setFlowSignature(data);
          RED.log.info(`[CANDY RED] flowFileSignature: ${this.flowFileSignature}`);

          if (!Array.isArray(flows)) {
            return resolve(true);
          }
          resolve();
        });
      });
    }).then(() => {
      return new Promise((resolve, reject) => {
        try {
          this._watchFlowFilePath();
          return resolve();
        } catch (err) {
          return reject(err);
        }
      });
    });
  }
}

const MODULE_MODEL_MAPPINGS = {
  'EC21': 'CANDY Pi Lite LTE',
  'UC20': 'CANDY Pi Lite 3G',
  'EC25': 'CANDY Pi Lite+',
  'BG96': 'CANDY Pi Lite LPWA',
};

export class LwM2MDeviceManagement {
  constructor(deviceState) {
    this.internalEventBus = new EventEmitter();
    this.deviceState = deviceState;
    this.objects = {};
    this.modemInfo = {};
    this.tasks = {};
    this.settings = {};
  }

  init(settings) {
    this.settings = Object.assign(this.settings, settings);
    if (this.deviceState.candyBoardServiceSupported &&
        process.env.DEVICE_MANAGEMENT_ENABLED === 'true') {

      // prepare module based identifier
      return new Promise(resolve => {
        fs.readFile(MODEM_INFO_FILE_PATH, (err, data) => {
          // Read a modem info file to retrieve IMEI when online
          if (err) {
            // Run candy modem show to retrieve IMEI when offline
            return this.deviceState._candyRun('modem', 'show').then(result => {
              this.modemInfo = result.output;
              resolve();
            }).catch(err => {
              resolve();
              RED.log.error(`[CANDY RED] Failed to run candy modem show command => ${err.message || err}`);
            });
          } else {
            let dataString = data.toString().trim();
            try {
              this.modemInfo = JSON.parse(dataString).result;
            } catch (_) {
              RED.log.error(`Unexpected modem info => [${dataString}]`);
            }
            resolve();
          }
        });
      }).then(() => {
        this.internalEventBus.on('resolveClientName', (context) => {
          let clientName = context.clientName;
          if (this.modemInfo.imei) {
            clientName = `urn:imei:${this.modemInfo.imei}`;
          } else if (settings.deviceId) {
            if (settings.deviceId.indexOf('urn:') !== 0) {
              clientName = `urn:${settings.deviceId}`;
            } else {
              clientName = settings.deviceId;
            }
          }
          this.internalEventBus.emit('clientNameResolved', clientName);
        });

        return new Promise((resolve, reject) => {
          // load MO files
          fs.readdir(`${__dirname}/mo`, (err, dirs) => {
            if (err) {
              RED.log.error(`[CANDY RED] Failed to load MO files`);
              return reject(err);
            }
            dirs.filter(name => name.indexOf('.json') > 0).forEach((name) => {
              try {
                const data = fs.readFileSync(`${__dirname}/mo/${name}`);
                const mo = JSON.parse(data.toString(), (key, value) => {
                  if (key === 'value' && typeof(value) === 'string' && value.indexOf('[Function]') === 0) {
                    let functionName = value.substring(10);
                    let f = this[`_${functionName}`];
                    if (typeof(f) === 'function') {
                      return f.bind(this);
                    } else {
                      RED.log.error(`[CANDY RED] Failed to assign a function => '_${functionName}'`);
                      return '';
                    }
                  }
                  return value;
                });
                Object.keys(mo).forEach((objectId) => {
                  if (this.objects[objectId]) {
                    RED.log.warn(`[CANDY RED] DUPLICATE ENTRY for the same ObjectID: ${objectId}. This will cause unexpected behaviors.`);
                  }
                });
                Object.assign(this.objects, mo);
                RED.log.info(`[CANDY RED] Loaded ObjectIDs => ${Object.keys(mo)} from [${name}]`);
              } catch (err) {
                RED.log.error(`[CANDY RED] Failed to load a MO file: ${name} (${err.message || err})`);
              }
            });

            return resolve();
          });

        });

      });

    } else {
      return Promise.resolve();
    }
  }

  getValue(objectId, instanceId, resourceId, ...args) {
    const res = this.getResource(objectId, instanceId, resourceId);
    if (!res) {
      return null;
    }
    if (typeof(res.value) === 'function') {
      return res.value(args);
    }
    return res.value;
  }

  getResource(objectId, instanceId, resourceId) {
    objectId = String(objectId);
    instanceId = String(instanceId);
    resourceId = String(resourceId);
    const obj = this.objects[objectId];
    if (!obj) {
      return null;
    }
    const instance = obj[instanceId];
    if (!instance) {
      return null;
    }
    const res = instance[resourceId];
    return Object.assign({}, res);
  }

  setResource(objectId, instanceId, resourceId, newVal) {
    objectId = String(objectId);
    instanceId = String(instanceId);
    resourceId = String(resourceId);
    let obj = this.objects[objectId];
    if (!obj) {
      obj = {};
      this.objects[objectId] = obj;
    }
    let instance = obj[instanceId];
    if (!instance) {
      instance = {};
      obj[instanceId] = instance;
    }
    if (typeof(newVal) === 'object') {
      instance[resourceId] = Object.assign({}, newVal);
    } else {
      throw new Error(`Unexpected resource object`);
    }
  }

  _connectivityStatisticsStart() {
    RED.log.info(`[connectivityStatisticsStart] Start`);
    // TODO reset tx/rx counter
    RED.log.info(`[connectivityStatisticsStart] End`);
  }

  _resolveCANDYLINEManufacturer() {
    return process.env.DEVICE_MANAGEMENT_MANUFACTURER || 'CANDY LINE';
  }

  _resolveCANDYLINEModel() {
    return process.env.DEVICE_MANAGEMENT_MODEL || this.resolveCANDYLINEProductName();
  }

  _resolveCANDYLINEProductName() {
    let name = MODULE_MODEL_MAPPINGS[this.modemInfo.model];
    if (!name) {
      name = `Unknown (${this.modemInfo.model})`;
    }
    return name;
  }

  _resolveModuleName() {
    return this.modemInfo.model;
  }

  _resolveModuleIdentifier() {
    return this.modemInfo.imei;
  }

  _resolveModuleFirmwareVersion() {
    return this.modemInfo.revision;
  }

  _resolveCANDYREDVersion() {
    return this.settings.version;
  }

  _applyOSConfiguration() {
    RED.log.info(`[applyOSConfiguration] Start`);
    // TODO Apply OS Configuration to the device
    RED.log.info(`[applyOSConfiguration] End`);
  }

  _updateAgentConfiguration() {
    RED.log.info(`[updateAgentConfiguration] Start`);
    // TODO Update Agent Configuration
    RED.log.info(`[updateAgentConfiguration] End`);
  }
}

export class DeviceManagerStore {
  constructor() {
    this.store = {};
    this.deviceState = new DeviceState(this._onFlowFileChangedFunc(), this._onFlowFileRemovedFunc());
    this.lwm2m = new LwM2MDeviceManagement(this.deviceState);
  }

  _onFlowFileChangedFunc() {
    return (() => {
      let wip = false;
      return () => {
        return new Promise((resolve, reject) => {
          if (wip) {
            return;
          }
          wip = true;
          this.deviceState.loadAndSetFlowSignature().then(modified => {
            if (!modified) {
              wip = false;
              return resolve();
            }
            let promises = Object.keys(this.store).map(accountFqn => {
              return this.store[accountFqn].publish({
                cat: 'sys',
                act: 'syncflows',
                args: {
                  expectedSignature: this.deviceState.flowFileSignature
                }
              });
            });
            return Promise.all(promises);
          }).then(() => {
            wip = false;
            return resolve();
          }).catch(err => {
            RED.log.warn(err.stack);
            wip = false;
            return reject(err);
          });
        });
      };
    })();
  }

  _onFlowFileRemovedFunc() {
    return (() => {
      return () => {
        return new Promise((resolve, reject) => {
          try {
            if (this.deviceState.flowFileSignature) {
              let promises = Object.keys(this.store).map(accountFqn => {
                if (this.store[accountFqn].primary) {
                  return this.store[accountFqn].publish({
                    cat: 'sys',
                    act: 'deliverflows'
                  });
                }
              });
              Promise.all(promises).then(() => {
                return resolve();
              }).catch(err => {
                RED.log.warn(err.stack);
                return reject(err);
              });
            } else {
              return resolve();
            }
          } catch (err) {
            return reject(err);
          }
        });
      };
    })();
  }

  _get(accountFqn) {
    return this.store[accountFqn];
  }

  _remove(accountFqn) {
    delete this.store[accountFqn];
  }
}
