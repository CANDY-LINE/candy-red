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
import http from 'http';
import request from 'request';
import express from 'express';
import RED from 'node-red';
import os from 'os';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { DeviceManagerStore } from './device-manager';
import { SingleUserAuthenticator, PAMAuthenticator } from './auth';

// Listen port
const PORT = process.env.PORT || 8100;
const DEFAULT_PACKAGE_JSON = __dirname + '/../package.json';
const DEFAULT_WELCOME_FLOW = __dirname + '/welcome-flow.json';
const NODE_PALETTE_ENABLED = process.env.NODE_PALETTE_ENABLED ? process.env.NODE_PALETTE_ENABLED === 'true' : false;
const NODE_RED_PROJECTS_ENABLED = process.env.NODE_RED_PROJECTS_ENABLED ? process.env.NODE_RED_PROJECTS_ENABLED === 'true' : false;
const CANDY_RED_SESSION_TIMEOUT = parseInt(process.env.CANDY_RED_SESSION_TIMEOUT || 86400);
const CANDY_RED_ADMIN_USER_ID = process.env.CANDY_RED_ADMIN_USER_ID;
const CANDY_RED_ADMIN_PASSWORD_ENC = process.env.CANDY_RED_ADMIN_PASSWORD_ENC;
const CANDY_RED_LOG_LEVEL = process.env.CANDY_RED_LOG_LEVEL || 'info';
const CANDY_RED_BIND_IPV4_ADDR = process.env.CANDY_RED_BIND_IPV4_ADDR ? process.env.CANDY_RED_BIND_IPV4_ADDR === 'true' : false;
const NODE_ENV = process.env.NODE_ENV || '';

export class CandyRed {
  constructor(packageJsonPath) {
    // Create an Express app
    this.app = express();
    // Create a server
    this.server = http.createServer(this.app);

    // Device Management
    this.deviceManagerStore = new DeviceManagerStore();

    // path to package.json
    this.packageJsonPath = packageJsonPath;

    // Flow file name
    this.flowFile = 'flows_candy-red.json';
  }

  _migrateFlowFile(userDir) {
    return new Promise((resolve, reject) => {
      if (!this.flowFile) {
        return reject(new Error('Missing this.flowFile!'));
      }
      if (os.hostname() === 'cred') {
        return resolve();
      }
      let newPath = `${userDir}/${this.flowFile}`;
      let oldPath = `${userDir}/flows_candy-red_${os.hostname()}.json`;
      fs.rename(oldPath, newPath, err => {
        if (err) {
          let oldPath = `${userDir}/flows_candy-box_${os.hostname()}.json`;
          fs.rename(oldPath, newPath, err => {
            if (!err) {
              console.log(`[CANDY RED] {MIGRATED} ${oldPath} => ${newPath}`);
            }
            resolve();
          });
        } else {
          console.log(`[CANDY RED] {MIGRATED} ${oldPath} => ${newPath}`);
          resolve();
        }
      });
    });
  }

  _prepareWelcomeFlowFileReadStream() {
    return new Promise((resolve, reject) => {
      let url = process.env.WELCOME_FLOW_URL;
      if (url && (url.indexOf('http://') || url.indexOf('https://'))) {
        let req = request.get(url);
        req.on('error', err => {
          try {
            return resolve(fs.createReadStream(DEFAULT_WELCOME_FLOW));
          } catch (err) {
            return reject(err);
          }
        });
        return resolve(req);
      } else {
        try {
          return resolve(fs.createReadStream(DEFAULT_WELCOME_FLOW));
        } catch (err) {
          return reject(err);
        }
      }
    });
  }

