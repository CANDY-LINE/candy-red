'use strict';

import { assert } from 'chai';
import { ERP2_HANDLERS } from '../../../../src/nodes/local-node-enocean/lib/eep_handlers';

describe('ERP2_HANDLERS', () => {
  describe('f6-02-04', () => {
    let handler = ERP2_HANDLERS['f6-02-04'];
    it('should return valid state descriptions in the val property', () => {
      assert.equal('RBI', handler({ dataDl: [0x88] }).val);
      assert.equal('RBI', handler({ dataDl: [0x08] }).val);
      assert.equal('RB0', handler({ dataDl: [0x84] }).val);
      assert.equal('RB0', handler({ dataDl: [0x04] }).val);
      assert.equal('released', handler({ dataDl: [0x00] }).val);
    });
  });
});