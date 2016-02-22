'use strict';

import Promise from 'es6-promises';
import fs from 'fs';
import os from 'os';
import cproc from 'child_process';

export class StatsCollector {
  constructor(opts) {
    this.opts = {};
    if (opts) {
      ['mem', 'nw', 'load', 'hostname'].forEach(p => {
        this.opts[p] = opts[p];
      });
    }
  }

  collect(opts) {
    if (typeof(opts) !== 'object') {
      opts = this.opts;
    }
    let stats = {
      tstamp: new Date().getTime(),
      uptime: os.uptime()
    };
    let promises = [];
    if (opts.mem) {
      promises.push(this._mem(stats));
    }
    if (opts.nw) {
      promises.push(this._nw(stats));
    }
    if (opts.load) {
      promises.push(this._load(stats));
    }
    if (opts.hostname) {
      promises.push(this._hostname(stats));
    }
    return new Promise((resolve, reject) => {
      Promise.all(promises).then(() => {
        resolve(stats);
      }).catch(err => {
        reject(err);
      });
    });
  }

  _mem(stats) {
    return new Promise(resolve => {
      let free = cproc.spawn('free', [], { timeout: 1000 });
      free.stdout.on('data', data => {
        stats.mem = this._parseFree(data.toString());
      });
      let handleError = errOrCode => {
        if (errOrCode === 0) {
          return resolve();
        }
        let freemem = os.freemem();
        stats.mem = {
          free: freemem / 1024,
          used: (os.totalmem() - freemem) / 1024
        };
        return resolve();
      };
      free.on('close', handleError);
      free.on('error', handleError);
    });
  }

  _parseFree(text) {
    let mem = {};
    let lines = text.split('\n').slice(1);
    lines.forEach(l => {
      if (l.indexOf('Mem:') === 0) {
        let cols = l.split(' ').filter(c => {
          return c;
        });
        mem.used = parseInt(cols[2]);
        mem.free = parseInt(cols[3]);
      }
      if (l.indexOf('Swap:') === 0) {
        let cols = l.split(' ').filter(c => {
          return c;
        });
        mem.swapused = parseInt(cols[2]);
        mem.swapfree = parseInt(cols[3]);
      }
    });
    return mem;
  }

  _nw(stats) {
    return new Promise(resolve => {
      fs.readFile('/proc/net/dev', (err, data) => {
        if (!err) {
          stats.nw = this._parseProcNetDev(data.toString());
        }
        resolve();
      });
    });
  }

  _parseProcNetDev(text) {
    let nw = {};
    let lines = text.split('\n').slice(2);
    lines.forEach(l => {
      let cols = l.split(' ').filter(c => {
        return c;
      });
      if (cols.length === 0) {
        return;
      }
      let rx = cols[1];
      let tx = cols[9];
      if (rx < 1 || tx < 1) {
        return;
      }
      let name = cols[0].substring(0, cols[0].length - 1);
      if (name === 'lo') {
        return;
      }
      nw[name] = {
        rx: parseInt(rx),
        tx: parseInt(tx)
      };
    });
    return nw;
  }

  _load(stats) {
    return new Promise(resolve => {
      stats.load = os.loadavg();
      resolve();
    });
  }

  _hostname(stats) {
    return new Promise(resolve => {
      stats.hostname = os.hostname();
      resolve();
    });
  }
}