  _prepareDefaultFlowFile(userDir) {
    return new Promise((resolve, reject) => {
      fs.stat(userDir, err => {
        if (err) {
          mkdirp(userDir, err => {
            if (err) {
              return reject(err);
            }
            return resolve();
          });
        }
        return resolve();
      });
    }).then(() => {
      return new Promise((resolve, reject) => {
        let flowFile = `${userDir}/${this.flowFile}`;
        fs.stat(flowFile, err => {
          if (err) {
            this._prepareWelcomeFlowFileReadStream().then(reader => {
              let writer = fs.createWriteStream(flowFile);
              reader.pipe(writer);
              writer.on('close', () => {
                fs.readFile(flowFile, (err, data) => {
                  if (err) {
                    return reject(err);
                  }
                  try {
                    JSON.parse(data);
                    console.log('[CANDY RED] Default welcome flow has been created');
                    resolve();
                  } catch (_) {
                    fs.writeFile(flowFile, '[]', { flag : 'w' }, err => {
                      if (err) {
                        return reject(err);
                      }
                      console.log('[CANDY RED] {WARN} Wrong JSON format in thhe welcome flow');
                      resolve();
                    });
                  }
                });
              });
            }).catch(err => {
              reject(err);
            });
          } else {
            return resolve();
          }
        });
      });
    });
  }

  start() {
    if (CANDY_RED_BIND_IPV4_ADDR) {
      this.server.listen(PORT, '0.0.0.0');
    } else {
      this.server.listen(PORT);
    }
    this._setupExitHandler();
    return this._inspectBoardStatus(this.packageJsonPath).then(versions => {
      return new Promise((resolve, reject) => {
        // Create the settings object - see default settings.js file for other options
        let settings = this._createREDSettigngs(versions);
        // Flow File Name Spec. Change Migration
        this._migrateFlowFile(settings.userDir).then(() => {
          return this._prepareDefaultFlowFile(settings.userDir);
        }).then(() => {
          resolve([settings, versions]);
        }).catch(err => {
          reject(err);
        });
      });
    }).then(args => {
      let settings = args[0];
      let versions = args[1];

      // Initialise the runtime with a server and settings
      RED.init(this.server, settings);
      settings.version += ` [candy-red v${versions.candyRedv}]`;

      // Serve the http nodes from /api
      this.app.use(settings.httpNodeRoot, RED.httpNode);

      const flowFilePath = settings.userDir + '/' + this.flowFile;
      return this.deviceManagerStore.deviceState.initWithFlowFilePath(flowFilePath).then(() => {
        return this.deviceManagerStore.lwm2m.init(settings);
      }).then(() => {
        const headlessEnabled = this.deviceManagerStore.lwm2m.peekLocalValue(42805, 0, 1);
        RED.log.info(`[CANDY RED] Headless Enabled? => ${headlessEnabled}`);
        if (!headlessEnabled) {
          RED.log.info(`[CANDY RED] Deploying Flow Editor UI...`);
          // Add a simple route for static content served from 'public'
          this.app.use('/', express.static(__dirname + '/public'));
          if (settings.httpAdminRoot) {
            this.app.get('/', (_, res) => {
              res.redirect(settings.httpAdminRoot);
            });
          }
          // Serve the editor UI from /red
          this.app.use(settings.httpAdminRoot, RED.httpAdmin);
        }

        // Start the runtime
        return RED.start();
      }).then(() => {
        RED.log.info(`[CANDY RED] Listen port=${PORT}`);
      });
    });
  }

  _createCandyRedEditorTheme(deviceId) {
    let name = os.hostname();
    let longname = name;
    if (deviceId) {
      name = deviceId;
      longname = `${os.hostname()} (${name})`;
    }
    return {
      palette: {
        editable: NODE_PALETTE_ENABLED
      },
      projects: {
        enabled: NODE_RED_PROJECTS_ENABLED
      },
      page: {
        title: 'CANDY RED@' + name,
        favicon: __dirname + '/public/images/candy-red.ico',
        css: __dirname + '/public/css/candy-red.css'
      },
      header: {
        title: ' ** ' + longname + ' **',
        image: __dirname + '/public/images/candy-red.png'
      },
      login: {
        image: __dirname + '/public/images/logo.png'
      },
      menu: {
        'menu-item-help': {
          label: 'Users Forum',
          url: 'https://forums.candy-line.io/c/candy-red'
        },
        'menu-item-keyboard-shortcuts': true
      }
    };
  }

