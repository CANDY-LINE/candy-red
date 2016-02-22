import * as sinon from 'sinon';
import { assert } from 'chai';
import os from 'os';
import fs from 'fs';
import cproc from 'child_process';
import RED from 'node-red';
import Promise from 'es6-promises';
import { StatsCollector } from '../../../dist/nodes/local-node-device-stats/lib/stats';

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('Stats', () => {
  let sandbox;
  let samples = {};
  before(done => {
    fs.readdir(`${__dirname}/samples/`, (err, files) => {
      if (err) {
        return done(err);
      }
      Promise.all(
        files.map(f => {
          return new Promise((resolve, reject) => {
            fs.readFile(`${__dirname}/samples/${f}`, (err, data) => {
              if (err) {
                return reject(err);
              }
              samples[f] = data.toString();
              resolve();
            });
          });
        })
      ).then(() => {
        done();
      });
    });
  });
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#collect', () => {
    it('should prefer the constructor settings if the given arg is numeric', done => {
      let collector = new StatsCollector({
        mem: true
      });
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      let free = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(free);
      stdout.on.onFirstCall().yields(samples['candyiot-free.txt']);
      free.on.onFirstCall().yields(0);
      collector.collect(12345).then(stats => {
        assert.isDefined(stats.mem);
        assert.strictEqual(789468, stats.mem.free);
        assert.strictEqual(0, stats.mem.swapused);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
  it('should prefer the constructor settings if the given arg is string', done => {
    let collector = new StatsCollector({
      mem: true
    });
    let stubCproc = sandbox.stub(cproc);
    let stdout = sandbox.stub({
      on: () => {}
    });
    let free = sandbox.stub({
      stdout: stdout,
      on: () => {}
    });
    stubCproc.spawn.onFirstCall().returns(free);
    stdout.on.onFirstCall().yields(samples['candyiot-free.txt']);
    free.on.onFirstCall().yields(0);
    collector.collect('abcdefg').then(stats => {
      assert.isDefined(stats.mem);
      assert.strictEqual(789468, stats.mem.free);
      assert.strictEqual(0, stats.mem.swapused);
      done();
    }).catch(err => {
      done(err);
    });
  });
  it('should prefer the collect arg if it is an object', done => {
    let collector = new StatsCollector({
      mem: true
    });
    collector.collect({}).then(stats => {
      assert.isUndefined(stats.mem);
      done();
    }).catch(err => {
      done(err);
    });
  });

  describe('#mem', () => {
    it('should parse CANDY IoT free result', done => {
      let collector = new StatsCollector({
        mem: true
      });
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      let free = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(free);
      stdout.on.onFirstCall().yields(samples['candyiot-free.txt']);
      free.on.onFirstCall().yields(0);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.mem);
        assert.strictEqual(789468, stats.mem.free);
        assert.strictEqual(193652, stats.mem.used);
        assert.strictEqual(0, stats.mem.swapused);
        assert.strictEqual(0, stats.mem.swapfree);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should parse LTEPi free result', done => {
      let collector = new StatsCollector({
        mem: true
      });
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      let free = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(free);
      stdout.on.onFirstCall().yields(samples['ltepi-free.txt']);
      free.on.onFirstCall().yields(0);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.mem);
        assert.strictEqual(285276, stats.mem.free);
        assert.strictEqual(160124, stats.mem.used);
        assert.strictEqual(0, stats.mem.swapused);
        assert.strictEqual(102396, stats.mem.swapfree);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should parse CentOS 7 free result', done => {
      let collector = new StatsCollector({
        mem: true
      });
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      let free = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(free);
      stdout.on.onFirstCall().yields(samples['centos7-free.txt']);
      free.on.onFirstCall().yields(0);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.mem);
        assert.strictEqual(921944, stats.mem.free);
        assert.strictEqual(315876, stats.mem.used);
        assert.strictEqual(0, stats.mem.swapused);
        assert.strictEqual(1048572, stats.mem.swapfree);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should not contain the mem info', done => {
      let collector = new StatsCollector({
        mem: true
      });
      collector.collect({
        mem: false
      }).then(stats => {
        assert.isUndefined(stats.mem);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should return mem info even if free is unavailable', done => {
      let collector = new StatsCollector({
        mem: true
      });
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      let free = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(free);
      free.on.onFirstCall().yields(1);

      sandbox.stub(os, 'freemem').returns(1024);
      sandbox.stub(os, 'totalmem').returns(4096);

      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.mem);
        assert.strictEqual(1, stats.mem.free);
        assert.strictEqual(3, stats.mem.used);
        assert.isUndefined(stats.mem.swapused);
        assert.isUndefined(stats.mem.swapfree);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#nw', () => {
    it('should parse CANDY IoT /proc/net/dev result', done => {
      let collector = new StatsCollector({
        nw: true
      });
      sandbox.stub(fs, 'readFile').yields(null, samples['candyiot-proc_net_dev.txt']);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.nw.wlan0);
        assert.isDefined(stats.nw.enp0s17u1);
        assert.strictEqual(5574847, stats.nw.wlan0.rx);
        assert.strictEqual(11530077, stats.nw.wlan0.tx);
        assert.strictEqual(2917067, stats.nw.enp0s17u1.rx);
        assert.strictEqual(3496197, stats.nw.enp0s17u1.tx);
        assert.isUndefined(stats.nw.sit0);
        assert.isUndefined(stats.nw.lo);
        assert.isUndefined(stats.nw.usb0);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should parse LTEPi /proc/net/dev result', done => {
      let collector = new StatsCollector({
        nw: true
      });
      sandbox.stub(fs, 'readFile').yields(null, samples['ltepi-proc_net_dev.txt']);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.nw.eth0);
        assert.isDefined(stats.nw.usb0);
        assert.strictEqual(69818374, stats.nw.eth0.rx);
        assert.strictEqual(46961696, stats.nw.eth0.tx);
        assert.strictEqual(4363, stats.nw.usb0.rx);
        assert.strictEqual(12020, stats.nw.usb0.tx);
        assert.isUndefined(stats.nw.lo);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should parse CentOS 7 /proc/net/dev result', done => {
      let collector = new StatsCollector({
        nw: true
      });
      sandbox.stub(fs, 'readFile').yields(null, samples['centos7-proc_net_dev.txt']);
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.nw.veth60d2548);
        assert.isDefined(stats.nw['br-2b6e43be63d8']);
        assert.isDefined(stats.nw.veth88c9988);
        assert.strictEqual(648, stats.nw.veth60d2548.rx);
        assert.strictEqual(10350, stats.nw.veth60d2548.tx);
        assert.strictEqual(2256, stats.nw['br-2b6e43be63d8'].rx);
        assert.strictEqual(648, stats.nw['br-2b6e43be63d8'].tx);
        assert.strictEqual(8724, stats.nw.veth88c9988.rx);
        assert.strictEqual(103723, stats.nw.veth88c9988.tx);
        assert.isUndefined(stats.nw.lo);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should not contain the nw info', done => {
      let collector = new StatsCollector({
        nw: true
      });
      collector.collect({
        nw: false
      }).then(stats => {
        assert.isUndefined(stats.nw);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#load', () => {
    it('should return unix load average result', done => {
      sandbox.stub(os, 'loadavg').returns([1.18, 1.19, 0.01]);
      let collector = new StatsCollector({
        load: true
      });
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.load);
        assert.equal(3, stats.load.length);
        assert.strictEqual(1.18, stats.load[0]);
        assert.strictEqual(1.19, stats.load[1]);
        assert.strictEqual(0.01, stats.load[2]);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should not contain the load info', done => {
      let collector = new StatsCollector({
        load: true
      });
      collector.collect({
        load: false
      }).then(stats => {
        assert.isUndefined(stats.load);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#hostname', () => {
    it('should return hostname result', done => {
      sandbox.stub(os, 'hostname').returns('my-ltepi');
      let collector = new StatsCollector({
        hostname: true
      });
      collector.collect().then(stats => {
        console.log(JSON.stringify(stats));
        assert.isDefined(stats.hostname);
        assert.equal('my-ltepi', stats.hostname);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should not contain the hostname', done => {
      let collector = new StatsCollector({
        hostname: true
      });
      collector.collect({
        hostname: false
      }).then(stats => {
        assert.isUndefined(stats.hostname);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});
