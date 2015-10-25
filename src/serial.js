'use strict';

import { SerialPort } from 'serialport';
import Promise from 'es6-promises';

let serialPort;

class Dump {
  parse(data) {
    console.log(data.toString('hex'));
  }
}

export function start(bus, parser=new Dump()) {
  if (!bus) {
    throw new Error('bus is required!');
  }
  let port = process.env.SERIAL_PORT;
  let baudrate = process.env.SERIAL_BAUDRATE || 57600;
  if (!port) {
    throw new Error('Seril port is required! Set SERIAL_PORT environment variable.');
  }
  serialPort = new SerialPort(port, {
    baudrate: baudrate
  }, false);
  return new Promise((resolve, reject) => {
    serialPort.open(e => {
      if (e) {
        reject(e);
        return;
      }
      console.log('Starting Seril Port Listening...');
      serialPort.on('data', data => {
        if (parser) {
          parser.parse(data);
        }
      });
    });
    resolve();
  });
}

export function write(data) {
  return new Promise((resolve, reject) => {
    if (!serialPort && serialPort.isOpen()) {
      serialPort.write(data, e => {
        if (e) {
          reject(e);
        } else {
          resolve();
        }
      });
    } else {
      reject('Serial port is closed');
    }
  });  
}

export function stop() {
  return new Promise((resolve, reject) => {
    if (!serialPort && serialPort.isOpen()) {
      serialPort.close(e => {
        if (e) {
          reject(e);
        } else {
          serialPort = undefined;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });  
}
