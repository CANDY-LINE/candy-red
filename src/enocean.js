'use strict';

import setUpEnocean from 'node-enocean';
import Promise from 'es6-promises';
import { ERP2Parser, ESP3RadioERP2Parser } from './esp3_erp2_parser';

class ESP3Parser {
  constructor(bus) {
    this.esp3Type10Parser = new ESP3RadioERP2Parser();
    this.erp2Parser = new ERP2Parser();
    this.bus = bus;
  }
  
  parse(data) {
    let that = this;
    return new Promise((resolve, reject) => {
      if (data.packetType === 10) {
        return that.esp3Type10Parser.parse(data.rawByte).then(ctx => {
          return that.erp2Parser.parse(ctx);
        }).then(ctx => {
          try {
            // TODO node-ocean eep support
            // f6-02-04 specific
            let data = {
              type: ctx.telegramType,
              unit: 'state',
              val: ''
            };
            let state = ctx.dataDl[0];
            if (state === 0) {
              data.val = 'released';
            } else if (state === 0x88) {
              data.val = 'RBI';
            } else if (state === 0x84) {
              data.val = 'RB0';
            }
            let payload = {
              data: data,
              tstamp: Date.now(),
              rssi: ctx.container.dBm,
              id: ctx.originatorId
            };
            return that.bus.send(payload);
          } catch (e) {
            reject(e);
          }
        }).catch(e => {
          reject(e);
        });
      }
      resolve();
    });
  }
}

let enocean;
let parser;

export function start(bus) {
  if (!bus) {
    throw new Error('bus is required!');
  }
  parser = new ESP3Parser(bus);
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
          parser.parse(data).catch(e => {
            console.log(e, data);
          });
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
