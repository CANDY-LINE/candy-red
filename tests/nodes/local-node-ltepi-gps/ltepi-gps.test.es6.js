'use strict';

import * as sinon from 'sinon';
import { assert } from 'chai';
import RED from 'node-red';
import ltepiGps from '../../../dist/nodes/local-node-ltepi-gps/ltepi-gps';

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('ltepi-gps module', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('should be successfully initialized', () => {
    let registerType = sandbox.stub(RED.nodes, 'registerType');
    ltepiGps(RED);
    assert.isTrue(registerType.calledOnce);
  });

  describe('LTEPiGPSInNode', () => {
    let LTEPiGPSInNode;
    beforeEach(() => {
      RED.nodes.createNode = t => {
        t.status = () => {};
        t.on = () => {};
        t.send = () => {};
      };
      RED.nodes.registerType = (n, t) => {
        LTEPiGPSInNode = t;
      };
    });
    afterEach(() => {
      sandbox.restore();
    });
    describe('#constructor()', () => {
      it('should instantiate LTEPiGPSInNode if LTEPi is supported', () => {
        RED.settings.ltepiVersion = '1.0.0';
        ltepiGps(RED);
        assert.isDefined(LTEPiGPSInNode);
        let node = new LTEPiGPSInNode({
          name: 'my-name',
          useString: false
        });
        assert.equal('my-name', node.name);
        assert.equal(false, node.useString);
        assert.isDefined(node._gpsRun);
      });
      it('should instantiate LTEPiGPSInNode but the instance does not have _gpsRun function when ltepiVersion is N/A', () => {
        RED.settings.ltepiVersion = 'N/A';
        ltepiGps(RED);
        assert.isDefined(LTEPiGPSInNode);
        let node = new LTEPiGPSInNode({
          name: 'my-name',
          useString: false
        });
        assert.equal('my-name', node.name);
        assert.equal(false, node.useString);
        assert.isUndefined(node._gpsRun);
      });
      it('should instantiate LTEPiGPSInNode but the instance does not have _gpsRun function when ltepiVersion is undefined', () => {
        delete RED.settings.ltepiVersion;
        ltepiGps(RED);
        assert.isDefined(LTEPiGPSInNode);
        let node = new LTEPiGPSInNode({
          name: 'my-name',
          useString: false
        });
        assert.equal('my-name', node.name);
        assert.equal(false, node.useString);
        assert.isUndefined(node._gpsRun);
      });
    });
  });
});
