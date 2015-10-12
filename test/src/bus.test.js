import { assert } from 'chai';
import * as bus from '../../src/bus';

describe('bus', () => {
  describe('#start()', () => {
    it('should throw an error when the given url is missing', () => {
      assert.throws(() => {
        bus.start();
      }, 'Missing URL!');
    });
  });

  describe('#send()', () => {
    it('should return a rejected Promise instance when the given data is missing', done => {
      bus.send().then(() => {
        assert.fail('should raise error!');
      }).catch(e => {
        assert.equal('no data', e);
        done();
      }).catch(e => {
        done(e);
      });
    });
  });
});
