'use strict';

import WebSocket from 'ws';
import Promise from 'es6-promises';

let options = {
  url: '',
  headers: {}
};
let ws = null;

function prepareWebSocket(resolve=null, reject=null) {
  ws = new WebSocket(options.url, {
    headers: options.headers
  });
  ws.on('open', () => {
    console.log('WebSocket opened.');
    ws.on('error', e => {
      console.log('WebSocket error.', e);
      prepareWebSocket();
      if (resolve) {
        resolve(e);
      }
    });
    ws.on('close', () => {
      console.log('WebSocket closed.');
      prepareWebSocket();
      if (reject) {
        reject('closed');
      }
    });
    if (resolve) {
      resolve();
    }
  });
}

export function start(url, user, password) {
  if (!url) {
    throw new Error('Missing URL!');
  }
  options.url = url;
  return new Promise((resolve, reject) => {
    if (user && password) {
      let auth = new Buffer(`${user}:${password}`).toString('base64');
      options.headers.Authorization = `Basic ${auth}`;
    }
    prepareWebSocket(resolve, reject);
    ws.on('message', data => {
      if (process.env.WS_DEBUG) {
        console.log('[RECV]:', data);
      }
    });
    console.log('ready');
  });
}

export function send(data) {
  return new Promise((resolve, reject) => {
    if (!data) {
      reject('no data');
      return;
    }
    try {
      if (process.env.WS_DEBUG) {
        console.log('[SEND]:', JSON.stringify(data));
      }
      ws.send(JSON.stringify(data));
      resolve();
    } catch (e) {
      reject(e); 
    }
  });
}