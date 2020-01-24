/**
 * @license
 * Copyright (c) 2020 CANDY LINE INC.
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

/* global describe, beforeEach, afterEach, it */

import * as sinon from 'sinon';
import { assert } from 'chai';
import fs from 'fs';
import RED from 'node-red';
import { DeviceState } from './device-state';
import { LwM2MDeviceManagementBase } from './lwm2m-device-management-base';

const server = sinon.spy();
const settings = sinon.spy();
RED.init(server, settings);

describe('LwM2MDeviceManagementBase', () => {
  let sandbox;
  let lwm2mdm;
  let state;
  beforeEach(() => {
    state = new DeviceState(
      () => {},
      () => {}
    );
    lwm2mdm = new LwM2MDeviceManagementBase(state);
    sandbox = sinon.createSandbox();
    RED.log.debug = console.log;
  });
  afterEach(() => {
    delete process.env.DEVICE_MANAGEMENT_ENABLED;
    sandbox.restore();
  });

  describe('#readResources', () => {
    it('should return the loaded MO values', async () => {
      const stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.once.onCall(0).yields({
        payload: [
          {
            uri: '/3/0/0',
            value: {
              value: 'CANDY LINE'
            }
          }
        ]
      });
      stubEvent.once.onCall(1).yields({
        error: true,
        payload: 'Expected Error'
      });

      let res;
      res = await lwm2mdm.readResources('/3/0/0');
      assert.equal('CANDY LINE', res[0].value.value);
      try {
        await lwm2mdm.readResources('/11/0/24');
        throw new Error('fail');
      } catch (err) {
        assert.equal(err, 'Expected Error');
      }
    });
  });

  describe('#writeResource', () => {
    it('should store a resource', async () => {
      const stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.once.onCall(0).yields({});
      stubEvent.once.onCall(1).yields({
        error: true,
        payload: 'Expected Error'
      });

      await lwm2mdm.writeResource('/3/0/0', 'MY MAN');
      try {
        await lwm2mdm.writeResource('/no-such-obj/0/0', 'MY MAN');
        throw new Error('should fail!');
      } catch (err) {
        assert.equal(err, 'Expected Error');
      }
    });
  });

  describe('#syncObjects', () => {
    it('should sync local resources', async () => {
      const stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.once.onCall(0).yields({
        payload: [
          {
            uri: '/42801/0/4',
            value: {
              value: 2
            }
          },
          {
            uri: '/42802/0/0',
            value: {
              value: 'user2'
            }
          },
          {
            uri: '/42802/0/1',
            value: {
              value: 'pass2'
            }
          },
          {
            uri: '/42802/0/2',
            value: {
              acl: 'RWD',
              value: true
            }
          }
        ]
      });

      lwm2mdm.objects = {
        42801: {
          0: {
            4: {
              type: 'INTEGER',
              value: 1
            }
          }
        },
        42802: {
          0: {
            0: {
              type: 'STRING',
              value: 'myuser'
            },
            1: {
              type: 'STRING',
              sensitive: true,
              value: 'mypass'
            },
            2: {
              type: 'BOOLEAN',
              acl: 'R',
              value: false
            }
          }
        }
      };
      const numOfUpdates = await lwm2mdm.syncObjects();
      assert.equal(numOfUpdates, 4);
      assert.equal(lwm2mdm.objects['42801']['0']['4'].value, 2);
      assert.equal(lwm2mdm.objects['42802']['0']['1'].value, 'pass2');
      assert.equal(lwm2mdm.objects['42802']['0']['2'].value, true);
      assert.equal(lwm2mdm.objects['42802']['0']['2'].acl, 'RWD');
    });
  });

  describe('#installFlow', () => {
    it('should install a new flow', async () => {
      let stubUninstallFlow = sandbox.stub(lwm2mdm, 'uninstallFlow');
      stubUninstallFlow.returns();
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow.json`;

      const installed = await lwm2mdm.installFlow(
        'c+ 2JCIE-BU',
        `${__dirname}/test-flow-installable.json`
      );
      assert.isTrue(installed);

      const installedFlow = JSON.parse(
        fs.readFileSync(state.flowFilePath).toString()
      );
      assert.equal(installedFlow.filter(n => n.type === 'tab').length, 2);
      assert.equal(
        installedFlow
          .filter(n => n.type === 'tab')
          .filter(n => n.label === 'c+ 2JCIE-BU').length,
        1
      );
      assert.equal(
        installedFlow.filter(n => n.z === '').length,
        2, // was 1 prior to installation
        'global scope nodes should be added after installation.'
      );
    });
  });

  describe('#uninstallFlow', () => {
    it('should uninstall a new flow', async () => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow-uninstallable.json`;

      const uninstalled = await lwm2mdm.uninstallFlow('c+ 2JCIE-BU');
      assert.isTrue(uninstalled);
      const uninstalledFlow = JSON.parse(
        fs.readFileSync(state.flowFilePath).toString()
      );
      assert.equal(uninstalledFlow.filter(n => n.type === 'tab').length, 1);
      assert.equal(
        uninstalledFlow
          .filter(n => n.type === 'tab')
          .filter(n => n.label === 'c+ 2JCIE-BU').length,
        0
      );
      assert.equal(
        uninstalledFlow.filter(n => n.z === '').length,
        1, // was 2 prior to uninstallation
        'global scope nodes used by the uninstalled flow should be stripped as well.'
      );
    });
  });

  describe('#enableDisableFlow', () => {
    it('should enable a flow', async () => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow-disabled.json`;

      const enabled = await lwm2mdm.enableDisableFlow(true, 'c+ 2JCIE-BU');
      assert.isTrue(enabled);
      const enabledFlow = JSON.parse(
        fs.readFileSync(state.flowFilePath).toString()
      );
      assert.equal(
        enabledFlow.filter(n => n.type === 'tab' && !n.disabled).length,
        1
      );
      assert.equal(
        enabledFlow
          .filter(n => n.type === 'tab')
          .filter(n => n.label === 'c+ 2JCIE-BU')
          .filter(n => n.disabled).length,
        0
      );
    });
    it('should disable a flow', async () => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow-disabled.json`;

      const disabled = await lwm2mdm.enableDisableFlow(false, '*');
      assert.isTrue(disabled);
      const disabledFlow = JSON.parse(
        fs.readFileSync(state.flowFilePath).toString()
      );
      assert.equal(
        disabledFlow.filter(n => n.type === 'tab' && n.disabled).length,
        1
      );
      assert.equal(
        disabledFlow
          .filter(n => n.type === 'tab')
          .filter(n => n.label === 'c+ 2JCIE-BU')
          .filter(n => !n.disabled).length,
        0
      );
    });
  });
});
