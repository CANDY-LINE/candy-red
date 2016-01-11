'use strict';

import 'source-map-support/register';
import http from 'http';
import express from 'express';
import RED from 'node-red';
import os from 'os';
import { DeviceManager } from './device-manager';

// Listen port
const PORT = process.env.PORT || 8100;

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

let deviceManager = new DeviceManager(RED);
deviceManager.testIfCANDYIoTInstalled().then(installed => {
  if (installed) {
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
    deviceManager: deviceManager,
    editorTheme: editorTheme
  };

  // Initialise the runtime with a server and settings
  RED.init(server, settings);
  settings.version += '-[CANDY RED]';

  // Serve the http nodes from /api
  app.use(settings.httpNodeRoot, RED.httpNode);

  deviceManager.testIfUIisEnabled(flowFile).then(enabled => {
    if (enabled) {
      RED.log.info('Deploying Flow Editor UI...');
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
