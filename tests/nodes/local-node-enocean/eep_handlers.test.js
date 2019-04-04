/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
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

import { assert } from 'chai';
import { ERP2_HANDLERS } from '../../../dist/nodes/local-node-enocean/lib/eep_handlers';

describe('ERP2_HANDLERS', () => {
  describe('f6-02-04', () => {
    let handler = ERP2_HANDLERS['f6-02-04'];
    it('should return valid state descriptions in the val property', () => {
      assert.equal(true, handler({ dataDl: [0x88] }).ebo);
      assert.equal('I', handler({ dataDl: [0x88] }).rb);
      assert.equal('I', handler({ dataDl: [0x08] }).rb);
      assert.equal('0', handler({ dataDl: [0x84] }).rb);
      assert.equal('0', handler({ dataDl: [0x04] }).rb);
      assert.equal('I', handler({ dataDl: [0x82] }).ra);
      assert.equal('I', handler({ dataDl: [0x02] }).ra);
      assert.equal('0', handler({ dataDl: [0x81] }).ra);
      assert.equal('0', handler({ dataDl: [0x01] }).ra);
      assert.equal(null, handler({ dataDl: [0x01] }).rb);
      assert.equal(false, handler({ dataDl: [0x00] }).ebo);
    });
  });
});
