/**
 * @license
 * Copyright (c) 2020 CANDY LINE INC.
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

/* global describe, beforeEach, afterEach, it */

import * as sinon from 'sinon';
import { assert } from 'chai';
import os from 'os';
import fs from 'fs';
import stream from 'stream';
import cproc from 'child_process';
import RED from 'node-red';
import { DefaultDeviceIdResolver, DeviceState } from './index';

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
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should resolve the unique device identifier', done => {
    let resolver = new DefaultDeviceIdResolver();
    resolver
      .resolve()
      .then(id => {
        console.log(`id = [${id}]`);
        assert.isDefined(id);
        assert.isNotNull(id);
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it('should return the cpuinfo serial if the device model is RPi', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox
      .stub(fs, 'stat')
      .onFirstCall()
      .yields()
      .onSecondCall()
      .yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox
      .stub(fs, 'createReadStream')
      .onFirstCall()
      .returns(readStream);
    sandbox
      .stub(fs, 'readFileSync')
      .onFirstCall()
      .returns('Raspberry Pi 3 Model B Rev 1.2');
    resolver
      .resolve()
      .then(id => {
        assert.equal('RPi:00000000ffff9999', id);
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it('should return the cpuinfo serial if the device model is ATB', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox
      .stub(fs, 'stat')
      .onFirstCall()
      .yields()
      .onSecondCall()
      .yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox
      .stub(fs, 'createReadStream')
      .onFirstCall()
      .returns(readStream);
    sandbox
      .stub(fs, 'readFileSync')
      .onFirstCall()
      .returns('Tinker Board\n\0\0\0\0\0');
    resolver
      .resolve()
      .then(id => {
        assert.equal('ATB:00000000ffff9999', id);
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it('should return the cpuinfo serial if the device model is a generic Linux', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox
      .stub(fs, 'stat')
      .onFirstCall()
      .yields()
      .onSecondCall()
      .yields();
    let i = 0;
    let readStream = new stream.Readable();
    readStream._read = () => {
      readStream.push(PROC_CPUINFO[i++]);
    };
    sandbox
      .stub(fs, 'createReadStream')
      .onFirstCall()
      .returns(readStream);
    sandbox
      .stub(fs, 'readFileSync')
      .onFirstCall()
      .returns('Generic Linux\n\0\0\0\0\0');
    resolver
      .resolve()
      .then(id => {
        assert.equal('DEV:00000000ffff9999', id);
        done();
      })
      .catch(err => {
        done(err);
      });
  });

  it('should return the MAC address', done => {
    let resolver = new DefaultDeviceIdResolver();
    sandbox
      .stub(fs, 'stat')
      .onFirstCall()
      .yields(new Error())
      .onSecondCall()
      .yields()
      .onCall(4)
      .yields();
    sandbox.stub(os, 'networkInterfaces').returns({
      en0: [{ mac: '00:00:00:00:00:00' }, { mac: 'AA:bb:cc:dd:ee:FF' }]
    });
    resolver
      .resolve()
      .then(id => {
        assert.equal('MAC:en0:aa-bb-cc-dd-ee-ff', id);
        done();
      })
      .catch(err => {
        done(err);
      });
  });
});

describe('DeviceState', () => {
  let sandbox;
  let state;
  beforeEach(() => {
    state = new DeviceState(
      () => {},
      () => {}
    );
    sandbox = sinon.createSandbox();
  });
  afterEach(() => {
    sandbox.restore();
  });

  describe('#testIfCANDYBoardServiceInstalled("candy-pi-lite")', () => {
    it('should return whether or not CANDY Pi Lite board is installed', done => {
      state
        .testIfCANDYBoardServiceInstalled('candy-pi-lite')
        .then(version => {
          console.log(`installed version? => [${version}]`);
          done();
        })
        .catch(err => {
          done(err);
        });
    });

    it('should return the empty version', done => {
      let stubCproc = sandbox.stub(cproc);
      let systemctl = sandbox.stub({
        on: () => {}
      });
      systemctl.on.onFirstCall().yields(0);
      stubCproc.spawn.onFirstCall().returns(systemctl);

      state.deviceId = 'my:deviceId';
      state
        .testIfCANDYBoardServiceInstalled('candy-pi-lite')
        .then(result => {
          assert.deepEqual(['my:deviceId'], result);
          done();
        })
        .catch(err => {
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
      state
        .testIfCANDYBoardServiceInstalled('candy-pi-lite')
        .then(result => {
          assert.deepEqual(['my:deviceId'], result);
          assert.isTrue(systemctl.on.called);
          done();
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('#initWithFlowFilePath()', () => {
    it('should successfully init DeviceState object', async () => {
      await state.initWithFlowFilePath(__dirname + '/test-flow.json');
      state._unwatchFlowFilePath();
    });
  });
});
