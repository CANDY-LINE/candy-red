'use strict';

import * as sinon from 'sinon';
import { assert } from 'chai';
import RED from 'node-red';
import stats from '../../../dist/nodes/local-node-device-stats/device-stats';

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('device-stats module', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should be successfully initialized', () => {
    let registerType = sandbox.stub(RED.nodes, 'registerType');
    stats(RED);
    assert.isTrue(registerType.calledOnce);
  });
});
