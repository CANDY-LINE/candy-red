/**
 * @license
 * Copyright (c) 2018 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import 'source-map-support/register';
import cproc from 'child_process';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';

export default function(RED) {

  class GNSSClient extends EventEmitter {
    constructor(opts={
      log: () => {},
      trace: () => {}
    }) {
      super();
      this.log = opts.log ? opts.log.bind(opts) : console.log;
      this.trace = opts.trace ? opts.trace.bind(opts) : console.log;
      this.output = null;
      this.name = null;
      this.runOnStartup = false;
      this.runCommandTask = null;
    }

    init() {
      return this.loadGNSSConfig().then(() => {
        if (this.isEnabled()) {
          RED.log.info('CANDY Pi Lite GNSS Client is enabled');
          if (this.runOnStartup) {
            this.scheduleRunCommand(5000);
          }
        } else {
          RED.log.info('CANDY Pi Lite GNSS Client is disabled');
        }
        return Promise.resolve();
      });
    }

    scheduleRunCommand(timeout=2000) {
      if (this.runCommandTask) {
        clearTimeout(this.runCommandTask);
      }
      this.runCommandTask = setTimeout(() => {
        this.execute('start').then((ev) => {
          if (ev.code !== 0) {
            this.scheduleRunCommand();
          }
        }).catch((err) => {
          RED.log.error(err.message || err);
          if (err.code !== 'ENOENT') {
            this.scheduleRunCommand(10000);
          }
        });
      }, timeout);
    }

    getNMEAPort() {
      try {
        let port = fs.readdirSync('/dev').filter(f => f.match('QWS\.[A-Z0-9]*\.NMEA'));
        if (port.length < 1) {
          return RED._('candy-pi-lite-gnss.nmeaPort.na');
        }
        return `/dev/${port[0]}`;
      } catch (_) {
        return RED._('candy-pi-lite-gnss.nmeaPort.na');
      }
    }

    createGNSSfilePath() {
      return path.join(RED.settings.userDir, 'candy-pi-lite-gnss.json');
    }

    saveGNSSConfig() {
      return new Promise((resolve, reject) => {
        fs.writeFile(this.createGNSSfilePath(), JSON.stringify({
          name: this.name,
          runOnStartup: this.runOnStartup
        }), (err) => {
          if (err) {
            RED.log.error(err);
            return reject('Failed to write GNSS config');
          }
        });
      });
    }

    loadGNSSConfig() {
      return new Promise((resolve) => {
        fs.readFile(this.createGNSSfilePath(), (err, data) => {
          if (err) {
            return resolve();
          }
          try {
            let config = JSON.parse(data.toString());
            this.name = config.name;
            this.runOnStartup = config.runOnStartup;
          } catch (_) {
          }
          return resolve();
        });
      });
    }

    transform(input, outformat) {
      let output = input;
      output.name = this.name || 'CANDY Pi Lite/+ GNSS';
      switch (outformat) {
        case 'worldmap':
          output.lat = output.latitude;
          output.lon = output.longitude;
          output.speed = output.spkm;
          output.accuracy = output.hdop;
          // bearing:north=180,east=270 cog:north=0,east=90
          output.bearing = (output.cog + 180) % 360;
          delete output.latitude;
          delete output.longitude;
          delete output.spkm;
          delete output.hdop;
          delete output.cog;
          break;
        case 'raw':
          break;
        default:
      }
      return output;
    }

    execute(cmd, outformat) {
      return new Promise((resolve, reject) => {
        if (this.isExecuting()) {
          return reject(RED._('candy-pi-lite-gnss.errors.alreadyExecuting'));
        }
        if (!cmd || cmd.indexOf(' ') >= 0 || 'start stop status locate'.indexOf(cmd) < 0) {
          return reject(RED._('candy-pi-lite-gnss.errors.unknownCommand', {cmd: cmd}));
        }
        let args = ['gnss', cmd, '--suspend', '--resume'];
        let status;
        switch (cmd) {
          case 'start':
            status = 'starting';
            break;
          case 'stop':
            status = 'stopping';
            break;
          case 'status':
            status = 'executing';
            break;
          case 'locate':
            status = 'positioning';
            args.push('--format=2');
          break;
          default:
        }
        this.output = '';
        this.cproc = cproc.spawn(`candy`, args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['pipe', 'pipe', 'ignore']
        });
        this.emit(status);
        this.cproc.on('error', (err) => {
          this.cproc = null;
          this.emit('ended');
          this.emit('error');
          if (err.code === 'ENOENT') {
            err.message = RED._('candy-pi-lite-gnss.errors.setupError');
          }
          return reject(err);
        });
        this.cproc.on('exit', (code) => {
          this.log(`Command Done: pid => ${this.cproc.pid}, code => ${code}`);
          this.cproc = null;
          let result = this.output;
          let status = '';
          switch (cmd) {
            case 'start':
            case 'stop':
            case 'status':
              if (code === 0) {
                status = 'idle';
              } else {
                status = 'error';
              }
              break;
            case 'locate':
              status = 'error';
              if (result === 'Not fixed yet') {
                status = 'unfixed';
              } else if (code === 0) {
                try {
                  result = this.transform(JSON.parse(result), outformat);
                  status = 'idle';
                } catch (_) {
                }
              }
              break;
            default:
          }
          let ev = {
            cmd: cmd,
            code: code,
            result: result
          };
          this.emit(status);
          this.emit('ended', ev);
          return resolve(ev);
        });
        this.cproc.stdout.on('data', (data) => {
          let text =  data
            .toString()
            .trim()
            .replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          this.trace(`<stdout> cmd => [${cmd}], output => [${text}]`);
          this.output += text;
        });
      });
    }

    isExecuting() {
      return !!this.cproc;
    }

    add(node) {
      if (node) {
        this.nodes = (this.nodes || []).push(node);
      }
      return this.nodes || [];
    }

    remove(node) {
      if (node && this.node) {
        this.node.remove(node);
      }
    }

    isEnabled() {
      return this.node && this.node.length > 0;
    }

    shutdown() {
      let isExecuting = this.isExecuting();
      return new Promise((resolve) => {
        if (isExecuting) {
          this.cproc.kill('SIGINT');
          this.once('ended', () => {
              return resolve(true);
          });
        } else {
          return resolve();
        }
      });
    }
  }

  const gnssClient = new GNSSClient();
  let exitHandler = () => {
    gnssClient.shutdown();
  };
  process.on('exit', exitHandler);
  if (RED.settings && RED.settings.exitHandlers) {
    RED.settings.exitHandlers.push(exitHandler);
  }

  class CANDYPiLiteGNSSInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.outformat = n.outformat || 'worldmap';
      ['starting', 'stopping', 'executing'].forEach((ev) => {
        gnssClient.on(ev, () => {
          this.status({fill:'blue', shape:'dot', text: `candy-pi-lite-gnss.status.${ev}`});
        });
      });
      ['positioning'].forEach((ev) => {
        gnssClient.on(ev, () => {
          this.status({fill:'green', shape:'dot', text: `candy-pi-lite-gnss.status.${ev}`});
        });
      });
      ['idle', 'unfixed'].forEach((ev) => {
        gnssClient.on(ev, () => {
          this.status({fill:'grey', shape:'ring', text: `candy-pi-lite-gnss.status.${ev}`});
        });
      });
      ['error'].forEach((ev) => {
        gnssClient.on(ev, () => {
          this.status({fill:'red', shape:'ring', text: `candy-pi-lite-gnss.status.${ev}`});
        });
      });
      gnssClient.add(this);
      this.on('close', () => {
        gnssClient.remove(this);
      });
      this.on('input', (msg) => {
        gnssClient.execute(msg.topic, this.outformat, this.name).then((result) => {
          this.send({
            topic: msg.topic,
            code: result.code,
            payload: result.result
          });
        }).catch((err) => {
          let obj = err.payload ? err : { payload: err, topic: msg.topic };
          this.error(`CANDY Pi Lite/+ gnss in error`, obj);
        });
      });
    }
  }
  RED.nodes.registerType('CANDY Pi Lite/+ gnss in', CANDYPiLiteGNSSInNode);

  RED.httpAdmin.get('/candy-pi-lite-gnss', RED.auth.needsPermission('candy-pi-lite-gnss.read'), (req, res) => {
    res.json({
      name: gnssClient.name,
      runOnStartup: gnssClient.runOnStartup,
      nmeaPort: gnssClient.getNMEAPort() || RED._('candy-pi-lite-gnss.nmeaPort.na')
    });
  });

  RED.httpAdmin.post('/candy-pi-lite-gnss', RED.auth.needsPermission('candy-pi-lite-gnss.write'), (req, res) => {
    gnssClient.name = req.body.name;
    gnssClient.runOnStartup = req.body.runOnStartup;
    gnssClient.saveGNSSConfig().then(() => {
      res.sendStatus(200);
    }).catch(() => {
      res.sendStatus(500);
    });
  });

  RED.events.on('runtime-event', (ev) => {
    if (ev.id === 'runtime-state') {
      gnssClient.init().then(() => {
        gnssClient.emit('idle');
      });
    }
  });
}
