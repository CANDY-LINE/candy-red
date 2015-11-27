'use strict';

import 'source-map-support/register';
import http from 'http';
import express from 'express';
import RED from 'node-red';

// Listen port
const PORT = process.env.PORT || 8000;

// Create an Express app
let app = express();

// Create a server
let server = http.createServer(app);
server.listen(PORT);

// Create the settings object - see default settings.js file for other options
let settings = {
  verbose: true,
  disableEditor: false,
  httpAdminRoot: '/red',
  httpNodeRoot: '/api',
  userDir: (process.env.HOME || process.env.USERPROFILE) + '/.node-red',
  functionGlobalContext: {
  },
  exitHandlers: [],
  editorTheme: {
    page: {
      title: 'CANDY-Box',
      favicon: 'favicon.ico'
    },
    header: {
      title: 'CANDY-Box',
      image: 'banner.png'
    },
  }
};

// Exit handler
process.stdin.resume();
function exitHandler(err) {
  console.log('[CANDY-Red] Bye');
  if (RED.settings.exitHandlers) {
    RED.settings.exitHandlers.forEach(handler => {
      try {
        handler(RED);
      } catch (e) {
        console.log(`The error [${e}] is ignored`);
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

// Initialise the runtime with a server and settings
RED.init(server, settings);

// Add a simple route for static content served from 'public'
app.use('/', express.static(__dirname + '/public'));
if (settings.httpAdminRoot) {
  app.get('/', (_, res) => {
    res.redirect(settings.httpAdminRoot);
  });
}

// Serve the editor UI from /red
app.use(settings.httpAdminRoot, RED.httpAdmin);

// Serve the http nodes UI from /api
app.use(settings.httpNodeRoot, RED.httpNode);

// Start the runtime
RED.start().then(() => {
  RED.log.info(`Listen port=${PORT}`);
});
