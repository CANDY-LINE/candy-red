'use strict';
/*
 * GPS Location Node for Node-RED powered by LTEPi board
 *
 */

import cproc from 'child_process';

export default function(RED) {

  if (RED.settings.ltepiGpsTest !== true) {
    let which = cproc.spawnSync('which', ['ltepi_get_gps'], { timeout: 1000 });
    if (which.status !== 0) {
      throw `Info : LTEPiGPS isn't supported on this device`;
    }
  }

  class LTEPiGPSInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.useString = n.useString;
      if (!RED.settings.ltepiVersion || RED.settings.ltepiVersion === 'N/A') {
        RED.log.error(`[LTEPiGPS] LTEPiGPS node won't work without LTEPi. Disabling this node...`);
        this.status({ fill: 'red', shape: 'ring', text: 'ltepi-gps.status.disabled' });
        this.on('input', () => {
          let payload = { status: 'DISALBED', message: 'LTEPiGPS node isn\'t avaialble' };
          if (this.useString) {
            payload = JSON.stringify(payload);
          }
          this.send({ payload: payload });
        });
        return;
      }
      this.status({});
      this._gpsRun = timeoutSec => {
        if (!timeoutSec || timeoutSec < 15) {
          timeoutSec = 15;
        }
        if (timeoutSec > 60 * 5) {
          timeoutSec = 60 * 5;
        }
        return new Promise((resolve, reject) => {
          let gps = cproc.spawn('ltepi_get_gps', [timeoutSec], { timeout: 1000 });
          let ret;
          gps.stdout.on('data', data => {
            if (!data) {
              return;
            }
            data = data.toString().trim();
            if (!data) {
              return;
            }
            try {
              ret = JSON.parse(data);
            } catch (e) {
              RED.log.info(e.stack);
              return resolve({ status: 'ERROR', message: 'LTEPi Service isn\'t available' });
            }
          });
          gps.on('close', code => {
            if (ret) {
              return resolve(ret);
            }
            resolve({ code: code });
          });
          gps.on('error', err => {
            if (err.errno === 'ENOENT') {
              return resolve({ status: 'ERROR', message: 'LTEPi is missing' });
            }
            reject(err);
          });
        });
      };

      this.on('input', msg => {
        this.status({ fill: 'green', shape: 'dot', text: 'ltepi-gps.status.locating' });
        this._gpsRun(msg.timeoutSec || msg.payload ? msg.payload.timeoutSec : 0).then(gps => {
          if (gps.status) {
            if (gps.status === 'OK') {
              gps.ts = new Date(gps.result.time).getTime();
              delete gps.result.status;
              delete gps.result.count;
              delete gps.result.time;
              delete gps.result.smaj;
              delete gps.result.smin;
              delete gps.result.vert;
              delete gps.result.majaa;
              gps.location = gps.result;
              delete gps.result;
            }
            if (this.useString) {
              gps = JSON.stringify(gps);
            }
            this.send({ payload: gps });
            if (gps.status === 'OK') {
              this.status({});
            } else {
              this.status({ fill: 'red', shape: 'dot', text: 'ltepi-gps.status.error' });
            }
          }
        }).catch(err => {
          if (err.stack) {
            RED.log.error('[LTEPiGPS] ' + err.stack);
          }
          this.status({ fill: 'red', shape: 'dot', text: 'ltepi-gps.status.error' });
        });
      });
    }
  }
  RED.nodes.registerType('LTEPiGPS in', LTEPiGPSInNode);
}
