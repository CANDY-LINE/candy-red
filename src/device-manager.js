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
import request from 'request';
import RED from 'node-red';

const REBOOT_DELAY_MS = 1000;

const PROC_CPUINFO_PATH = '/proc/cpuinfo';
const PROC_DT_MODEL_PATH = '/proc/device-tree/model';
const MODEM_INFO_FILE_PATH = '/opt/candy-line/candy-pi-lite/__modem_info';
const DM_FLOW = `${__dirname}/device-management-flow.json`;
const EXCLUDED_URI_LIST = [
  '/3/0/2', '/3/0/3', '/3/0/6', '/3/0/9', '/3/0/10', '/3/0/13', '/3/0/14', '/3/0/15', '/3/0/18', '/3/0/20', '/3/0/21'
];

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
            RED.log.warn(`[CANDY RED] Unknown Linux Device Model: [${model}]`);
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
        // DEBUG USE ONLY
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
    this.credentialFilePath = `${settings.userDir}/lwm2m_dm_cred.json`;
    let enableDM = false;
    if (this.deviceState.candyBoardServiceSupported &&
        process.env.DEVICE_MANAGEMENT_ENABLED === 'true') {
      enableDM = true;
    }
    if (process.env.DEVEL !== 'true' && process.env.DEVICE_MANAGEMENT_BS_DTLS !== 'PSK') {
      enableDM = false;
    }
    if (enableDM) {
      // setup DM flow
      return this.setupDMFlow().then(() => {
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
                RED.log.error(`[CANDY RED] Unexpected modem info => [${dataString}]`);
              }
              resolve();
            }
          });
        });
      }).then(() => {
        this.internalEventBus.on('configure', (context) => {
          const config = {};
          // EPN
          config.clientName = context.clientName;
          if (this.modemInfo && this.modemInfo.imei) {
            config.clientName = `urn:imei:${this.modemInfo.imei}`;
          } else if (settings.deviceId) {
            if (settings.deviceId.indexOf('urn:') !== 0) {
              config.clientName = `urn:${settings.deviceId}`;
            } else {
              config.clientName = settings.deviceId;
            }
          }

          config.serverId = 97;
          config.clientPort = parseInt(process.env.DEVICE_MANAGEMENT_CL_PORT || 57830);
          config.reconnectSec = parseInt(process.env.DEVICE_MANAGEMENT_RECONNECT_SEC || 60);
          config.serverHost = process.env.DEVICE_MANAGEMENT_BS_HOST;
          config.serverPort = process.env.DEVICE_MANAGEMENT_BS_PORT;
          config.enableDTLS = process.env.DEVICE_MANAGEMENT_BS_DTLS === 'PSK';
          if (config.enableDTLS) {
            config.pskIdentity = process.env.DEVICE_MANAGEMENT_BS_DTLS_PSK_ID;
            config.presharedKey = process.env.DEVICE_MANAGEMENT_BS_DTLS_PSK;
          }
          config.requestBootstrap = true;
          config.saveProvisionedConfig = true;
          config.useIPv4 = process.env.DEVICE_MANAGEMENT_BS_HOST_IPV6 !== 'true';
          if (this.settings.logging && this.settings.logging.console && this.settings.logging.console.level === 'debug') {
            config.redirectLwm2mClientLog = true;
            config.dumpLwm2mMessages = true;
          }
          config.hideSensitiveInfo = false;
          config.credentialFilePath = this.credentialFilePath;

          this.internalEventBus.emit('configurationDone', config);
        });

        this.internalEventBus.on('object-event', (ev) => {
          RED.log.debug(`[CANDY RED] object-event => ${JSON.stringify(ev)}`);
          switch (ev.eventType) {
            case 'updated':
            case 'created': {
              this.triggerSaveObjectsTask();
              break;
            }
            case 'executed': {
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
              RED.log.debug(`[CANDY RED] Internal function associated with ${ev.uri} is missing.: ${JSON.stringify(ev)}`);
              break;
            }
            default:
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
      // Reset DM flow if exists
      return this.stripDMFlow();
    }
  }

  toPackageInfo(flowTab) {
    const info = flowTab.info;
    if (!info) {
      return {};
    }
    const parts = info.split('\n');
    let i = -1;
    for (i = parts.length - 1; i > 0; i--) {
      if (parts[i].trim() === '---') {
        break;
      }
    }
    if (i >= 0) {
      try {
        return JSON.parse(parts.slice(i + 1).join(''));
      } catch (_) {
        return {};
      }
    }
  }

  installFlow(newFlowTabName, newFlowOrPath) {
    return new Promise((resolve, reject) => {
      RED.log.debug(`[CANDY RED] <installFlow> Start`);
      let newFlow = newFlowOrPath;
      if (typeof(newFlowOrPath) === 'string') {
        try {
          newFlow = JSON.parse(fs.readFileSync(newFlowOrPath).toString());
        } catch (err) {
          RED.log.info(`[CANDY RED] <installFlow> Invalid JSON format, ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
      }
      let flowFilePath = this.deviceState.flowFilePath;
      if (Array.isArray(flowFilePath)) {
        flowFilePath = flowFilePath[0];
      }
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          RED.log.info(`[CANDY RED] <installFlow> flowFilePath: ${flowFilePath}, ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
        try {
          let flows = JSON.parse(data.toString());
          if (!Array.isArray(flows)) {
            flows = [flows];
          }
          const newFlowExists = flows.filter(f => f.type === 'tab' && f.label === newFlowTabName).length > 0;
          if (newFlowExists) {
            RED.log.info(`[CANDY RED] <installFlow> The given flow (${newFlowTabName}) is aleady installed`);
            return resolve();
          }
          const newFlowTab = newFlow.filter(f => f.type === 'tab' && f.label === newFlowTabName)[0];
          const newFlowVal = {
            id: newFlowTab.id
          };
          while (flows.some(f => (f.z === newFlowVal.id || f.id === newFlowVal.id))) {
            newFlowVal.id = `${crypto.randomBytes(4).toString('hex')}.${crypto.randomBytes(4).toString('hex')}`;
          }
          newFlow.filter(f => (f.z === newFlowTab.id)).forEach(f => f.z = newFlowVal.id);
          newFlowTab.id = newFlowVal.id;
          RED.log.info(`[CANDY RED] <installFlow> id collision was resolved! New id => ${newFlowTab.id}`);
          const packageInfo = this.toPackageInfo(newFlowTab);
          RED.log.debug(`[CANDY RED] <installFlow> End; Installed App: ${newFlowTabName}@${packageInfo.version}`);
          return resolve(flows.concat(newFlow));
        } catch (err) {
          RED.log.info(`[CANDY RED] <installFlow> ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
      });
    }).then((flows) => {
      if (flows) {
        return this.deviceState.updateFlow(flows).then(() => {
          RED.log.warn('[CANDY RED] <installFlow> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!');
          LwM2MDeviceManagement.restart();
        });
      }
    });
  }

  uninstallFlow(flowTabName) {
    return new Promise((resolve, reject) => {
      RED.log.debug(`[CANDY RED] <uninstallFlow> Start`);
      let flowFilePath = this.deviceState.flowFilePath;
      if (Array.isArray(flowFilePath)) {
        flowFilePath = flowFilePath[0];
      }
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          RED.log.info(`[CANDY RED] <uninstallFlow> flowFilePath: ${flowFilePath}, ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
        try {
          const flows = JSON.parse(data.toString());
          const flowTab = flows.filter(f => (f.type === 'tab' && f.label === flowTabName))[0];
          if (!flowTab) {
            RED.log.info(`[CANDY RED] <uninstallFlow> The given flow (${flowTabName}) is aleady gone`);
            return resolve();
          }
          const newFlow = flows.filter(f => (f.z !== flowTab.id && f.id !== flowTab.id));
          const packageInfo = this.toPackageInfo(flowTab);
          RED.log.debug(`[CANDY RED] <uninstallFlow> End; Uninstalled App: ${flowTabName}@${packageInfo.version}`);
          return resolve(newFlow);
        } catch (err) {
          RED.log.info(`[CANDY RED] <uninstallFlow> ERROR End. err => ${err.message || err}`);
          return reject(err);
        }
      });
    }).then((flows) => {
      if (flows) {
        return this.deviceState.updateFlow(flows).then(() => {
          try {
            // Remove Credentials file as well
            fs.unlinkSync(this.credentialFilePath);
          } catch (_) {}
          RED.log.warn('[CANDY RED] <uninstallFlow> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!');
          LwM2MDeviceManagement.restart();
        });
      }
    });
  }

  setupDMFlow() {
    return this.installFlow('CANDY LINE DM', DM_FLOW);
  }

  stripDMFlow() {
    return this.uninstallFlow('CANDY LINE DM');
  }

  triggerSaveObjectsTask() {
    if (this.triggerSaveObjectsTaskHandle) {
      return;
    }
    let timeout = UPDATE_INTERVAL_MS;
    if (Date.now() - this.objectsLastSavedAt > UPDATE_INTERVAL_MS) {
      timeout = 0;
    }
    this.triggerSaveObjectsTaskHandle = setTimeout(() => {
      this.triggerSaveObjectsTaskHandle = 0;
      this.readResources(`^/(${Object.keys(this.objects).join('|')})/.*$`).then((result) => {
        result.filter(r => EXCLUDED_URI_LIST.indexOf(r.uri) < 0).forEach((r) => {
          const uri = r.uri.split('/');
          const objectId = uri[1];
          const instanceId = uri[2];
          const resourceId = uri[3];
          const object = this.objects[objectId];
          let instance = object[instanceId];
          if (!instance) {
            object[instanceId] = {};
            instance = object[instanceId];
          }
          let resource = instance[resourceId];
          if (!resource || (resource.acl && resource.acl.indexOf('W') >= 0) && resource.type !== 'FUNCTION') {
            instance[resourceId] = r.value;
          }
        });
        this.saveObjects();
      }).catch((err) => {
        RED.log.warn(`[CANDY RED] <triggerSaveObjectsTask> Error => ${JSON.stringify(err)}`);
      });
    }, UPDATE_INTERVAL_MS);
  }

  loadObjects() {
    return new Promise((resolve) => {
      // load object file
      try {
        const data = fs.readFileSync(`${this.objectFilePath}`);
        const savedObjects = JSON.parse(data.toString(), this.functionResolver);
        const mergedObjectIds = [];
        Object.keys(savedObjects).forEach((objectId) => {
          mergedObjectIds.push(objectId);
          const object = savedObjects[objectId];
          if (!this.objects[objectId]) {
            this.objects[objectId] = object;
            return;
          }
          Object.keys(object).forEach((instanceId) => {
            const instance = object[instanceId];
            if (!this.objects[objectId][instanceId]) {
              this.objects[objectId][instanceId] = instance;
              return;
            }
            Object.keys(instance).forEach((resourceId) => {
              const resource = instance[resourceId];
              this.objects[objectId][instanceId][resourceId] = resource;
            });
          });
        });
        RED.log.info(`[CANDY RED] <loadObjects> Merged ObjectIDs => ${mergedObjectIds}`);
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

  peekLocalValue(objectId, instanceId, resourceId) {
    const res = this._getLocalResource(objectId, instanceId, resourceId);
    if (!res) {
      return null;
    }
    if (typeof(res.value) === 'function') {
      return res.value();
    }
    return res.value;
  }

  _getLocalResource(objectId, instanceId, resourceId) {
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

  readResources(uriRegExp) {
    RED.log.debug(`[CANDY RED] <readResources> uriRegExp: ${uriRegExp}`);
    return new Promise((resolve, reject) => {
      const msgId = crypto.randomBytes(8).toString('hex');
      this.internalEventBus.emit('object-read', { id: msgId, topic: uriRegExp });
      this.internalEventBus.once(`object-read-${msgId}`, (result) => {
        if (result.error) {
          return reject(result.payload); // Array
        }
        return resolve(result.payload); // Array
      });
    });
  }

  writeResource(uri, value) {
    RED.log.debug(`[CANDY RED] <writeResource> uri: ${uri}, value: ${value}`);
    return new Promise((resolve, reject) => {
      const msgId = crypto.randomBytes(8).toString('hex');
      this.internalEventBus.emit('object-write', { id: msgId, topic: uri, payload: value });
      this.internalEventBus.once(`object-write-${msgId}`, (result) => {
        if (result.error) {
          return reject(result.payload);
        }
        return resolve(result.payload);
      });
    });
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
    RED.log.info(`[CANDY RED] <connectivityStatisticsStart> Start`);
    // TODO reset tx/rx counter
    RED.log.info(`[CANDY RED] <connectivityStatisticsStart> End`);
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

  _restartCANDYRED() {
    RED.log.warn(`[CANDY RED] ** ** Process exits for restarting ** **`);
    return LwM2MDeviceManagement.restart();
  }

  _argsToString(src) {
    switch (typeof(src)) {
      case 'string': {
        return src;
      }
      case 'object': {
        if (src.type === 'Buffer') {
          return Buffer.from(src.data).toString();
        }
        return src.toString();
      }
      default: {
        return src.toString();
      }
    }
  }

  _argsToObject(src) {
    try {
      return JSON.parse(this._argsToString(src));
    } catch (_) {
      return null;
    }
  }

  _downloadFlowOrParse(args) {
    let pkg = this._argsToObject(args);
    if (!pkg) {
      pkg = {};
    }
    return this.readResources('^/28005/0/(2|3|4)$').then((resources) => {
      const downloadInfo = resources.reduce((accumulator, currentValue) => {
        accumulator[currentValue.uri] = currentValue.value.value;
        return accumulator;
      }, {});
      pkg.flowTabName = pkg.flowTabName || downloadInfo['/28005/0/2'];
      if (!pkg.flowTabName) {
        return Promise.reject({ message: `Flow tab name is missing`});
      }
      if (pkg.flow) {
        if (typeof(pkg.flow) === 'string') {
          try {
            pkg.flow = JSON.parse(pkg.flow);
            return Promise.resolve(pkg);
          } catch (_) {}
        }
      }
      if (!downloadInfo['/28005/0/3']) {
        return Promise.reject({ message: `Cannot download flow`});
      }
      const headers = {};
      if (downloadInfo['/28005/0/4']) {
        Object.keys(downloadInfo['/28005/0/4']).forEach((id) => {
          const headerDef = downloadInfo['/28005/0/4'][id].value;
          if (headerDef) {
            const elements = headerDef.split(':');
            headers[elements[0].trim()] = elements[1].trim();
          }
        });
      }
      return new Promise((resolve, reject) => {
        const url = downloadInfo['/28005/0/3'];
        if ((process.env.DEVEL === 'true' && url.indexOf('http://') >= 0) || url.indexOf('https://') >= 0) {
          request(url, {
            headers: headers
          }, (err, res, body) => {
            if (err) {
              return reject(err);
            }
            const { statusCode } = res;
            if (statusCode !== 200) {
              return reject(`Invalid Status Code: ${statusCode}`);
            }
            if (!body) {
              return reject(`Empty body`);
            }
            try {
              pkg.flow = JSON.parse(body);
              return resolve(pkg);
            } catch(_) {
              return reject(`Invalid JSON: ${body}`);
            }
          });
        } else if (url.indexOf('file://') >= 0) {
          fs.readFile(url.substring(7), (err, data) => {
            if (err) {
              return reject(`Invalid Path: ${url}`);
            }
            try {
              pkg.flow = JSON.parse(data);
              return resolve(pkg);
            } catch(_) {
              return reject(`Invalid JSON: ${data.toString()}`);
            }
          });
        } else {
          return reject({ message: `Unsupported protocol scheme: ${url}`});
        }
      });
    });

  }

  _downloadAndInstallApplicationFlow(args) {
    RED.log.info(`[CANDY RED] <_downloadAndInstallApplicationFlow> Start; args => ${JSON.stringify(args)}`);
    return this._downloadFlowOrParse(args).then((result) => {
      return this.installFlow(result.flowTabName, result.flow); // process.exit() on success
    }).then(() => {
      return this.writeResource('/28005/0/23', 1);
    }).catch((err) => {
      RED.log.error(`[CANDY RED] <_downloadAndInstallApplicationFlow> err=>${err ? (err.message ? err.message : err) : '(uknown)'}`);
      return this.writeResource('/28005/0/23', 2);
    }).then(() => {
      RED.log.info(`[CANDY RED] <_downloadAndInstallApplicationFlow> End`);
      return this.saveObjects();
    });
  }

  _uninstallApplicationFlow(args) {
    RED.log.info(`[CANDY RED] <_uninstallApplicationFlow> Start; args => ${JSON.stringify(args)}`);
    const flowTabName = this._argsToString(args);
    let p;
    if (flowTabName) {
      p = this.uninstallFlow(flowTabName).then(() => {
        return this.writeResource('/28005/0/25', 1);
      });
    } else {
      p = this.writeResource('/28005/0/25', 2);
    }
    return p.catch((err) => {
      RED.log.error(`[CANDY RED] <_uninstallApplicationFlow> err=>${err ? (err.message ? err.message : err) : '(uknown)'}`);
      return this.writeResource('/28005/0/25', 3);
    }).then(() => {
      RED.log.info(`[CANDY RED] <_uninstallApplicationFlow> End`);
      return this.saveObjects();
    });
  }

  _updateApplicationFlowList() {
    return new Promise((resolve, reject) => {
      RED.log.info(`[CANDY RED] <_updateApplicationFlowList> Start`);
      fs.readFile(this.deviceState.flowFilePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        try {
          const flows = JSON.parse(data.toString());
          return this.writeResource('/28005/0/5', flows.filter(f => f.type === 'tab').map((f) => {
            return f.label;
          }));
        } catch (err) {
          return reject(err);
        }
      });
    }).then(() => {
      return this.writeResource('/28005/0/27', 1);
    }).catch((err) => {
      RED.log.error(`[CANDY RED] <_updateApplicationFlowList> err=>${err ? (err.message ? err.message : err) : '(uknown)'}`);
      return this.writeResource('/28005/0/27', 3);
    }).then(() => {
      RED.log.info(`[CANDY RED] <_updateApplicationFlowList> End`);
      return this.saveObjects();
    });
  }

  /*
   * Replace ALL mindconnect agent configurations embedded in the flow file.
   * CANRY RED process will exit after update.
   */
  _updateMindConnectAgentConfiguration(flowFilePath) {
    if (typeof(flowFilePath) !== 'string') {
      // Ignore invalid values
      flowFilePath = null;
    }
    return this.writeResource('/30001/0/102', new Date().toISOString()).then(() => {
      return new Promise((resolve, reject) => {
        RED.log.info(`[CANDY RED] <updateMindConnectAgentConfiguration> Start`);
        flowFilePath = flowFilePath || this.deviceState.flowFilePath;
        if (Array.isArray(flowFilePath)) {
          flowFilePath = flowFilePath[0];
        }
        fs.readFile(flowFilePath, (err, data) => {
          if (err) {
            return reject(err);
          }
          try {
            const flows = JSON.parse(data.toString());
            let agents = flows.filter(f => f.type === 'mindconnect');
            if (agents.length === 0) {
              return reject({ message: 'Nothing to update'});
            }
            this.readResources(`/30001/.*`).then((result) => {
              const mindconnect = result.reduce((accumulator, currentValue) => {
                accumulator[currentValue.uri] = currentValue.value.value;
                return accumulator;
              }, {});
              agents.forEach((agent) => {
                const nodeName = mindconnect['/30001/0/10'];
                agent.name = nodeName || '';
                const clientCredentialProfile = CLIENT_CREDENTIAL_PROFILE[mindconnect['/30001/0/2']];
                agent.configtype = clientCredentialProfile || 'SHARED_SECRET';
                const uploadFileChunks = mindconnect['/30001/0/8'];
                agent.chunk = !!uploadFileChunks;
                const retries = mindconnect['/30001/0/9'];
                agent.retries = retries || 0;
                const dataValidation = mindconnect['/30001/0/6'];
                agent.validate = !!dataValidation;
                const eventValidation = mindconnect['/30001/0/7'];
                agent.validateevent = !!eventValidation;
                const baseUrl = mindconnect['/30001/0/0'] || '';
                const iat = mindconnect['/30001/0/1'] || '';
                const clientId = mindconnect['/30001/0/3'] || '';
                const tenant = mindconnect['/30001/0/4'] || '';
                const expiration = mindconnect['/30001/0/5'] || '';
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
              return resolve(flows);
            });
          } catch (err) {
            return reject(err);
          }
        });
      });
    }).then((flows) => {
      return this.deviceState.updateFlow(flows);
    }).then(() => {
      return this.writeResource('/30001/0/101', 0);
    }).then(() => {
      return this.writeResource('/30001/0/103', new Date().toISOString());
    }).then(() => {
      RED.log.warn('[CANDY RED] <updateMindConnectAgentConfiguration> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!');
      LwM2MDeviceManagement.restart();
    }).catch((err) => {
      RED.log.error(`[CANDY RED] <updateMindConnectAgentConfiguration> err=>${err ? err.message : '(uknown)'}`);
      return this.writeResource('/30001/0/101', 1);
    }).then(() => {
      RED.log.info(`[CANDY RED] <updateMindConnectAgentConfiguration> End`);
      return this.saveObjects();
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
