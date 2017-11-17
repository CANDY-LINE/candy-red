/**
 * @license
 * Copyright (c) 2017 CANDY LINE INC.
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

import * as sinon from 'sinon';
import { assert } from 'chai';
import os from 'os';
import fs from 'fs';
import stream from 'stream';
import cproc from 'child_process';
import RED from 'node-red';
import Promise from 'es6-promises';
import { DeviceIdResolver, DeviceState, DeviceManager, DeviceManagerStore } from '../dist/device-manager';

const PROC_CPUINFO = [
  'processor	: 0\n',
  'model name	: ARMv6-compatible processor rev 7 (v6l)\n',
  'BogoMIPS	: 2.00\n',
  'Features	: half thumb fastmult vfp edsp java tls \n',
  'CPU implementer	: 0x41\n',
  'CPU architecture: 7\n',
  'CPU variant	: 0x0\n',
  'CPU part	: 0xb76\n',
  'CPU revision	: 7\n',
  'Hardware	: BCM2708\n',
  'Revision	: 0010\n',
  'Serial		: 00000000ffff9999\n',
  null
];

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('DeviceIdResolver', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should resolve the unique device identifier', done => {
    let resolver = new DeviceIdResolver();
    resolver.resolve().then(id => {
      console.log(`id = [${id}]`);
      assert.isDefined(id);
      assert.isNotNull(id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the serial number', done => {
    let resolver = new DeviceIdResolver();
    sandbox.stub(fs, 'stat').yields();
    sandbox.stub(fs, 'readFile').yields(null, 'my-serial-number\n');
    resolver.resolve().then(id => {
      assert.equal('EDN:my-serial-number', id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the cpuinfo serial', done => {
    let resolver = new DeviceIdResolver();
    sandbox.stub(fs, 'stat').onFirstCall().yields(new Error()).onSecondCall().yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox.stub(fs, 'createReadStream').onFirstCall().returns(readStream);
    resolver.resolve().then(id => {
      assert.equal('RPi:00000000ffff9999', id);
      done();
    }).catch(err => {
      done(err);
    });
  });

  it('should return the MAC address', done => {
    let resolver = new DeviceIdResolver();
    sandbox.stub(fs, 'stat').onFirstCall().yields(new Error())
      .onSecondCall().yields(new Error())
      .onThirdCall().yields();
    sandbox.stub(os, 'networkInterfaces').returns({
      'en0' : [
        { mac: '00:00:00:00:00:00' },
        { mac: 'AA:bb:cc:dd:ee:FF' },
      ]
    });
    resolver.resolve().then(id => {
      assert.equal('MAC:en0:aa-bb-cc-dd-ee-ff', id);
      done();
    }).catch(err => {
      done(err);
    });
  });
});

describe('DeviceState', () => {
  let sandbox;
  let state;
  beforeEach(() => {
    state = new DeviceState(() => {}, () => {});
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#testIfCANDYBoardServiceInstalled("candy-pi-lite")', () => {
    it('should return whether or not CANDY Pi Lite board is installed', done => {
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(version => {
        console.log(`installed version? => [${version}]`);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the installed CANDY Pi Lite Board version', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      let stdout = sandbox.stub({
        on: () => {}
      });
      stdout.on.onFirstCall().yields(JSON.stringify({
        version: '1234'
      }));
      let candy = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onSecondCall().returns(candy);
      candy.on.onFirstCall().yields(0);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(version => {
        assert.deepEqual(['my:deviceId', '1234'], version);
        assert.isTrue(candy.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version as candy service version command fails but the board is dtected', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      let stdout = sandbox.stub({
        on: () => {}
      });
      let candy = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.withArgs('candy', ['service', 'version'], { timeout: 1000 }).returns(candy);
      candy.on.onFirstCall().yields(1);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(version => {
        assert.deepEqual(['my:deviceId', 'offline'], version);
        assert.isTrue(candy.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version as systemctl is-enabled ltepi2 fails', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(1);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('candy-pi-lite').then(version => {
        assert.deepEqual(['my:deviceId', null], version);
        assert.isTrue(systemctl.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#testIfCANDYBoardServiceInstalled("ltepi2")', () => {
    it('should return whether or not LTEPi2 board is installed', done => {
      state.testIfCANDYBoardServiceInstalled('ltepi2').then(version => {
        console.log(`installed version? => [${version}]`);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the installed LTEPi2 Board version', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      let stdout = sandbox.stub({
        on: () => {}
      });
      stdout.on.onFirstCall().yields(JSON.stringify({
        version: '1234'
      }));
      let candy = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onSecondCall().returns(candy);
      candy.on.onFirstCall().yields(0);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('ltepi2').then(version => {
        assert.deepEqual(['my:deviceId', '1234'], version);
        assert.isTrue(candy.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version as candy service version command fails but the board is dtected', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      let stdout = sandbox.stub({
        on: () => {}
      });
      let candy = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.withArgs('candy', ['service', 'version'], { timeout: 1000 }).returns(candy);
      candy.on.onFirstCall().yields(1);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('ltepi2').then(version => {
        assert.deepEqual(['my:deviceId', 'offline'], version);
        assert.isTrue(candy.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should return the empty version as systemctl is-enabled ltepi2 fails', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(1);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      state.deviceId = 'my:deviceId';
      state.testIfCANDYBoardServiceInstalled('ltepi2').then(version => {
        assert.deepEqual(['my:deviceId', null], version);
        assert.isTrue(systemctl.on.called);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#testIfUIisEnabled()', () => {
    it('should tell the UI is enabled', done => {
      state.testIfUIisEnabled(__dirname + '/test-flow-enabled.json').then(enabled => {
        assert.isTrue(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should tell the UI is DISABLED', done => {
      state.testIfUIisEnabled(__dirname + '/test-flow-disabled.json').then(enabled => {
        assert.isFalse(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});

describe('DeviceManager', () => {
  let sandbox, manager;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    let listenerConfig = sandbox.stub({
      registerInputNode: () => {}
    });
    let accountConfig = {
      accountFqn: 'TEST@localhost'
    };
    manager = new DeviceManager(false, listenerConfig, accountConfig, new DeviceState());
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#_enqueue()', () => {
    it('should enqueue a command if valid', () => {
      sandbox.stub(manager, 'publish').returns(new Promise(resolve => resolve()));
      manager._enqueue({});
      manager._enqueue(null);
      manager._enqueue(undefined);
      assert.equal(1, manager.cmdQueue.length);
    });
  });

  describe('#_resume()', () => {
    it('should resume queued commands', done => {
      sandbox.stub(manager, 'publish').returns(new Promise(resolve => resolve()));
      manager._enqueue({});
      manager._enqueue(null);
      manager._enqueue(undefined);
      manager._resume().then(empty => {
        assert.isNotTrue(empty);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should terminate silently when there are not queued commands', done => {
      sandbox.stub(manager, 'publish').returns(new Promise(resolve => resolve()));
      manager._enqueue(null);
      manager._enqueue(undefined);
      manager._resume().then(empty => {
        assert.isTrue(empty);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#_performInspect()', () => {
    it('should return the installed CANDY IoT Board version', done => {
      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      stdout.on.onFirstCall().yields(JSON.stringify({
        'imei': '352339000000000',
        'model': 'AMP5200',
        'manufacturer': 'AM Telecom',
        'revision': '14-01'
      }));
      let ciot = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(ciot);
      ciot.on.yields();

      manager.candyBoardServiceSupported = true;
      manager._performInspect({
        cat: 'sys',
        act: 'inspect'
      }).then(res => {
        assert.equal(200, res.status);
        assert.equal('352339000000000', res.results.imei);
        assert.equal('AMP5200', res.results.model);
        assert.equal('AM Telecom', res.results.manufacturer);
        assert.equal('14-01', res.results.revision);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});

describe('DeviceManagerStore', () => {
  let sandbox, store;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    store = new DeviceManagerStore();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#_onFlowFileChangedFunc()', () => {
    it('should do nothing unless the flow file is modified', done => {
      let promise = sandbox.stub(new Promise());
      promise.then.yields(false); // modified = false
      sandbox.stub(store.deviceState, 'loadAndSetFlowSignature').returns(promise);
      store.deviceState.onFlowFileChanged().then(() => {
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should publish a command when the flow file is modified', done => {
      let promise = sandbox.stub(new Promise());
      promise.then.onFirstCall().yields(true).onFirstCall().returns(promise); // modified = true
      promise.then.onSecondCall().yields(); // Promise.all()
      promise.then.onThirdCall().yields(); // publish
      let listenerConfig = sandbox.stub({
        registerInputNode: () => {}
      });
      let accountConfig = {
        accountFqn: 'TEST@localhost'
      };
      let manager = sandbox.stub(new DeviceManager(false, listenerConfig, accountConfig, new DeviceState()));
      assert.isTrue(listenerConfig.registerInputNode.calledOnce);
      store.store[accountConfig.accountFqn] = manager;
      manager.publish.returns(promise);

      sandbox.stub(store.deviceState, 'loadAndSetFlowSignature').returns(promise);
      store.deviceState.onFlowFileChanged().then(() => {
        assert.isTrue(manager.publish.calledOnce);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });

  describe('#_onFlowFileRemovedFunc()', () => {
    it('should NOT publish a command when deviceState.flowFileSignature exists', done => {
      let promise = sandbox.stub(new Promise());
      promise.then.yields();
      let listenerConfig = sandbox.stub({
        registerInputNode: () => {}
      });
      let accountConfig = {
        accountFqn: 'TEST@localhost'
      };
      let manager = sandbox.stub(new DeviceManager(false, listenerConfig, accountConfig, new DeviceState()));
      assert.isTrue(listenerConfig.registerInputNode.calledOnce);
      store.store[accountConfig.accountFqn] = manager;
      manager.publish.returns(promise);

      store.deviceState.onFlowFileRemoved().then(() => {
        assert.isFalse(manager.publish.calledOnce);
        done();
      }).catch(err => {
        done(err);
      });
    });

    it('should publish a command when deviceState.flowFileSignature exists', done => {
      let promise = sandbox.stub(new Promise());
      promise.then.yields();
      store.deviceState.flowFileSignature = 'test';

      let listenerConfig = sandbox.stub({
        registerInputNode: () => {}
      });
      let accountConfig = {
        accountFqn: 'TEST@localhost'
      };
      let manager = sandbox.stub(new DeviceManager(true, listenerConfig, accountConfig, new DeviceState()));
      assert.isTrue(listenerConfig.registerInputNode.calledOnce);
      store.store[accountConfig.accountFqn] = manager;
      manager.publish.returns(promise);

      let listenerConfig2 = sandbox.stub({
        registerInputNode: () => {}
      });
      let accountConfig2 = {
        accountFqn: 'TEST2@localhost'
      };
      let manager2 = sandbox.stub(new DeviceManager(false, listenerConfig2, accountConfig2, new DeviceState()));
      assert.isTrue(listenerConfig2.registerInputNode.calledOnce);
      store.store[accountConfig2.accountFqn] = manager2;

      store.deviceState.onFlowFileRemoved().then(() => {
        assert.isTrue(manager.publish.calledOnce);
        done();
      }).catch(err => {
        done(err);
      });
    });
  }); /* #_onFlowFileRemovedFunc() */

});
