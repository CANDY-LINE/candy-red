'use strict';

import 'source-map-support/register';
import os from 'os';
import fs from 'fs';
import readline from 'readline';
import { EventEmitter } from 'events';
import Promise from 'es6-promises';
import cproc from 'child_process';
import crypto from 'crypto';
import path from 'path';
import * as chokidar from 'chokidar';
import RED from 'node-red';

const REBOOT_DELAY_MS = 1000;
const TRACE = process.env.DEBUG || false;

const EDITON_YOCTO_SN_PATH = '/factory/serial_number';
const PROC_CPUINFO_PATH = '/proc/cpuinfo';

export class DeviceIdResolver {
  constructor() {
    this.hearbeatIntervalMs = -1;
    this.ciotSupported = false;
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
    fs.stat(EDITON_YOCTO_SN_PATH, err => {
      if (err) {
        return this._resolveLTEPi(resolve, reject);
      }
      fs.read(EDITON_YOCTO_SN_PATH, (err, data) => {
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
    fs.stat(PROC_CPUINFO_PATH, err => {
      if (err) {
        return this._resolveMAC(resolve, reject);
      }
      let reader = readline.createInterface({
        input: fs.createReadStream(PROC_CPUINFO_PATH)
      });
      let id = '';
      reader.on('line', line => {
        if (line.indexOf('Serial') >= 0 && line.indexOf(':') >= 0) {
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
  constructor(primary, listenerConfig, accountConfig, deviceState) {
    if (!accountConfig) {
      throw new Error('accountConfig is required');
    }
    this.primary = primary;
    this.listenerConfig = listenerConfig;
    this.accountConfig = accountConfig;
    this.deviceState = deviceState;
    this.prefix = '[CANDY RED] {DeviceManager}:[' + accountConfig.accountFqn + '] ';
    this.events = new EventEmitter();
    this.events.on('opened', () => {
      this._warn('connected');
    });
    this.events.on('closed', () => {
      this._warn('disconnected');
      this._reset();
    });
    this.events.on('erro', (err1, err2) => {
      if (err2) {
        this._warn('failed to connect' + (err2.status ? ' :' + err2.status : ''));
      } else {
        this._warn('connection error');
      }
      this._reset();
    });
    this.events.on('ping', () => {
      if (this.pingTimeoutTimer) {
        clearTimeout(this.pingTimeoutTimer);
      }
      this.pingTimeoutTimer = setTimeout(() => {
        this._warn(`ping has not come for more than ${this.hearbeatIntervalMs * 1.5 / 1000} seconds`);
        this._reset();
        this.listenerConfig.server.close(); // close event will start a new connection after 3+ seconds
      }, this.hearbeatIntervalMs * 1.5);
    });
    // receiving an incoming message (sent from a source)
    this.events.send = msg => {
      let payload = msg.payload;
      if (payload) {
        try {
          payload = JSON.parse(payload);
        } catch (_) {
        }
      }
      if (TRACE) {
        this._info('Received!:' + JSON.stringify(payload));
      }
      if (!this.enrolled) {
        if (!payload || !payload.status || Math.floor(payload.status / 100) !== 2) {
          // Terminate everything and never retry
          this.listenerConfig.close();
          this._error('Enrollment error!' +
            ' This device is not allowed to access the account:' +
            accountConfig.accountFqn);
          return;
        } else {
          payload = payload.commands;
          this.enrolled = true;
        }
      }
      this._performCommands(payload).then(result => {
        this._sendToServer(result);
      }).catch(result => {
        if (result instanceof Error) {
          let err = result;
          result = {};
          result.status = 500;
          result.message = err.toString();
          result.stack = err.stack;
        } else if (result && !Array.isArray(result)) {
          result = [result];
        }
        this._sendToServer(result);
      }).catch(err => {
        this._error(err.stack);
      });
    };
    this.listenerConfig.registerInputNode(this.events);
    this.listenerConfig.send = payload => {
      if ((typeof(payload) === 'object') && !(payload instanceof Buffer)) {
        payload = JSON.stringify(payload);
      }
      return this.listenerConfig.broadcast(payload);
    };
    this._reset();
  }
  
  _info(msg) {
    RED.log.info(this.prefix  + msg);
  }
  _warn(msg) {
    RED.log.warn(this.prefix  + msg);
  }
  _error(msg) {
    RED.log.error(this.prefix  + msg);
  }

  _reset() {
    this.cmdIdx = 0;
    this.commands = {};
    this.enrolled = false;
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer);
      delete this.pingTimeoutTimer;
    }
  }
  
  publish(commands) {
    return this._sendToServer(commands);
  }
  
  static restart() {
    // systemctl shuould restart the service
    setTimeout(() => {
      process.exit(219);
    }, REBOOT_DELAY_MS);
  }
  
  _sendToServer(result) {
    return new Promise((resolve, reject) => {
      if (!result || Array.isArray(result) && result.length === 0 || Object.keys(result) === 0) {
        // do nothing
        this._info('No commands to respond to');
        return resolve();
      }
      result = this._numberResponseCommands(result);
      let sent = this.listenerConfig.send(result);
      if (TRACE && sent) {
        this._info('Sent!:' + JSON.stringify(result));
      }
      if (!sent) {
        return reject(new Error('Failed to send' + JSON.stringify(result)));
      }
      if (!Array.isArray(result)) {
        result = [result];
      }
      if (result.reduce((p, c) => {
        return p || (c && c.restart);
      }, false)) {
        this._warn('Restarting this process!!');
        DeviceManager.restart();
      }
      resolve();
    });
  }
  
  _nextCmdIdx() {
    this.cmdIdx = (this.cmdIdx + 1) % 65536;
    return this.cmdIdx;
  }

  _numberResponseCommands(result) {
    let processed = result;
    if (!Array.isArray(result)) {
      processed = [result];
    }
    processed.forEach(r => {
      if (r.commands) {
        this._numberRequestCommands(r.commands);
      } else {
        this._numberRequestCommands(r);
      }
    });
    return result;
  }
  
  _numberRequestCommands(commands) {
    let processed = commands;
    if (!Array.isArray(commands)) {
      processed = [commands];
    }
    processed.forEach(c => {
      if (!c.id) {
        c.id = this._nextCmdIdx();
      }
      this.commands[c.id] = c;
      if (c.done) {
        // done callback
        if (!this.done) {
          this.done = {};
        }
        this.done[c.id] = c.done;
        delete c.done;
      }
      if (c.cat === 'ctrl' && (c.act === 'sequence' || c.act === 'parallel')) {
        this._numberRequestCommands(c.args);
      }
    });
    return commands;
  }

  _performCommands(commands) {
    if (!commands) {
      return new Promise(resolve => resolve()); // do nothing
    }

    if (Array.isArray(commands)) {
      // same as act:parallel
      let promises = commands.map(c => {
        return this._performCommands(c);
      });
      return Promise.all(promises).then(resultArray => {
        let result = resultArray.reduce((a, b) => {
          if (a && b) {
            return a.concat(b);
          } else if (!a) {
            return b;
          }
          return a;
        }, []);
        return new Promise(resolve => resolve(result));
      });
    }

    if (commands.status) {
      // response to the issued command
      if (commands.id) {
        let c = this.commands[commands.id];
        if (c) {
          let done;
          if (this.done && this.done[commands.id]) {
            done = this.done[commands.id];
          }
          if (Math.floor(commands.status / 100) !== 2) {
            RED.log.info(`Not-OK status to command: ${JSON.stringify(c)}, status:${JSON.stringify(commands)}`);
            try {
              done(commands.status);
            } catch (_) {
            }
          } else if (done) {
            try {
              done();
            } catch (_) {
            }
          }
          if (done) {
            delete this.done[commands.id];
          }
          delete this.commands[commands.id];
        }
      }
      if (commands.commands) {
        return this._performCommands(commands.commands);
      }
      if (Math.floor(commands.status / 100) !== 2) {
        this._info(`Server returned Not-OK, status:${JSON.stringify(commands)}`);
      }
      return new Promise(resolve => resolve()); // do nothing
    }

    if (!commands.id) {
      return new Promise(resolve => resolve({ status: 400, message: 'id missing' }));
    }
    if (!commands.cat) {
      return new Promise(resolve => resolve({ status: 400, message: 'category missing' }));
    }

    if (commands.cat === 'ctrl') {
      let children = commands.args || [];
      if (!Array.isArray(children)) {
        children = [children];
      }
      let promises;
      switch(commands.act) {
      case 'sequence':
        promises = children.reduce((p, c) => {
          if (!c) {
            return p;
          }
          let next = p.then(result => {
            return this._performCommand(c, result);
          });
          return next;
        }, new Promise(resolve => resolve())).then(result => {
          return new Promise(resolve => {
            if (result) {
              result.push({ status: 200, id: commands.id });
              return resolve(result);
            }
            return resolve({ status: 400, id: commands.id });
          });
        });
        return promises;

      case 'parallel':
        promises = children.map(c => {
          return this._performCommands(c);
        });
        return Promise.all(promises).then(resultArray => {
          let result = resultArray.reduce((a, b) => {
            if (a && b) {
              return a.concat(b);
            } else if (!a) {
              return b;
            }
            return a;
          }, []);
          return new Promise(resolve => {
            result.push({ status: 200, id: commands.id });
            resolve(result);
          });
        });
        
      default:
        throw new Error('unknown action:' + commands.act);
      }

      return new Promise(resolve => resolve({ status: 400, errCommands: commands }));
    }
    return this._performCommand(commands);
  }
  
  _buildErrResult(err, c) {
    if (err instanceof Error) {
      return { status: 500, message: err.toString(), stack: err.stack, id: c.id };
    } else {
      err.id = c.id;
      return err;
    }
  }
  
  _performCommand(c, result) {
    return new Promise((resolve, reject) => {
      try {
        if (!result) {
          result = [];
        } else if (!Array.isArray(result)) {
          result = [result];
        }
        switch(c.cat) {
        case 'sys':
          return this._performSysCommand(c).then(sysResult => {
            if (sysResult) {
              sysResult.id = c.id;
              result.push(sysResult);
            } else {
              result.push({ status: 200, id: c.id });
            }
            return resolve(result);
          }).catch(err => {
            result.push(this._buildErrResult(err, c));
            return reject(result);
          });
        default:
          result.push(this._buildErrResult({ status: 400 }, c));
          return reject(result);
        }
      } catch (err) {
        result.push(this._buildErrResult(err, c));
        return reject(result);
      }
    });
  }

  _performSysCommand(c) {
    switch(c.act) {
    case 'provision':
      return this._performProvision(c);
    case 'syncflows':
      return this._performSyncFlows(c);
    case 'updateflows':
      return this._performUpdateFlows(c);
    case 'inspect':
      return this._performInspect(c);
    case 'restart':
      return this._performRestart(c);
    default:
      throw new Error('Unsupported action:' + c.act);
    }    
  }
  
  _performInspect(c) {
    return new Promise((resolve, reject) => {
      if (!this.ciotSupported) {
        return reject({ status: 405 });
      }
      if (!c) {
        return reject({ status: 400 });
      }
      return reject({ status: 501, message: 'TODO!!' });
    });
  }
  
  _performProvision(c) {
    this.hearbeatIntervalMs = c.args.hearbeatIntervalMs;
    return new Promise(resolve => {
      // do stuff if any after provisioning
      return resolve();
    });
  }
  
  _updateLocalFlows(flows) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(flows)) {
        flows = [flows];
      }
      let accounts = flows.filter(f => {
        if (f.type !== 'CANDY EGG account') {
          return false;
        }
        if (!f.managed) {
          return false;
        }
        if (!f.accountFqn) {
          return false;
        }
        if (!f.loginUser) {
          return false;
        }
        return true;
      });
      if (accounts.length === 0) {
        return reject({ status: 400, message: 'invalid flow content' });
      }
      accounts.forEach(a => {
        if (!a.revision) {
          a.revision = 1;
        } else {
          a.revision++;
        }
        a.originator = this.deviceState.deviceId;
      });
      let content = JSON.stringify(flows);
      fs.writeFile(this.deviceState.flowFilePath, content, err => {
        if (err) {
          return reject(err);
        }
        this.deviceState.setFlowSignature(content);
        return resolve({data:content, done: () => {
          this._warn('FLOW IS UPDATED! RELOAD THE PAGE NOW!!');
          DeviceManager.restart();
        }});
      });
    });
  }
  
  _performSyncFlows(c) {
    return new Promise((resolve, reject) => {
      try {
        if (c.args.flowUpdateRequired) {
          if (this.deviceState.flowFileSignature !== c.args.expectedSignature) {
            fs.readFile(this.deviceState.flowFilePath, (err, data) => {
              if (err) {
                return reject(err);
              }
              let flows = [];
              try {
                flows = JSON.parse(data);
              } catch (_) {
                return reject({ status: 500, message: 'My flow is invalid' });
              }
              if (c.args.publishable) {
                this._updateLocalFlows(flows).then(result => {
                  return resolve(result);
                }).catch(err => {
                  return reject(err);
                });
              } else {
                data = data.toString('utf-8');
                this.deviceState.setFlowSignature(data);
                return resolve({data: data});
              }
            });
          }
        } else if (this.deviceState.flowFileSignature !== c.args.expectedSignature) {
          // non-primary accounts are NOT allowed to download (to be delivered) flow files
          if (!this.primary) {
            return reject({ status: 405, message: 'not the primary account' });
          }
          return reject({ status: 202, commands: {
            cat: 'sys',
            act: 'deliverflows',
            args: {
              flowId: c.args.flowId
            }
          }});
        } else {
          // 304 Not Modified
          return reject({ status: 304 });
        }
      } catch (err) {
        return reject(err);
      }
    }).then(result => {
      return new Promise(resolve => {
        let status = { status: 202, commands: {
          cat: 'sys',
          act: 'updateflows',
          args: {
            name: path.basename(this.deviceState.flowFilePath),
            signature: this.deviceState.flowFileSignature,
            content: result.data
          },
          done: result.done
        }};
        return resolve(status);
      });
    });
  }
  
  _performUpdateFlows(c) {
    // non-primary accounts are allowed to upload flow files
    return new Promise((resolve, reject) => {
      try {
        if (!c.args.content) {
          return reject({ status: 400 });
        }
        fs.writeFile(this.deviceState.flowFilePath, c.args.content, err => {
          if (err) {
            return reject(err);
          }
          this.deviceState.setFlowSignature(c.args.content);
          return resolve({ status: 200, restart: true });
        });
      } catch (err) {
        return reject(err);
      }
    });
  }

  _performRestart(c) {
    return new Promise((resolve, reject) => {
      if (c) {
        return resolve({ status: 200, restart: true });
      }
      return reject({ status: 400 });
    });
  }
}

export class DeviceState {

  constructor(onFlowFileChanged, onFlowFileRemoved) {
    this.ciotSupported = false;
    this.flowFileSignature = '';
    this.flowFilePath = '';
    this.resolver = new DeviceIdResolver();
    this.wartcher = null;
    this.onFlowFileChanged = onFlowFileChanged;
    this.onFlowFileRemoved = onFlowFileRemoved;
  }
  
  init() {
    return new Promise(resolve => {
      if (this.deviceId) {
        resolve();
      } else {
        this.resolver.resolve().then(id => {
          this.deviceId = id;
          resolve();
        });
      }
    });
  }

  testIfCANDYIoTInstalled() {
    return this.init().then(() => {
      return new Promise((resolve, reject) => {
        let which = cproc.spawn('which', ['ciot'], { timeout: 1000 });
        which.on('close', code => {
          let ciotSupported = (code === 0);
          resolve(ciotSupported);
        });
        which.on('error', err => {
          reject(err);
        });
      }).then(ciotSupported => {
        this.ciotSupported = ciotSupported;
        return new Promise((resolve, reject) => {
          let version = process.env.DEBUG_CIOTV || '';
          if (ciotSupported) {
            let ciot = cproc.spawn('ciot', ['info','version'], { timeout: 1000 });
            ciot.stdout.on('data', data => {
              try {
                let ret = JSON.parse(data);
                version = ret.version;
              } catch (e) {
                RED.log.info(e);
              }
            });
            ciot.on('close', () => {
              resolve(version);
            });
            ciot.on('error', err => {
              reject(err);
            });
          }
          resolve(version);
        });
      });
    });
  }
  
  loadAndSetFlowSignature() {
    return new Promise((resolve, reject) => {
      fs.readFile(this.flowFilePath, (err, data) => {
        if (err) {
          return reject(err);
        }
        return resolve(this.setFlowSignature(data));
      });
    });
  }
  
  setFlowSignature(data) {
    let current = this.flowFileSignature;
    let sha1 = crypto.createHash('sha1');
    sha1.update(data);
    this.flowFileSignature = sha1.digest('hex');
    // true for modified
    return (current !== this.flowFileSignature);
  }
  
  testIfUIisEnabled(flowFilePath) {
    return this.init().then(() => {
      if (flowFilePath && this.flowFilePath !== flowFilePath) {
        this.flowFilePath = flowFilePath;
        if (this.watcher) {
          this.watcher.close();
        }
        this.watcher = null;
      } else {
        flowFilePath = this.flowFilePath;
      }
      return new Promise(resolve => {
        fs.readFile(flowFilePath, (err, data) => {
          if (err) {
            return resolve(true);
          }
          this.setFlowSignature(data);
          RED.log.info(`[CANDY RED] flowFileSignature: ${this.flowFileSignature}`);

          let flows = JSON.parse(data);
          if (!Array.isArray(flows)) {
            return resolve(true);
          }
          resolve(flows.filter(f => {
            return f.type === 'CANDY EGG account';
          }).reduce((p, c) => {
            return p && !c.headless;
          }, true));
        });
      });
    }).then(enabled => {
      return new Promise((resolve, reject) => {
        try {
          if (this.watcher || !this.flowFileSignature) {
            return resolve(enabled);
          }
          this.watcher = chokidar.watch(this.flowFilePath);
          this.watcher.on('change', this.onFlowFileChanged);
          this.watcher.on('unlink', this.onFlowFileRemoved);
          return resolve(enabled);
        } catch (err) {
          return reject(err);
        }
      });
    });
  }
}

export class DeviceManagerStore {
  constructor() {
    this.store = {};
    this.deviceState = new DeviceState(this._onFlowFileChangedFunc(), this._onFlowFileRemovedFunc());
  }

  _onFlowFileChangedFunc() {
    let that = this;
    return (() => {
      let wip = false;
      return () => {
        if (wip) {
          return;
        }
        wip = true;
        that.deviceState.loadAndSetFlowSignature().then(modified => {
          if (!modified) {
            wip = false;
            return;
          }
          Object.keys(that.store).forEach(accountFqn => {
            that.store[accountFqn].publish({
              cat: 'sys',
              act: 'syncflows',
              args: {
                expectedSignature: that.deviceState.flowFileSignature
              }
            });
          });
          wip = false;
        }).catch(err => {
          RED.log.warn(err.stack);
          wip = false;
        });
      };
    }());
  }
  
  _onFlowFileRemovedFunc() {
    let that = this;
    return (() => {
      return () => {
        if (that.deviceState.flowFileSignature) {
          Object.keys(that.store).forEach(accountFqn => {
            if (that.store[accountFqn].primary) {
              that.store[accountFqn].publish({
                cat: 'sys',
                act: 'deliverflows'
              });
            }
          });
        }
      };
    }());
  }
    
  _get(accountFqn) {
    return this.store[accountFqn];
  }
  
  _remove(accountFqn) {
    delete this.store[accountFqn];
  }
  
  isWsClientInitialized(accountFqn) {
    return !!this._get(accountFqn);
  }

  initWsClient(account, accountConfig, webSocketListeners) {
    let accountFqn = accountConfig.accountFqn;
    let primary = (Object.keys(this.store).length === 0);
    if (primary) {
      RED.log.error(`[CANDY RED] This account is PRIMARY: ${accountFqn}`);
    }
    
    let listenerConfig = webSocketListeners.get({
      accountConfig: accountConfig,
      account: account,
      path: 'candy-ws'
    }, {
      headers: {
        'x-acc-fqn': accountFqn,
        'x-acc-user': accountConfig.loginUser,
        'x-device-id': this.deviceState.deviceId,
        'x-hostname': os.hostname(),
        'x-candy-iotv': RED.settings.candyIotVersion,
        'x-candy-redv': RED.settings.candyRedVersion,
      }
    });
    accountConfig.on('close', () => {
      listenerConfig.close();
      this._remove(accountFqn);
      RED.log.info(`[CANDY RED] Disassociated from [${accountFqn}]`);
    });
    this.store[accountFqn] = new DeviceManager(primary, listenerConfig, accountConfig, this.deviceState);
    RED.log.info(`[CANDY RED] Associated with [${accountFqn}]`);
  }
}
