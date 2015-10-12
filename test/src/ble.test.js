import { assert } from 'chai';
import * as ble from '../../src/ble';

describe('ble', () => {
  describe('#start()', () => {
    it('should throw an error when the given bus is missing', () => {
      assert.throws(() => {
        ble.start();
      }, 'bus is required!');
    });
  });
});