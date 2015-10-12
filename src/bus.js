'use strict';

import WebSocket from 'ws';

let ws = null;

export function start(url, user, password) {
  if (!url) {
    throw new Error('Missing URL!');
  }
  return new Promise((resolve, reject) => {
    let headers = {};
    if (user && password) {
      let auth = new Buffer(`${user}:${password}`).toString('base64');
      headers.Authorization = `Basic ${auth}`;
    }
    ws = new WebSocket(url, {
      headers: headers
    });
    ws.on('open', () => {
      console.log('WebSocket opened.');
      resolve();
    });
    ws.on('error', e => {
      console.log('WebSocket error.');
      reject(e);
    });
    ws.on('close', () => {
      console.log('WebSocket closed.');
      reject('closed');
    });
    ws.on('message', data => {
      if (process.env.WS_DEBUG) {
        console.log('Data:', data);
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
      ws.send(JSON.stringify(data));
      resolve();
    } catch (e) {
      reject(e); 
    }
  });
}