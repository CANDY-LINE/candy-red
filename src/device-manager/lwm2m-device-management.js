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
import request from 'request';
import RED from 'node-red';
import si from 'systeminformation';
import consts from './consts';
import { LwM2MDeviceManagementBase } from './lwm2m-device-management-base';

export class LwM2MDeviceManagement extends LwM2MDeviceManagementBase {
  static restart() {
    // systemctl shuould restart the service
    setTimeout(() => {
      process.exit(219);
    }, consts.REBOOT_DELAY_MS);
  }

  static stop() {
    // systemctl shuould stop the service
    setTimeout(() => {
      process.exit(10);
    }, consts.REBOOT_DELAY_MS);
  }

  constructor(deviceState) {
    super(deviceState);
    this.modemInfo = {};
    this.candyPiBoardInfo = {};
    this.tasks = {};
    this.settings = {};
  }

  async init(settings) {
    this.settings = Object.assign(this.settings, settings);
    this.objectFilePath = `${settings.userDir}/${this.objectFile}`;
    this.credentialFilePath = `${settings.userDir}/lwm2m_dm_cred.json`;
    let enableDM = false;
    if (
      this.deviceState.candyBoardServiceSupported &&
      process.env.DEVICE_MANAGEMENT_ENABLED === 'true'
    ) {
      enableDM = true;
    }
    if (
      process.env.DEVEL !== 'true' &&
      process.env.DEVICE_MANAGEMENT_BS_DTLS !== 'PSK'
    ) {
      enableDM = false;
    }
    if (enableDM) {
      RED.log.info(`[CANDY RED] DM enabled. Setup started.`);
      // setup DM flow
      await this.setupDMFlow();

      RED.log.info(`[CANDY RED] Collecting system info.`);
      const { model, version } = await si.system();
      this.candyPiBoardInfo.boardProductName = `${model} ${version}`;
      const {
        distro,
        release,
        codename,
        logofile,
        kernel,
        arch
      } = await si.osInfo();
      this.candyPiBoardInfo.osName = distro;
      this.candyPiBoardInfo.osVersion = `${release} ${codename}`;
      this.candyPiBoardInfo.osId = logofile;
      this.candyPiBoardInfo.kernel = kernel;
      this.candyPiBoardInfo.arch = arch;

      await new Promise(resolve => {
        RED.log.info(`[CANDY RED] Collecting modem info.`);
        fs.readFile(consts.MODEM_INFO_FILE_PATH, (err, data) => {
          // Read a modem info file to retrieve IMEI when online
          if (err) {
            // Run candy modem show to retrieve IMEI when offline
            let retry = 0;
            const command = () => {
              this.deviceState
                ._candyRun('modem', 'show', 0, false, '-s', '-r')
                .then(result => {
                  this.modemInfo = result.output;
                  resolve();
                })
                .catch(err => {
                  if (retry < 120 && (err.code === 1 || err.code === 2)) {
                    setTimeout(command, 5000);
                    retry++;
                  } else {
                    RED.log.error(
                      `[CANDY RED] Failed to run candy modem show command => ${err.message ||
                        JSON.stringify(err)}`
                    );
                    if (process.env.DEVEL === 'true') {
                      this.modemInfo = {};
                      resolve();
                    } else {
                      return LwM2MDeviceManagement.stop();
                    }
                  }
                });
            };
            process.nextTick(command);
          } else {
            let dataString = data.toString().trim();
            try {
              this.modemInfo = JSON.parse(dataString).result;
            } catch (_) {
              RED.log.error(
                `[CANDY RED] Unexpected modem info => [${dataString}]`
              );
            }
            resolve();
          }
        });
      });
      this.internalEventBus.on('configure', context => {
        RED.log.info(`[CANDY RED] Starting DM configuration.`);
        this.decryptObjects();
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
        config.clientPort = parseInt(
          process.env.DEVICE_MANAGEMENT_CL_PORT || 57830
        );
        config.reconnectSec = parseInt(
          process.env.DEVICE_MANAGEMENT_RECONNECT_SEC || 300
        );
        config.bootstrapIntervalSec = parseInt(
          process.env.DEVICE_MANAGEMENT_BOOTSTRAP_INTERVAL_SEC || 3600
        );
        config.serverHost = process.env.DEVICE_MANAGEMENT_BS_HOST;
        config.serverPort = process.env.DEVICE_MANAGEMENT_BS_PORT;
        config.enableDTLS = process.env.DEVICE_MANAGEMENT_BS_DTLS === 'PSK';
        if (config.enableDTLS) {
          config.pskIdentity =
            process.env.DEVICE_MANAGEMENT_BS_DTLS_PSK_ID || config.clientName;
          config.presharedKey =
            process.env.DEVICE_MANAGEMENT_BS_DTLS_PSK || config.clientName;
        }
        config.requestBootstrap = true;
        config.saveProvisionedConfig = true;
        config.useIPv4 = process.env.DEVICE_MANAGEMENT_BS_HOST_IPV6 !== 'true';
        if (
          this.settings.logging &&
          this.settings.logging.console &&
          (this.settings.logging.console.level === 'debug' ||
            this.settings.logging.console.level === 'trace')
        ) {
          config.redirectLwm2mClientLog = true;
          config.dumpLwm2mMessages = true;
        }
        config.hideSensitiveInfo = false;
        config.credentialFilePath = this.credentialFilePath;
        // Wait until ppp0 goes online when DEVICE_MANAGEMENT_EXCLUSIVE_TO_MOBILE_NETWORK is true
        let p;
        if (
          process.env.DEVICE_MANAGEMENT_EXCLUSIVE_TO_MOBILE_NETWORK === 'true'
        ) {
          p = new Promise(resolve => {
            let retry = 0;
            const command = () => {
              this.deviceState
                ._candyRun('connection', 'status', 0, true)
                .then(result => {
                  RED.log.trace(
                    `[CANDY RED] candy connection status => [${result.output}]`
                  );
                  if (result.output === 'ONLINE') {
                    resolve();
                  } else {
                    const err = {
                      code: 1,
                      message: 'Still OFFLINE'
                    };
                    throw err;
                  }
                })
                .catch(err => {
                  if (
                    retry < consts.MAX_MOBILE_NETWORK_CONN_RETRY &&
                    (err.code === 1 || err.code === 2)
                  ) {
                    setTimeout(command, 5000);
                    retry++;
                  } else {
                    RED.log.error(
                      `[CANDY RED] Connection Timeout => ${err.message ||
                        JSON.stringify(err)}`
                    );
                    RED.log.error(`[CANDY RED] This service is terminated.`);
                    return LwM2MDeviceManagement.stop();
                  }
                });
            };
            process.nextTick(command);
          });
        } else {
          p = Promise.resolve();
        }
        p.then(() => {
          this.internalEventBus.emit('configurationDone', config);
        });
      });
      this.internalEventBus.on('object-event', ev => {
        RED.log.debug(`[CANDY RED] object-event => ${JSON.stringify(ev)}`);
        switch (ev.eventType) {
          case 'updated':
          case 'deleted':
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
                if (res.value && typeof res.value === 'function') {
                  return res.value(ev.value);
                }
              }
            }
            RED.log.debug(
              `[CANDY RED] Internal function associated with ${
                ev.uri
              } is missing.: ${JSON.stringify(ev)}`
            );
            break;
          }
          default:
        }
      });
      await new Promise((resolve, reject) => {
        // load MO files
        fs.readdir(`${__dirname}/mo`, (err, dirs) => {
          if (err) {
            RED.log.error(`[CANDY RED] Failed to load MO files`);
            return reject(err);
          }
          dirs
            .filter(name => name.indexOf('.json') > 0)
            .forEach(name => {
              try {
                const data = fs.readFileSync(`${__dirname}/mo/${name}`);
                const mo = JSON.parse(data.toString(), this.functionResolver);
                Object.keys(mo).forEach(objectId => {
                  if (this.objects[objectId]) {
                    RED.log.warn(
                      `[CANDY RED] DUPLICATE ENTRY for the same ObjectID: ${objectId}. This will cause unexpected behaviors.`
                    );
                  }
                });
                Object.assign(this.objects, mo);
                RED.log.info(
                  `[CANDY RED] Loaded ObjectIDs => ${Object.keys(
                    mo
                  )} from [${name}]`
                );
              } catch (err) {
                RED.log.error(
                  `[CANDY RED] Failed to load a MO file: ${name} (${err.message ||
                    err})`
                );
              }
            });
          return resolve();
        });
      });
      await this.loadObjects();
      return this.saveObjects();
    } else {
      // Reset DM flow if exists
      return this.stripDMFlow();
    }
  }

  async setupDMFlow() {
    const installed = await this.installFlow('CANDY LINE DM', consts.DM_FLOW);
    if (installed) {
      LwM2MDeviceManagement.restart();
    }
  }

  async stripDMFlow() {
    const uninstalled = await this.uninstallFlow('CANDY LINE DM');
    if (uninstalled) {
      LwM2MDeviceManagement.restart();
    }
  }

  _connectivityStatisticsStart() {
    RED.log.debug(`[CANDY RED] <connectivityStatisticsStart> Start`);
    // TODO reset tx/rx counter
    RED.log.debug(`[CANDY RED] <connectivityStatisticsStart> End`);
  }

  _resolveCANDYLINEManufacturer() {
    return process.env.DEVICE_MANAGEMENT_MANUFACTURER || 'CANDY LINE';
  }

  _resolveCANDYLINEModel() {
    return (
      process.env.DEVICE_MANAGEMENT_MODEL || this._resolveCANDYLINEProductName()
    );
  }

  _resolveCANDYLINEProductName() {
    let name = consts.MODULE_MODEL_MAPPINGS[this.modemInfo.model];
    if (!name) {
      name = `Unknown${
        this.modemInfo.model ? ` (${this.modemInfo.model})` : ''
      }`;
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

  _resolveBoardProductName() {
    return this.candyPiBoardInfo.boardProductName || 'N/A';
  }

  _resolveOSName() {
    return this.candyPiBoardInfo.osName || 'N/A';
  }

  _resolveOSVersion() {
    return this.candyPiBoardInfo.osVersion || 'N/A';
  }

  _resolveOSID() {
    return this.candyPiBoardInfo.osId || 'N/A';
  }

  _resolveLinuxKernelRelease() {
    return this.candyPiBoardInfo.kernel || 'N/A';
  }

  _resolveProcessorArchitecture() {
    return this.candyPiBoardInfo.arch || 'N/A';
  }

  _applyConfigChanges() {
    throw new Error('Unsupported Operation: applyConfigChanges()');
  }

  _resolveTotalBytesSent() {
    // TODO
    return -1;
  }

  _resolveTotalBytesReceived() {
    // TODO
    return -1;
  }

  _resolveCANDYREDVersion() {
    return this.settings.version;
  }

  async _restartCANDYRED() {
    RED.log.debug(`[CANDY RED] <_restartCANDYRED> Start`);
    try {
      RED.log.warn(`[CANDY RED] ** ** Process exits for restarting ** **`);
      await this.syncObjects();
      await this.saveObjects();
      LwM2MDeviceManagement.restart();
      await this.writeResource('/42805/0/21', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_restartCANDYRED> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/21', 1);
    }
    RED.log.debug(`[CANDY RED] <_restartCANDYRED> End`);
  }

  async _stopCANDYRED() {
    RED.log.debug(`[CANDY RED] <_stopCANDYRED> Start`);
    try {
      RED.log.warn(
        `[CANDY RED] ** ** Process exits for stopping service ** **`
      );
      await this.syncObjects();
      await this.saveObjects();
      LwM2MDeviceManagement.stop();
      await this.writeResource('/42805/0/31', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_stopCANDYRED> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/31', 1);
    }
    RED.log.debug(`[CANDY RED] <_stopCANDYRED> End`);
  }

  _argsToString(src) {
    switch (typeof src) {
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

  async _enableApplicationFlow(args) {
    RED.log.debug(
      `[CANDY RED] <_enableApplicationFlow> Start; args => ${JSON.stringify(
        args
      )}`
    );
    const pkg = this._argsToObject(args) || {};
    RED.log.warn(
      `[CANDY RED] TODO (_enableApplicationFlow) pkg => ${JSON.stringify(
        pkg
      )}, DO NOTHING!`
    );
    try {
      // TODO code goes here.
      await this.writeResource('/42805/0/27', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_enableApplicationFlow> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/27', 1);
    }
    RED.log.debug(`[CANDY RED] <_enableApplicationFlow> End`);
  }

  async _disableApplicationFlow(args) {
    RED.log.debug(
      `[CANDY RED] <_disableApplicationFlow> Start; args => ${JSON.stringify(
        args
      )}`
    );
    const pkg = this._argsToObject(args) || {};
    RED.log.warn(
      `[CANDY RED] TODO (_disableApplicationFlow) pkg => ${JSON.stringify(
        pkg
      )}, DO NOTHING!`
    );
    try {
      // TODO code goes here.
      await this.writeResource('/42805/0/29', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_disableApplicationFlow> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/29', 1);
    }
    RED.log.debug(`[CANDY RED] <_disableApplicationFlow> End`);
  }

  async _downloadFlowOrParse(args) {
    const pkg = this._argsToObject(args) || {};
    const resources = await this.readResources('^/42805/0/(2|3|4|5|6)$');
    const packageInfo = resources.reduce((accumulator, currentValue) => {
      accumulator[currentValue.uri] = currentValue.value.value;
      return accumulator;
    }, {});
    // eslint-disable-next-line require-atomic-updates
    pkg.flowTabName = pkg.flowTabName || packageInfo['/42805/0/2'];
    if (!pkg.flowTabName) {
      throw new Error(`Flow tab name is missing`);
    }
    if (packageInfo['/42805/0/5'] /* Application Flow Content */) {
      try {
        // eslint-disable-next-line require-atomic-updates
        pkg.flow = JSON.parse(packageInfo['/42805/0/5'].toString());
        return pkg;
      } catch (_) {
        // Ignore parse error
      }
    }
    if (!packageInfo['/42805/0/3'] /* Application Flow Download URL */) {
      throw new Error(`Cannot download flow as url is missing!`);
    }
    const headers = {};
    if (packageInfo['/42805/0/4'] /* Download/Upload Access HTTP Headers */) {
      Object.keys(packageInfo['/42805/0/4']).forEach(id => {
        const headerDef = packageInfo['/42805/0/4'][id].value;
        if (headerDef) {
          const elements = headerDef.split(':');
          headers[elements[0].trim()] = elements[1].trim();
        }
      });
    }
    return new Promise((resolve, reject) => {
      const url = packageInfo['/42805/0/3'];
      if (
        (process.env.DEVEL === 'true' && url.indexOf('http://') >= 0) ||
        url.indexOf('https://') >= 0
      ) {
        request(
          url,
          {
            headers: headers
          },
          (err, res, body) => {
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
            } catch (_) {
              return reject(`Invalid JSON: ${body}`);
            }
          }
        );
      } else if (url.indexOf('file://') >= 0) {
        fs.readFile(url.substring(7), (err, data) => {
          if (err) {
            return reject(`Invalid Path: ${url}`);
          }
          try {
            pkg.flow = JSON.parse(data);
            return resolve(pkg);
          } catch (_) {
            return reject(`Invalid JSON: ${data.toString()}`);
          }
        });
      } else {
        return reject({ message: `Unsupported protocol scheme: ${url}` });
      }
    });
  }

  async _downloadAndInstallApplicationFlow(args) {
    RED.log.debug(
      `[CANDY RED] <_downloadAndInstallApplicationFlow> Start; args => ${JSON.stringify(
        args
      )}`
    );
    try {
      const result = await this._downloadFlowOrParse(args);
      await this.installFlow(result.flowTabName, result.flow);
      await this.writeResource('/42805/0/23', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_downloadAndInstallApplicationFlow> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/23', 1);
    }
    RED.log.debug(`[CANDY RED] <_downloadAndInstallApplicationFlow> End`);
    return this.saveObjects();
  }

  async _uninstallApplicationFlow(args) {
    RED.log.debug(
      `[CANDY RED] <_uninstallApplicationFlow> Start; args => ${JSON.stringify(
        args
      )}`
    );
    try {
      const pkg = this._argsToObject(args) || {};
      const resources = await this.readResources('^/42805/0/(2|3|4|5|6)$');
      const packageInfo = resources.reduce((accumulator, currentValue) => {
        accumulator[currentValue.uri] = currentValue.value.value;
        return accumulator;
      }, {});
      // eslint-disable-next-line require-atomic-updates
      pkg.flowTabName = pkg.flowTabName || packageInfo['/42805/0/2'];
      if (pkg.flowTabName) {
        await this.uninstallFlow(pkg.flowTabName);
        await this.writeResource('/42805/0/25', 0);
      } else {
        await this.writeResource('/42805/0/25', 1);
      }
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_uninstallApplicationFlow> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/25', 2);
    }
    RED.log.debug(`[CANDY RED] <_uninstallApplicationFlow> End`);
    return this.saveObjects();
  }

  async _updateApplicationFlowList() {
    RED.log.debug(`[CANDY RED] <_updateApplicationFlowList> Start`);
    try {
      await new Promise((resolve, reject) => {
        fs.readFile(this.deviceState.flowFilePath, async (err, data) => {
          if (err) {
            return reject(err);
          }
          try {
            const flows = JSON.parse(data.toString());
            await this.writeResource(
              '/42805/0/7',
              // String array (MULTIPLE_RESOURCE)
              flows
                .filter(f => f.type === 'tab')
                .map(f => {
                  return f.label;
                })
            );
            return resolve();
          } catch (err) {
            return reject(err);
          }
        });
      });
      await this.writeResource('/42805/0/27', 0);
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <_updateApplicationFlowList> err=>${
          err ? (err.message ? err.message : err) : '(uknown)'
        }`
      );
      await this.writeResource('/42805/0/27', 1);
    }
    RED.log.debug(`[CANDY RED] <_updateApplicationFlowList> End`);
    return this.saveObjects();
  }

  /*
   * Replace ALL mindconnect agent configurations embedded in the flow file.
   * CANRY RED process should exit after update (not restart in this function though)
   */
  async _updateMindConnectAgentConfiguration(flowFilePath) {
    RED.log.debug(`[CANDY RED] <updateMindConnectAgentConfiguration> Start`);
    if (typeof flowFilePath !== 'string') {
      // Ignore invalid values
      flowFilePath = null;
    }
    try {
      await this.writeResource('/43001/0/102', new Date().toISOString());
      const flows = await new Promise((resolve, reject) => {
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
              return reject({ message: 'No mindconnect nodes to be modified' });
            }
            this.readResources(`/43001/.*`).then(result => {
              const mindconnect = result.reduce((accumulator, currentValue) => {
                accumulator[currentValue.uri] = currentValue.value.value;
                return accumulator;
              }, {});
              agents.forEach(agent => {
                const nodeName = mindconnect['/43001/0/10'];
                agent.name = nodeName || '';
                const clientCredentialProfile =
                  consts.CLIENT_CREDENTIAL_PROFILE[mindconnect['/43001/0/2']];
                agent.configtype = clientCredentialProfile || 'SHARED_SECRET';
                const uploadFileChunks = mindconnect['/43001/0/8'];
                agent.chunk = !!uploadFileChunks;
                const retry = mindconnect['/43001/0/9'];
                agent.retry = retry || 0;
                const dataValidation = mindconnect['/43001/0/6'];
                agent.validate = !!dataValidation;
                const eventValidation = mindconnect['/43001/0/7'];
                agent.validateevent = !!eventValidation;
                const baseUrl = mindconnect['/43001/0/0'] || '';
                const iat = mindconnect['/43001/0/1'] || '';
                const clientId = mindconnect['/43001/0/3'] || '';
                const tenant = mindconnect['/43001/0/4'] || '';
                const expiration = mindconnect['/43001/0/5'] || '';
                const agentconfig = {
                  content: {
                    baseUrl: baseUrl,
                    iat: iat,
                    clientCredentialProfile: [clientCredentialProfile],
                    clientId: clientId,
                    tenant: tenant
                  },
                  expiration: expiration
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
      await this.deviceState.updateFlow(flows);
      await this.writeResource('/43001/0/101', 0);
      await this.writeResource('/43001/0/103', new Date().toISOString());
      RED.log.warn(
        '[CANDY RED] <updateMindConnectAgentConfiguration> FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!'
      );
    } catch (err) {
      RED.log.error(
        `[CANDY RED] <updateMindConnectAgentConfiguration> err=>${
          err ? err.message : '(uknown)'
        }`
      );
      await this.writeResource('/43001/0/101', 1);
    }
    RED.log.debug(`[CANDY RED] <updateMindConnectAgentConfiguration> End`);
    await this.saveObjects();
  }
}
