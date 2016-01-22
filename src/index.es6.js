'use strict';

import 'source-map-support/register';
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

    // Default Theme
    this.flowFile = this._createCandyRedFlowFile();
    this.editorTheme = this._createCandyRedEditorTheme();
    
    // path to package.json
    this.packageJsonPath = packageJsonPath;
  }
  
  start() {
    this.server.listen(PORT);
    this._setupExitHandler();
    return this._inspectBoardStatus(this.packageJsonPath).then(versions => {
      // Create the settings object - see default settings.js file for other options
      let settings = this._createREDSettigngs(versions);

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

  _createCandyRedFlowFile() {
    return 'flows_candy-red_' + os.hostname() + '.json';
  }

  _createCandyRedEditorTheme() {
    return {
      page: {
        title: 'CANDY RED@' + os.hostname(),
        favicon: __dirname + '/public/images/candy-red.ico',
        css: __dirname + '/public/css/candy-red.css'
      },
      header: {
        title: ' ** ' + os.hostname() + ' **',
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

  _createCandyBoxFlowFile() {
    return 'flows_candy-box_' + os.hostname() + '.json';
  }

  _createCandyBoxEditorTheme() {
    return {
      page: {
        title: 'CANDY BOX@' + os.hostname(),
        favicon: __dirname + '/public/images/candy-box.ico',
        css: __dirname + '/public/css/candy-box.css'
      },
      header: {
        title: ' ** ' + os.hostname() + ' **',
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
    return this.deviceManagerStore.deviceState.testIfCANDYIoTInstalled().then(candyIotv => {
      if (candyIotv) {
        this.flowFile = this._createCandyBoxFlowFile();
        this.editorTheme = this._createCandyBoxEditorTheme();
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
                candyRedv: 'N/A'
              });
            }
            let packageJson = JSON.parse(data);
            return resolve({
              candyIotv: candyIotv,
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
      candyRedVersion: versions.candyRedv,
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
