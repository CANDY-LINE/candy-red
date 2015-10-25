'use strict';

import setUpEnocean from 'node-enocean';
import Promise from 'es6-promises';
import { ERP2Parser, ESP3RadioERP2Parser } from './esp3_erp2_parser';

let enocean;

class Dump {
  parseRaw(data) {
    if (data.packetType === 10) {
      new ESP3RadioERP2Parser().parse(data.rawByte).then(ctx => {
        return new ERP2Parser().parse(ctx.payload);
      }).then(ctx => {
        console.log(ctx);
      }).catch(e => {
        console.error(e);
      });
    }
    console.log(`RAW:${JSON.stringify(data)}`);
  }
}

export function start(bus, parser=new Dump()) {
  if (!bus) {
    throw new Error('bus is required!');
  }
  let port = process.env.ENOCEAN_PORT;
  if (!port) {
    console.log('EnOcean is inactivated...');
    return new Promise(resolve => { resolve(); });
  }
  enocean = setUpEnocean();
  return new Promise((resolve, reject) => {
    console.log('Starting EnOcean Serial Port Listening...');
    try {
      enocean.listen(port);
      enocean.on('data', data => {
        if (parser) {
          parser.parseRaw(data);
        }
      });
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function send(data) {
  return new Promise((resolve, reject) => {
    if (!enocean) {
      enocean.send(data);
      resolve();
    } else {
      reject('EnOcean Serial port is closed');
    }
  });  
}

export function stop() {
  return new Promise((resolve, reject) => {
    if (!enocean) {
      enocean.close(e => {
        if (e) {
          reject(e);
        } else {
          enocean = undefined;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });  
}
