import * as sinon from 'sinon';
import { assert } from 'chai';
import os from 'os';
import fs from 'fs';
import stream from 'stream';
import RED from 'node-red';
import Promise from 'es6-promises';
import { DeviceIdResolver, DeviceState, DeviceManager, DeviceManagerStore } from '../../dist/device-manager';

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

describe('DeviceManagerStore', () => {
	let sandbox, store;
	beforeEach(() => {
		sandbox = sinon.sandbox.create();
		store = new DeviceManagerStore();
	});
	afterEach(() => {
		sandbox = sandbox.restore();
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
			promise.then.onFirstCall().yields(true).returns(promise); // modified = true
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
	});
});