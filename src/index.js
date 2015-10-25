#!/usr/bin/env node
'use strict';

import * as bus from './bus';
import * as ble from './ble';
import * as serial from './serial';

let url;
let user;
let password;

if (process.env.WS_URL) {
  url = process.env.WS_URL;
}
if (!url) {
  console.error('WS_URL is missing');
  process.exit(1);
}
if (url.indexOf('ws') !== 0 || url.indexOf(':') < 0) {
  console.error('Invalid WS_URL');
  process.exit(2);
}

if (process.env.WS_USER) {
  user = process.env.WS_USER;
}
if (process.env.WS_PASSWORD) {
  password = process.env.WS_USER;
}

console.log(`connecting to ${url}`);
if (user || password) {
  console.log(`The given credentials will be used for authentication: user=${user}`);
}

bus.start(url, user, password).then(() => {
  return ble.start(bus);
}).then(() => {
  return serial.start(bus);
}).catch(e => {
  console.error('[ERROR]:', e);
  if (e instanceof Error) {
    console.error(e.stack);
  }
  process.exit(3);
});
