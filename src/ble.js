'use strict';

import noble from 'noble';
import peripherals from './ble_peripherals';
import Promise from 'es6-promises';

export function start(bus) {
  if (!bus) {
    throw new Error('bus is required!');
  }
  return new Promise((resolve, reject) => {
    noble.on('stateChange', state => {
      if (state === 'poweredOn') {
        console.log('Starting Scanning...');
        noble.startScanning([], true);
        resolve();
      } else {
        noble.stopScanning();
        reject();
      }
    });
    if (noble.state === 'poweredOn') {
      console.log('Starting Scanning...');
      noble.startScanning([], true);
      resolve();
    }
  }).then(() => {
    return new Promise((resolve, reject) => {
      noble.on('discover', peripheral => {
        let adv = peripheral.advertisement;
        peripherals.lookup(adv.localName).then(p => {
          let data = p.parse(adv.manufacturerData);
          let payload = {
            data: data,
            tstamp: Date.now(),
            rssi: peripheral.rssi,
            id: peripheral.address
          };
          if (payload.id === 'unknown') {
            // OSX workaround
            payload.id = peripheral.id;
          }
          return bus.send(payload);
        }).catch(e => {
          if (e instanceof Error) {
            reject(e);
          } else {
            console.log(e, peripheral);
          }
        });
      });
      resolve();
    });
  });
}

export function stop() {
  return new Promise(resolve => {
    noble.stopScanning();
    console.log('Scanning stopped.');
    resolve();
  });  
}