  _inspectBoardStatus(inputPackageJsonPath) {
    return Promise.all([
      this.deviceManagerStore.deviceState.testIfCANDYBoardServiceInstalled('candy-pi-lite'),
    ]).then(results => {
      let deviceId;
      if (results[0][0]) {
        deviceId = results[0][0];
      }
      this.editorTheme = this._createCandyRedEditorTheme(deviceId);
      deviceId = deviceId || 'N/A';
      return new Promise((resolve, reject) => {
        fs.stat(inputPackageJsonPath, err => {
          if (err) {
            return reject(err);
          }
          return resolve(inputPackageJsonPath);
        });
      }).then(packageJsonPath => {
        return new Promise(resolve => {
          fs.readFile(packageJsonPath, (err, data) => {
            if (err) {
              return resolve({
                candyRedv: 'N/A'
              });
            }
            let packageJson = JSON.parse(data);
            return resolve({
              deviceId: deviceId,
              candyRedv: packageJson.version || 'N/A'
            });
          });
        });
      });
    });
  }

  _setupExitHandler() {
    // Exit handler
    process.stdin.resume();
    function exitHandler(err) {
      console.log('[CANDY RED] Bye');
      if (RED.settings && RED.settings.exitHandlers) {
        RED.settings.exitHandlers.forEach((handler) => {
          try {
            handler(RED);
          } catch (err) {
            console.log(`[CANDY RED] The error [${err}] is ignored`);
            console.log(`[CANDY RED] ${err.stack}`);
          }
        });
      }
      if (err instanceof Error) {
        console.log(err.stack);
        process.exit(1);
      } else if (isNaN(err)) {
        process.exit();
      } else {
        process.exit(err);
      }
    }
    process.on('SIGINT', exitHandler);
    process.on('uncaughtException', exitHandler);
    process.on('unhandledRejection', (err) => {
      console.log('[CANDY RED] {FATAL} unhandledRejection', err);
    });
  }

  _createREDSettigngs(versions) {
    let settings = {
      flowFilePretty: true,
      verbose: true,
      disableEditor: false,
      httpAdminRoot: '/red/',
      httpNodeRoot: '/api/',
      userDir: (process.env.CANDY_RED_HOME || process.env.HOME || process.env.USERPROFILE) + '/.node-red',
      flowFile: this.flowFile,
      functionGlobalContext: {
      },
      exitHandlers: [],
      nodesExcludes: [
      ],
      deviceManagerStore: this.deviceManagerStore,
      editorTheme: this.editorTheme,
      candyRedVersion: versions.candyRedv,
      deviceId: versions.deviceId,
      logging: {
        console: {
          level: CANDY_RED_LOG_LEVEL,
          metrics: false,
          audit: false
        }
      },
      lwm2m: this.deviceManagerStore.lwm2m
    };

    if (CANDY_RED_ADMIN_USER_ID && CANDY_RED_ADMIN_PASSWORD_ENC) {
      let userAuth = new SingleUserAuthenticator(
        CANDY_RED_SESSION_TIMEOUT, CANDY_RED_ADMIN_USER_ID, CANDY_RED_ADMIN_PASSWORD_ENC);
      settings.adminAuth = userAuth.init();
      this.app.use(settings.httpNodeRoot, userAuth.apiBasicAuthMiddleware.bind(userAuth));
      console.log(`[CANDY RED] Using the user:${CANDY_RED_ADMIN_USER_ID} credentials for authentication, session expires after ${CANDY_RED_SESSION_TIMEOUT} seconds`);
    } else if (NODE_ENV === 'production') {
      let pamAuth = new PAMAuthenticator(CANDY_RED_SESSION_TIMEOUT);
      settings.adminAuth = pamAuth.init();
      this.app.use(settings.httpNodeRoot, pamAuth.apiBasicAuthMiddleware.bind(pamAuth));
      console.log(`[CANDY RED] Using PAM for authentication`);
    } else {
      console.log(`[CANDY RED] Authentication is disabled`);
    }

    return settings;
  }

}

// main
if (require.main === module) {
  let packageJsonPath = DEFAULT_PACKAGE_JSON;
  if (process.argv.length > 2) {
    packageJsonPath = process.argv[2];
  }
  let app = new CandyRed(packageJsonPath);
  app.start().catch(err => {
    console.error(err.stack);
    process.exit(1);
  });
}
