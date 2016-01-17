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

// Create an Express app
let app = express();

// Create a server
let server = http.createServer(app);
server.listen(PORT);
let flowFile = 'flows_candy-red_' + os.hostname() + '.json';
let editorTheme = {
  page: {
    title: 'CANDY RED@' + os.hostname()
  },
  header: {
    title: 'CANDY RED //Powerd by Node-RED// ** ' + os.hostname() + ' **'
  },
  menu: {
    'menu-item-help': {
      label: 'Powered By Node-RED',
      url: 'http://nodered.org/docs'
    }
  }
};

let deviceManagerStore = new DeviceManagerStore(RED);
deviceManagerStore.deviceState.testIfCANDYIoTInstalled().then(candyIotv => {
  if (candyIotv) {
    flowFile = 'flows_candy-box_' + os.hostname() + '.json';
    editorTheme = {
      page: {
        title: 'CANDY BOX@' + os.hostname(),
        favicon: __dirname + '/public/images/favicon.ico',
        css: __dirname + '/public/css/style.css'
      },
      header: {
        title: ' ** ' + os.hostname() + ' **',
        image: __dirname + '/public/images/banner.png'
      },
      menu: {
        'menu-item-help': {
          label: 'Powered By Node-RED',
          url: 'http://nodered.org/docs'
        }
      }
    };
  }
  return new Promise(resolve => {
    if (process.argv.length > 2) {
      fs.stat(process.argv[2], err => {
        if (!err) {
          return resolve(process.argv[2]);
        }
        return resolve(DEFAULT_PACKAGE_JSON);
      });
    }
    resolve(DEFAULT_PACKAGE_JSON);
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
}).then(versions => {
  // Create the settings object - see default settings.js file for other options
  let settings = {
    verbose: true,
    disableEditor: false,
    httpAdminRoot: '/red',
    httpNodeRoot: '/api',
    userDir: (process.env.HOME || process.env.USERPROFILE) + '/.node-red',
    flowFile: flowFile,
    functionGlobalContext: {
    },
    exitHandlers: [],
    deviceManagerStore: deviceManagerStore,
    editorTheme: editorTheme,
    candyIotVersion: versions.candyIotv,
    candyRedVersion: versions.candyRedv,
  };

  // Initialise the runtime with a server and settings
  RED.init(server, settings);
  settings.version += '-[CANDY RED]';

  // Serve the http nodes from /api
  app.use(settings.httpNodeRoot, RED.httpNode);

  deviceManagerStore.deviceState.testIfUIisEnabled(settings.userDir + '/' + flowFile).then(enabled => {
    if (enabled) {
      RED.log.info('[CANDY RED] Deploying Flow Editor UI...');
      // Add a simple route for static content served from 'public'
      app.use('/', express.static(__dirname + '/public'));
      if (settings.httpAdminRoot) {
        app.get('/', (_, res) => {
          res.redirect(settings.httpAdminRoot);
        });
      }
      // Serve the editor UI from /red
      app.use(settings.httpAdminRoot, RED.httpAdmin);
    }

    // Start the runtime
    RED.start().then(() => {
      RED.log.info(`Listen port=${PORT}`);
    });
  });
});
