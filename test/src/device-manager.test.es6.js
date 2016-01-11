import { assert } from 'chai';
import { DeviceIdResolver, DeviceManager } from '../../dist/device-manager';
import RED from 'node-red';

RED.init({
  init: function() {}
}, {});
RED.nodes.init(RED.settings);

describe('DeviceIdResolver', () => {
  it('should resolve the unique device identifier', done => {
    let resolver = new DeviceIdResolver(RED);
    resolver.resolve().then(id => {
      console.log(`id = [${id}]`);
      assert.isDefined(id);
      assert.isNotNull(id);
      done();
    }).catch(err => {
      done(err);
    });
  });
});

describe('DeviceManager', () => {
  it('should return whether or not CANDY IoT board is installed', done => {
    let manager = new DeviceManager(RED);
    manager.testIfCANDYIoTInstalled().then(installed => {
      console.log(`installed? => ${installed}`);
      done();
    });
  });
  describe('#isWsClientInitialized()', () => {
    it('should return true if listenerConfig is set', () => {
      let manager = new DeviceManager(RED);
      assert.isFalse(manager.isWsClientInitialized());
      manager.listenerConfig= {};
      assert.isTrue(manager.isWsClientInitialized());
    });
  });
  describe('#testIfUIisEnabled()', () => {
    it('should tell the UI is enabled', done => {
      let manager = new DeviceManager(RED);
      manager.testIfUIisEnabled(__dirname + '/test-flow-enabled.json').then(enabled => {
        assert.isTrue(enabled);
        done();
      });
    });
    it('should tell the UI is DISABLED', done => {
      let manager = new DeviceManager(RED);
      manager.testIfUIisEnabled(__dirname + '/test-flow-disabled.json').then(enabled => {
        assert.isFalse(enabled);
        done();
      });
    });
  });
});
