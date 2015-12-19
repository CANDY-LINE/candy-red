'use strict';

import { assert } from 'chai';
import RED from 'node-red';
import asakusaGikenModule from '../../../../dist/nodes/local-node-asakusa_giken/asakusa_giken.js';
import * as ble from '../../../../dist/nodes/local-node-asakusa_giken/lib/ble';

RED.debug = true;
RED.init({
  init: function() {}
}, {});
RED.nodes.init(RED.settings);

describe('asakusa_giken node', () => {
  describe('asakusa_giken module', () => {
    it('should have valid Node-RED plugin classes', done => {
      assert.isNotNull(RED);
      asakusaGikenModule(RED).then(() => {
        assert.isNotNull(RED.nodes.getType('BLECAST_BL').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_BL in').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_TM').name);
        assert.isNotNull(RED.nodes.getType('BLECAST_TM in').name);
        ble.stop(RED);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});