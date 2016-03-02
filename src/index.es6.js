'use strict';

import 'source-map-support/register';
import Promise from 'es6-promises';
import http from 'http';
import express from 'express';
import RED from 'node-red';
import os from 'os';
import fs from 'fs';
import { DeviceManagerStore } from './device-manager';

// Listen port
const PORT = process.env.PORT || 8100;
const DEFAULT_PACKAGE_JSON = __dirname + '/../package.json';

export class CandyRed {
  constructor(packageJsonPath) {
    // Create an Express app
    this.app = express();
    // Create a server
    this.server = http.createServer(this.app);

    // Device Management
    this.deviceManagerStore = new DeviceManagerStore(RED);

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
      let newPath = `${userDir}/${this.flowFile}`;
      let oldPath = `${userDir}/flows_candy-red_${os.hostname()}.json`;
      fs.rename(oldPath, newPath, err => {
        if (err) {
          let oldPath = `${userDir}/flows_candy-box_${os.hostname()}.json`;
          fs.rename(oldPath, newPath, () => {
            RED.log.info(`[MIGRATED] ${oldPath} => ${newPath}`);
            resolve();
          });
        } else {
          RED.log.info(`[MIGRATED] ${oldPath} => ${newPath}`);
          resolve();
        }
      });
    });
  }

  start() {
    this.server.listen(PORT);
    this._setupExitHandler();
    return this._inspectBoardStatus(this.packageJsonPath).then(versions => {
      return new Promise((resolve, reject) => {
        // Create the settings object - see default settings.js file for other options
        let settings = this._createREDSettigngs(versions);
        // Flow File Name Spec. Change Migration
        this._migrateFlowFile(settings.userDir).then(() => {
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

      let flowFilePath = settings.userDir + '/' + this.flowFile;
      this.deviceManagerStore.deviceState.testIfUIisEnabled(flowFilePath).then(enabled => {
        if (enabled) {
          RED.log.info('[CANDY RED] Deploying Flow Editor UI...');
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
        RED.start().then(() => {
          RED.log.info(`Listen port=${PORT}`);
        });
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
      page: {
        title: 'CANDY RED@' + name,
        favicon: __dirname + '/public/images/candy-red.ico',
        css: __dirname + '/public/css/candy-red.css'
      },
      header: {
        title: ' ** ' + longname + ' **',
        image: __dirname + '/public/images/candy-red.png'
      },
      menu: {
        'menu-item-help': {
          label: 'Powered By Node-RED',
          url: 'http://nodered.org/docs'
        },
        'menu-item-keyboard-shortcuts': true
      }
    };
  }

  _createCandyBoxEditorTheme(deviceId) {
    let name = os.hostname();
    let longname = name;
    if (deviceId) {
      name = deviceId;
      longname = `${os.hostname()} (${name})`;
    }
    return {
      page: {
        title: 'CANDY BOX@' + name,
        favicon: __dirname + '/public/images/candy-box.ico',
        css: __dirname + '/public/css/candy-box.css'
      },
      header: {
        title: ' ** ' + longname + ' **',
        image: __dirname + '/public/images/candy-box.png'
      },
      menu: {
        'menu-item-help': {
          label: 'Powered By Node-RED',
          url: 'http://nodered.org/docs'
        },
        'menu-item-keyboard-shortcuts': true
      }
    };
  }

  _inspectBoardStatus(inputPackageJsonPath) {
    return Promise.all([
      this.deviceManagerStore.deviceState.testIfCANDYIoTInstalled(),
      this.deviceManagerStore.deviceState.testIfLTEPiInstalled()
    ]).then(results => {
      let candyIotv;
      let ltepiv;
      let deviceId;
      if (results[0][0]) {
        deviceId = results[0][0];
      }
      if (results[0][1]) {
        candyIotv = results[0][1];
        this.editorTheme = this._createCandyBoxEditorTheme(deviceId);
      } else if (results[1][1]) {
        ltepiv = results[1][1];
        this.editorTheme = this._createCandyRedEditorTheme(deviceId);
      } else {
        this.editorTheme = this._createCandyRedEditorTheme(deviceId);
      }
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
                candyIotv: candyIotv,
                ltepiv: ltepiv,
                candyRedv: 'N/A'
              });
            }
            let packageJson = JSON.parse(data);
            return resolve({
              deviceId: deviceId,
              candyIotv: candyIotv,
              ltepiv: ltepiv,
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
        RED.settings.exitHandlers.forEach(handler => {
          try {
            handler(RED);
          } catch (err) {
            console.log(`The error [${err}] is ignored`);
            console.log(err.stack);
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
    process.on('exit', exitHandler);
    process.on('SIGINT', exitHandler);
    process.on('uncaughtException', exitHandler);
  }

  _createREDSettigngs(versions) {
    return {
      flowFilePretty: false,
      verbose: true,
      disableEditor: false,
      httpAdminRoot: '/red',
      httpNodeRoot: '/api',
      userDir: (process.env.HOME || process.env.USERPROFILE) + '/.node-red',
      flowFile: this.flowFile,
      functionGlobalContext: {
      },
      exitHandlers: [],
      deviceManagerStore: this.deviceManagerStore,
      editorTheme: this.editorTheme,
      candyIotVersion: versions.candyIotv,
      ltepiVersion: versions.ltepiv,
      candyRedVersion: versions.candyRedv,
      deviceId: versions.deviceId
    };
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
