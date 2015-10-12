#!/usr/bin/env node
'use strict';

import * as bus from './bus';
import * as ble from './ble';

let url;
if (process.argv.length > 1) {
  url = process.argv[process.argv.length - 1];
  console.log(`connecting to ${url}`);
}
if (!url || url.indexOf('ws') !== 0 || url.indexOf(':') < 0) {
  console.error('Invalid url');
  process.exit(1);
}

bus.start(url).then(() => {
  return ble.start(bus);
}).catch(e => {
  console.error('[ERROR]:', e);
  if (e instanceof Error) {
    console.error(e.stack);
  }
  process.exit(2);
});
