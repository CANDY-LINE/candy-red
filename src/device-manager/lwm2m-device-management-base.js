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

import 'source-map-support/register';

import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { DeviceState } from './device-state';
import { EventEmitter } from 'events';
import RED from 'node-red';
import consts from './consts';

export class LwM2MDeviceManagementBase {
  constructor(deviceState) {
    this.deviceState = deviceState;
    this.internalEventBus = new EventEmitter();
    this.objects = {};
    this.triggerSaveObjectsTaskHandle = 0;
    this.objectFile = `objects_candy-red.json`;
    this.functionResolver = (key, value) => {
      if (
        key === 'value' &&
        typeof value === 'string' &&
        value.indexOf('[Function]') === 0
      ) {
        const functionName = value.substring(10);
        let f = this[`_${functionName}`];
        if (typeof f === 'function') {
          f = f.bind(this);
          f.functionName = functionName;
          return f;
        } else {
          RED.log.error(
            `[CANDY RED] Failed to assign a function => '_${functionName}'`
          );
          return '';
        }
      }
      return value;
    };
    this.functionReplacer = (_, value) => {
      if (typeof value === 'function') {
        return `[Function]${value.functionName}`;
      } else {
        return value;
      }
    };
    this.objectsLastSavedAt = 0;
  }

