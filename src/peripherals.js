'use strict';
/*jshint bitwise: false*/

import Promise from 'es6-promises';

class BleCastBl {
  parse(manufacturerData) {
    let lx = 256 * manufacturerData[5] + manufacturerData[4];
    return {
      type: 'lx',
      unit: 'lx',
      val: lx
    };  
  }
}

class BleCastTm {
  parse(manufacturerData) {
    let tempC = manufacturerData[4] - ((manufacturerData[4] & 0x80) << 1);
    tempC += ((manufacturerData[5] & 0x80) >> 7) * 0.5;
    return {
      type: 'te',
      unit: 'C',
      val: tempC
    };
  }
}

const PERIPHERALS = {
  BLECAST_BL: new BleCastBl(),
  BLECAST_TM: new BleCastTm()
};

class Peripherals {
  lookup(rawid) {
    return new Promise((resolve, reject) => {
      if (!rawid) {
        reject('Unknown peripheral: local name is empty');
      }
      let identifier = rawid.replace(/\0/g, ''); // in case of a NULL terminator is included
      let p = PERIPHERALS[identifier];
      if (!p) {
        reject(`Unknown peripheral: [${identifier}]`);
      } else {
        resolve(p);
      }
    });
  }
}

export default new Peripherals();
