'use strict';

import WebSocket from 'ws';

let ws = null;

export function start(url) {
  if (!url) {
    throw new Error('Missing URL!');
  }
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
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
    ws.on('message', (data, flags) => {
      console.log('Data:' + data, flags);
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