'use strict';

import noble from 'noble';
import peripherals from './peripherals';

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
    noble.on('discover', peripheral => {
      let adv = peripheral.advertisement;
      peripherals.lookup(adv.localName).then(p => {
        let data = p.parse(adv.manufacturerData);
        data.rssi = peripheral.rssi;
        data.deviceUuid = peripheral.uuid;
        return bus.send(data);
      }).catch(e => {
        console.log('[ERROR]', e);
        if (e instanceof Error) {
          console.log(e.stack);
        }
        console.log(peripheral);
      });
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
