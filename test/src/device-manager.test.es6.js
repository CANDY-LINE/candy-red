import { assert } from 'chai';
import { DeviceIdResolver, DeviceState } from '../../dist/device-manager';
import RED from 'node-red';


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

describe('DeviceState', () => {
  it('should return whether or not CANDY IoT board is installed', done => {
    let state = new DeviceState(() => {}, () => {}, RED);
    state.testIfCANDYIoTInstalled().then(version => {
      console.log(`installed version? => ${version}`);
      done();
    }).catch(err => {
      done(err);
    });
  });
  describe('#testIfUIisEnabled()', () => {
    it('should tell the UI is enabled', done => {
      let state = new DeviceState(() => {}, () => {}, RED);
      state.testIfUIisEnabled(__dirname + '/test-flow-enabled.json').then(enabled => {
        assert.isTrue(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
    it('should tell the UI is DISABLED', done => {
      let state = new DeviceState(() => {}, () => {}, RED);
      state.testIfUIisEnabled(__dirname + '/test-flow-disabled.json').then(enabled => {
        assert.isFalse(enabled);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});
