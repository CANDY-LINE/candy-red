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

export class DeviceState {

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
    data = JSON.stringify(flows);
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

const CLIENT_CREDENTIAL_PROFILE = {
  '1': 'RSA_3072',
  '2': 'SHARED_SECRET',
};

const UPDATE_INTERVAL_MS = process.env.UPDATE_INTERVAL_MS || 60 * 1000;

export class LwM2MDeviceManagement {

  static restart() {
    // systemctl shuould restart the service
    setTimeout(() => {
      process.exit(219);
    }, REBOOT_DELAY_MS);
  }

  constructor(deviceState) {
    this.internalEventBus = new EventEmitter();
    this.deviceState = deviceState;
    this.objects = {};
    this.objectFile = `objects_candy-red.json`;
    this.modemInfo = {};
    this.tasks = {};
    this.settings = {};
    this.functionResolver = (key, value) => {
      if (key === 'value' && typeof(value) === 'string' && value.indexOf('[Function]') === 0) {
        const functionName = value.substring(10);
        let f = this[`_${functionName}`];
        if (typeof(f) === 'function') {
          f = f.bind(this);
          f.functionName = functionName;
          return f;
        } else {
          RED.log.error(`[CANDY RED] Failed to assign a function => '_${functionName}'`);
          return '';
        }
      }
      return value;
    };
    this.functionReplacer = (_, value) => {
      if (typeof(value) === 'function') {
        return `[Function]${value.functionName}`;
      } else {
        return value;
      }
    };
    this.objectsLastSavedAt = 0;
  }

  init(settings) {
    this.settings = Object.assign(this.settings, settings);
    this.objectFilePath = `${settings.userDir}/${this.objectFile}`;
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
        this.internalEventBus.on('object-event', (ev) => {
          RED.log.debug(`[CANDY RED] object-event => ${JSON.stringify(ev)}`);
          if ((ev.eventType === 'updated') || (ev.eventType === 'created')) {
            if ((ev.uri.match(`^/(${Object.keys(this.objects).join('|')})/.*$`)) &&
                (Date.now() - this.objectsLastSavedAt > UPDATE_INTERVAL_MS)) {
              return this.saveObjects();
            }
          } else if (ev.eventType === 'executed') {
            const uri = ev.uri.split('/');
            const obj = this.objects[uri[1]];
            if (obj) {
              const ins = obj[uri[2]];
              if (ins) {
                const res = ins[uri[3]];
                if (res.value && typeof(res.value) === 'function') {
                  return res.value(ev.value);
                }
              }
            }
            RED.log.warn(`[CANDY RED] Failed to execute: ${JSON.stringify(ev)}`);
          }
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
                const mo = JSON.parse(data.toString(), this.functionResolver);
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

      }).then(() => {
        return this.loadObjects();
      }).then(() => {
        return this.saveObjects();
      });

    } else {
      return Promise.resolve();
    }
  }

  loadObjects() {
    return new Promise((resolve) => {
      // load object file
      try {
        const data = fs.readFileSync(`${this.objectFilePath}`);
        const objects = JSON.parse(data.toString(), this.functionResolver);
        Object.assign(this.objects, objects);
        RED.log.info(`[CANDY RED] Overridden ObjectIDs => ${Object.keys(objects)}`);
      } catch (_) {
      }
      resolve();
    });
  }

  saveObjects() {
    return new Promise((resolve) => {
      // save current objects
      try {
        let data;
        if (RED.settings.flowFilePretty) {
          data = JSON.stringify(this.objects, this.functionReplacer, 2);
        } else {
          data = JSON.stringify(this.objects, this.functionReplacer);
        }
        fs.writeFileSync(`${this.objectFilePath}`, data);
      } catch (_) {
      }
      this.objectsLastSavedAt = Date.now();
      resolve();
    });
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

  syncFlows(c) {
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
                return resolve({data: DeviceState.flowsToString(flows)});
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

  _connectivityStatisticsStart() {
    RED.log.info(`[connectivityStatisticsStart] Start`);
    // TODO reset tx/rx counter
    RED.log.info(`[connectivityStatisticsStart] End`);
  }

  _resolveCANDYLINEManufacturer() {
    return process.env.DEVICE_MANAGEMENT_MANUFACTURER || 'CANDY LINE';
  }

  _resolveCANDYLINEModel() {
    return process.env.DEVICE_MANAGEMENT_MODEL || this._resolveCANDYLINEProductName();
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

  _updateMindConnectAgentConfiguration(flowFilePath) {
    return new Promise((resolve, reject) => {
      RED.log.info(`[updateMindConnectAgentConfiguration] Start`);
      // Update Agent Configuration
      flowFilePath = flowFilePath || this.deviceState.flowFilePath;
      if (Array.isArray(flowFilePath)) {
        flowFilePath = flowFilePath[0];
      }
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          RED.log.info(`[updateMindConnectAgentConfiguration] ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
        try {
          const flows = JSON.parse(data.toString());
          let agents = flows.filter(f => {
            if (f.type !== 'mindconnect') {
              return false;
            }
            return true;
          });
          agents.forEach((agent) => {
            const nodeName = this.getValue(30001, 0, 10);
            agent.name = nodeName || '';
            const clientCredentialProfile = CLIENT_CREDENTIAL_PROFILE[this.getValue(30001, 0, 2)];
            agent.configtype = clientCredentialProfile || 'SHARED_SECRET';
            const uploadFileChunks = this.getValue(30001, 0, 8);
            agent.chunk = !!uploadFileChunks;
            const retries = this.getValue(30001, 0, 9);
            agent.retries = retries || 0;
            const dataValidation = this.getValue(30001, 0, 6);
            agent.validate = !!dataValidation;
            const eventValidation = this.getValue(30001, 0, 7);
            agent.validateevent = !!eventValidation;
            const baseUrl = this.getValue(30001, 0, 0) || '';
            const iat = this.getValue(30001, 0, 1) || '';
            const clientId = this.getValue(30001, 0, 3) || '';
            const tenant = this.getValue(30001, 0, 4) || '';
            const expiration = this.getValue(30001, 0, 5) || '';
            const agentconfig = {
              'content': {
                'baseUrl': baseUrl,
                'iat': iat,
                'clientCredentialProfile': [ clientCredentialProfile ],
                'clientId': clientId,
                'tenant': tenant
              },
              'expiration': expiration
            };
            agent.agentconfig = JSON.stringify(agentconfig);
          });
          RED.log.info(`[updateMindConnectAgentConfiguration] End`);
          return resolve(flows);
        } catch (err) {
          RED.log.info(`[updateMindConnectAgentConfiguration] ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
      });
    }).then((flows) => {
      return this.deviceState.updateFlow(flows);
    }).then(() => {
      return this.saveObjects();
    }).then(() => {
      RED.log.warn('FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!');
      LwM2MDeviceManagement.restart();
    });
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
        return new Promise((resolve) => {
          // TODO
          return resolve();
        });
      };
    })();
  }

  _onFlowFileRemovedFunc() {
    return (() => {
      return () => {
        return new Promise((resolve) => {
          // TODO
          return resolve();
        });
      };
    })();
  }
}