  peekLocalValue(objectId, instanceId, resourceId) {
    const res = this._getLocalResource(objectId, instanceId, resourceId);
    if (!res) {
      return null;
    }
    if (typeof res.value === 'function') {
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
      this.internalEventBus.emit('object-read', {
        id: msgId,
        topic: uriRegExp
      });
      this.internalEventBus.once(`object-read-${msgId}`, result => {
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
      this.internalEventBus.emit('object-write', {
        id: msgId,
        topic: uri,
        payload: value
      });
      this.internalEventBus.once(`object-write-${msgId}`, result => {
        if (result.error) {
          return reject(result.payload);
        }
        return resolve(result.payload);
      });
    });
  }

  getSecret() {
    const secret = RED.settings.get('credentialSecret');
    if (secret) {
      return secret;
    } else {
      return RED.settings.get('_credentialSecret');
    }
  }

  decrypt(enc) {
    if (!enc || !enc.$) {
      return enc;
    }
    const value = enc.$;
    const iv = Buffer.from(value.substring(0, 32), 'hex');
    const secret = crypto
      .createHash('sha256')
      .update(this.getSecret())
      .digest();
    const creds = value.substring(32);
    const decipher = crypto.createDecipheriv('aes-256-ctr', secret, iv);
    const data =
      decipher.update(creds, 'base64', 'utf8') + decipher.final('utf8');
    return JSON.parse(data);
  }

  encrypt(value) {
    if (!value) {
      return null;
    }
    const iv = crypto.randomBytes(16);
    const secret = crypto
      .createHash('sha256')
      .update(this.getSecret())
      .digest();
    const cipher = crypto.createCipheriv('aes-256-ctr', secret, iv);
    return {
      $:
        iv.toString('hex') +
        cipher.update(JSON.stringify(value), 'utf8', 'base64') +
        cipher.final('base64')
    };
  }

  triggerSaveObjectsTask() {
    if (this.triggerSaveObjectsTaskHandle) {
      return;
    }
    let timeout = consts.UPDATE_INTERVAL_MS;
    if (Date.now() - this.objectsLastSavedAt > consts.UPDATE_INTERVAL_MS) {
      timeout = 0;
    }
    this.triggerSaveObjectsTaskHandle = setTimeout(async () => {
      this.triggerSaveObjectsTaskHandle = 0;
      await this.syncObjects();
      await this.saveObjects();
    }, timeout);
  }

  async syncObjects() {
    const objectIds = Object.keys(this.objects);
    if (objectIds.length === 0) {
      return 0;
    }
    let numOfUpdates = 0;
    try {
      const result = await this.readResources(`^/(${objectIds.join('|')})/.*$`);
      RED.log.trace(`[CANDY RED] <syncObjects> object reading: ${objectIds}`);
      result
        .filter(r => consts.EXCLUDED_URI_LIST.indexOf(r.uri) < 0)
        .forEach(r => {
          RED.log.trace(`[CANDY RED] <syncObjects> Reading: ${r.uri}`);
          const uri = r.uri.split('/');
          const resultResource = r.value;
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
          if (!resource) {
            instance[resourceId] = resultResource;
            ++numOfUpdates;
          } else if (resource.type !== 'FUNCTION') {
            Object.assign(resource, resultResource);
            ++numOfUpdates;
          }
        });
      RED.log.trace(
        `[CANDY RED] <syncObjects> ${numOfUpdates} resources have been updated!`
      );
    } catch (err) {
      RED.log.warn(
        `[CANDY RED] <syncObjects> Error => ${err.message} ${err.stack}`
      );
    }
    return numOfUpdates;
  }

  loadObjects() {
    return new Promise((resolve, reject) => {
      // load object file
      try {
        const data = fs.readFileSync(`${this.objectFilePath}`);
        const savedObjects = JSON.parse(data.toString(), this.functionResolver);
        const mergedObjectIds = [];
        Object.keys(savedObjects).forEach(objectId => {
          mergedObjectIds.push(objectId);
          const object = savedObjects[objectId];
          if (!this.objects[objectId]) {
            this.objects[objectId] = object;
            return;
          }
          Object.keys(object).forEach(instanceId => {
            const instance = object[instanceId];
            if (!this.objects[objectId][instanceId]) {
              this.objects[objectId][instanceId] = instance;
              return;
            }
            Object.keys(instance).forEach(resourceId => {
              const resource = instance[resourceId];
              this.objects[objectId][instanceId][resourceId] = resource;
            });
          });
        });
        RED.log.info(
          `[CANDY RED] <loadObjects> Merged ObjectIDs => ${mergedObjectIds}`
        );
      } catch (err) {
        if (err.code !== 'ENOENT') {
          return reject(err);
        }
      }
      resolve();
    });
  }

  decryptObjects() {
    Object.keys(this.objects).forEach(objectId => {
      Object.keys(this.objects[objectId]).forEach(instanceId => {
        Object.keys(this.objects[objectId][instanceId]).forEach(resourceId => {
          const resource = this.objects[objectId][instanceId][resourceId];
          if (resource.sensitive && resource.value) {
            try {
              resource.value = this.decrypt(resource.value);
            } catch (err) {
              RED.log.warn(
                `[CANDY RED] <decryptObjects> Failed to decrypt: /${objectId}/${instanceId}/${resourceId}`
              );
            }
          }
        });
      });
    });
  }

  saveObjects() {
    return new Promise(resolve => {
      // save current objects
      try {
        // Clone
        const objects = JSON.parse(
          JSON.stringify(this.objects, this.functionReplacer)
        );
        Object.keys(objects).forEach(objectId => {
          const object = objects[objectId];
          Object.keys(object).forEach(instanceId => {
            const instance = object[instanceId];
            Object.keys(instance).forEach(resourceId => {
              const resource = instance[resourceId];
              if (
                resource.sensitive &&
                resource.value &&
                resource.type !== 'FUNCTION'
              ) {
                if (resource.value.toString().indexOf('[Function]') !== 0) {
                  resource.value = this.encrypt(resource.value);
                }
              }
            });
          });
        });
        let data;
        if (RED.settings.flowFilePretty) {
          data = JSON.stringify(objects, this.functionReplacer, 2);
        } else {
          data = JSON.stringify(objects, this.functionReplacer);
        }
        fs.writeFileSync(`${this.objectFilePath}`, data);
        RED.log.info(
          `[CANDY RED] <saveObjects> Objects have successfully saved to ${this.objectFilePath}`
        );
      } catch (err) {
        RED.log.error(
          `[CANDY RED] <saveObjects> ${err.message || JSON.stringify(err)}`
        );
      }
      this.objectsLastSavedAt = Date.now();
      resolve();
    });
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

  async installFlow(newFlowTabName, newFlowOrPath) {
    RED.log.debug(`[CANDY RED] <installFlow> Start`);
    let newFlow = newFlowOrPath;
    if (typeof newFlowOrPath === 'string') {
      try {
        newFlow = JSON.parse(fs.readFileSync(newFlowOrPath).toString());
      } catch (err) {
        RED.log.info(
          `[CANDY RED] <installFlow> Invalid JSON format, ERROR End. err => ${err.message ||
            err}`
        );
        throw err;
      }
    }
    let flowFilePath = this.deviceState.flowFilePath;
    if (Array.isArray(flowFilePath)) {
      flowFilePath = flowFilePath[0];
    }
    const flows = await new Promise((resolve, reject) => {
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          RED.log.info(
            `[CANDY RED] <installFlow> flowFilePath: ${flowFilePath}, ERROR End. err => ${err.message ||
              err}`
          );
          return reject(err);
        }
        try {
          let flows = JSON.parse(data.toString());
          if (!Array.isArray(flows)) {
            flows = [flows];
          }
          const newFlowExists =
            flows.filter(f => f.type === 'tab' && f.label === newFlowTabName)
              .length > 0;
          if (newFlowExists) {
            RED.log.info(
              `[CANDY RED] <installFlow> The given flow (${newFlowTabName}) is aleady installed`
            );
            return resolve();
          }
          const newFlowTab = newFlow.filter(
            f => f.type === 'tab' && f.label === newFlowTabName
          )[0];
          const newFlowVal = {
            id: newFlowTab.id
          };
          while (
            flows.some(f => f.z === newFlowVal.id || f.id === newFlowVal.id)
          ) {
            newFlowVal.id = `${crypto
              .randomBytes(4)
              .toString('hex')}.${crypto.randomBytes(4).toString('hex')}`;
          }
          newFlow
            .filter(f => f.z === newFlowTab.id)
            .forEach(f => (f.z = newFlowVal.id));
          newFlowTab.id = newFlowVal.id;
          RED.log.info(
            `[CANDY RED] <installFlow> id collision was resolved! New id => ${newFlowTab.id}`
          );
          const packageInfo = this.toPackageInfo(newFlowTab);
          RED.log.info(
            `[CANDY RED] <installFlow> End; Installed App: ${newFlowTabName}@${packageInfo.version}`
          );
          return resolve(flows.concat(newFlow));
        } catch (err) {
          RED.log.info(
            `[CANDY RED] <installFlow> ERROR End. err => ${err.message || err}`
          );
          return reject(err);
        }
      });
    });
    if (flows) {
      await this.deviceState.updateFlow(flows);
      RED.log.warn(
        '[CANDY RED] <installFlow> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!'
      );
      return true;
    }
    RED.log.warn(
      '[CANDY RED] <installFlow> Valid flow is missing. Installation skipped.'
    );
    return false;
  }

  async uninstallFlow(flowTabName) {
    RED.log.debug(`[CANDY RED] <uninstallFlow> Start`);
    let flowFilePath = this.deviceState.flowFilePath;
    if (Array.isArray(flowFilePath)) {
      flowFilePath = flowFilePath[0];
    }
    const flows = await new Promise((resolve, reject) => {
      fs.readFile(flowFilePath, (err, data) => {
        if (err) {
          RED.log.info(
            `[CANDY RED] <uninstallFlow> flowFilePath: ${flowFilePath}, ERROR End. err => ${err.message ||
              err}`
          );
          return reject(err);
        }
        try {
          const flows = JSON.parse(data.toString());
          const flowTab = flows.filter(
            f => f.type === 'tab' && f.label === flowTabName
          )[0];
          if (!flowTab) {
            RED.log.info(
              `[CANDY RED] <uninstallFlow> The given flow (${flowTabName}) is aleady gone`
            );
            return resolve();
          }
          let globalNodeIds = flows.filter(f => f.z === '').map(f => f.id);
          let toBeRemoved = [];
          RED.log.debug(
            `[CANDY RED] <uninstallFlow> flowTab.id: ${flowTab.id}, globalNodeIds: ${globalNodeIds}`
          );
          flows
            .filter(f => f.z === flowTab.id)
            .some(f => {
              const found = [];
              globalNodeIds.some(id => {
                if (Object.values(f).includes(id)) {
                  found.push(id);
                  return true; // break
                }
              });
              globalNodeIds = globalNodeIds.filter(id => !found.includes(id));
              toBeRemoved = toBeRemoved.concat(found);
              if (globalNodeIds.length < 1) {
                return true; // break
              }
            });
          RED.log.debug(
            `[CANDY RED] <uninstallFlow> toBeRemoved: ${toBeRemoved}`
          );
          const newFlow = flows.filter(
            f =>
              f.z !== flowTab.id &&
              f.id !== flowTab.id &&
              !toBeRemoved.includes(f.id)
          );
          const packageInfo = this.toPackageInfo(flowTab);
          RED.log.info(
            `[CANDY RED] <uninstallFlow> End; Uninstalled App: ${flowTabName}@${packageInfo.version}`
          );
          return resolve(newFlow);
        } catch (err) {
          RED.log.info(
            `[CANDY RED] <uninstallFlow> ERROR End. err => ${err.message ||
              err}`
          );
          return reject(err);
        }
      });
    });
    if (flows) {
      await this.deviceState.updateFlow(flows);
      try {
        // Remove Credentials file as well
        fs.unlinkSync(this.credentialFilePath);
      } catch (_) {
        // ignore
      }
      RED.log.warn(
        '[CANDY RED] <uninstallFlow> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!'
      );
      return true;
    }
    return false;
  }

  async syncFlows(c) {
    const result = await new Promise((resolve, reject) => {
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
                this._updateLocalFlows(flows)
                  .then(result => {
                    return resolve(result);
                  })
                  .catch(err => {
                    return reject(err);
                  });
              } else {
                return resolve({ data: DeviceState.flowsToString(flows) });
              }
            });
          }
        } else if (
          this.deviceState.flowFileSignature !== c.args.expectedSignature
        ) {
          // non-primary accounts are NOT allowed to download (to be delivered) flow files
          if (!this.primary) {
            return reject({ status: 405, message: 'not the primary account' });
          }
          return reject({
            status: 202,
            commands: {
              cat: 'sys',
              act: 'deliverflows',
              args: {
                flowId: c.args.flowId
              }
            }
          });
        } else {
          // 304 Not Modified
          return reject({ status: 304 });
        }
      } catch (err) {
        return reject(err);
      }
    });
    return new Promise(resolve => {
      let status = {
        status: 202,
        commands: {
          cat: 'sys',
          act: 'updateflows',
          args: {
            name: path.basename(this.deviceState.flowFilePath),
            signature: this.deviceState.flowFileSignature,
            content: result.data
          },
          done: result.done
        }
      };
      return resolve(status);
    });
  }
}
