import * as sinon from 'sinon';
import { assert } from 'chai';
import { DeviceIdResolver, DeviceState } from '../../dist/device-manager';
import os from 'os';
import fs from 'fs';
import stream from 'stream';
import RED from 'node-red';

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
		sandbox = sandbox.restore();
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
		sandbox.stub(fs, 'read').yields(null, 'my-serial-number');
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
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
	});
	afterEach(() => {
		sandbox = sandbox.restore();
	});

  it('should return whether or not CANDY IoT board is installed', done => {
    let state = new DeviceState(() => {}, () => {});
    state.testIfCANDYIoTInstalled().then(version => {
      console.log(`installed version? => ${version}`);
      done();
    }).catch(err => {
      done(err);
    });
  });
  describe('#testIfUIisEnabled()', () => {
    it('should tell the UI is enabled', done => {
      let state = new DeviceState(() => {}, () => {});
      state.testIfUIisEnabled(__dirname + '/test-flow-enabled.json').then(enabled => {
        assert.isTrue(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should tell the UI is DISABLED', done => {
      let state = new DeviceState(() => {}, () => {});
      state.testIfUIisEnabled(__dirname + '/test-flow-disabled.json').then(enabled => {
        assert.isFalse(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});
