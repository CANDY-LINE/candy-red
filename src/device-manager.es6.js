'use strict';

import 'source-map-support/register';
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import { EventEmitter } from 'events';
import Promise from 'es6-promises';

export class DeviceIdResolver {
  constructor(RED) {
    this.RED = RED;
  }

  resolve() {
    return new Promise((resolve, reject) => {
      return this._resolveCANDYIoT(resolve, reject);
    });    
  }
  
  _resolveCANDYIoT(resolve, reject) {
    // CANDY IoT
    // TODO
    return this._resolveEdison(resolve, reject);
  }

  _resolveEdison(resolve, reject) {
    // Intel Edison Yocto
    fs.stat('/factory/serial_number', err => {
      if (err) {
        return this._resolveLTEPi(resolve, reject);
      }
      fs.read('/factory/serial_number', (err, data) => {
        if (err) {
          return reject(err);
        }
        resolve('EDN:' + data);
      });
    });
  }
  
  _resolveLTEPi(resolve, reject) {
    // LTE Pi
    // TODO
    return this._resolveRPi(resolve, reject);
  }
  
  _resolveRPi(resolve, reject) {
    // RPi
    fs.stat('/proc/cpuinfo', err => {
      if (err) {
        return this._resolveMAC(resolve, reject);
      }
      let reader = readline.createInterface({
        input: fs.createReadStream('/proc/cpuinfo')
      });
      let id = '';
      reader.on('line', line => {
        if (line.indexOf('Serial ') >= 0 && line.indexOf(':') >= 0) {
          id = line.split(':')[1].trim();
        }
      });
      reader.on('close', err => {
        if (err || !id) {
          return this._resolveMAC(resolve, reject);
        }
        resolve('RPi:' + id);
      });
    });
  }

  _resolveMAC(resolve, reject) {
    let ifs = os.networkInterfaces();
    for (let key in ifs) {
      if (ifs.hasOwnProperty(key)) {
        for (let i in ifs[key]) {
          let mac = ifs[key][i].mac;
          if (mac && mac !== '00:00:00:00:00:00') {
            return resolve('MAC:' + key + ':' + mac.replace(new RegExp(':', 'g'), '-').toLowerCase());
          }
        }
      }
    }
    reject(new Error('No identifier!'));
  }
}

export class DeviceManager {
  constructor(RED) {
    this.RED = RED;
    this.listenerConfig = null;
    this.events = new EventEmitter();
    this.resolver = new DeviceIdResolver(RED);
  }

  isWsClientInitialized() {
    return this.listenerConfig !== null;
  }

  initWsClient(account, accountConfig, webSocketListeners) {
    this.resolver.resolve().then(id => {
      this._initWsClient(id, account, accountConfig, webSocketListeners);
    });
  }

  _initWsClient(id, account, accountConfig, webSocketListeners) {
    let that = this;
    this.listenerConfig = webSocketListeners.get({
      accountConfig: accountConfig,
      account: account,
      path: 'candy-ws'
    }, {
      headers: {
        'x-device-id': id
      }
    });
    accountConfig.on('close', () => {
      that.listenerConfig.close();
    });
    let prefix = '{DeviceManager}:[' + accountConfig.accountFqn + '] ';
    this.events.on('opened', () => {
      that.RED.log.warn(prefix + 'connected');
    });
    this.events.on('closed', () => {
      that.RED.log.warn(prefix + 'disconnected');
    });
    this.events.on('erro', () => {
      that.RED.log.warn(prefix + 'error');
    });
    // receiving an incoming message (sent from a source)
    this.events.send = msg => {
      let payload = msg.payload;
      if (payload) {
        if (!Buffer.isBuffer(payload)) {
          try {
            payload = JSON.parse(payload);
          } catch (_) {
          }
        }
      }
      that.RED.log.info('[CANDY RED] Received!');
      if (payload.status) {
        switch (payload.status) {
        case 401:
        case 403:
        case 407:
          // Terminate everything and never retry
          that.listenerConfig.close();
          that.RED.log.error('[CANDY RED] Enrollment error!' +
            ' This device is not allowed to access the account:' +
            accountConfig.accountFqn);
          return;
        default:
          console.log('CONGRATS!', payload);
        }
      }
    };
    this.listenerConfig.registerInputNode(this.events);
    this.listenerConfig.send = (payload, msg) => {
      if (msg && msg._session && msg._session.type === 'candy-egg-ws') {
        that.listenerConfig.reply(msg._session.id, payload);
      } else {
        that.listenerConfig.broadcast(payload);
      }
    };
  }

  // resetWsClient(accountConfig) {
  //
  // }

  testIfCANDYIoTInstalled() {
    return new Promise(resolve => {
      // TODO
      resolve(true);
    });
  }
}
