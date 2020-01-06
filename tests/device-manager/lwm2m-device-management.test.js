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

/* global describe, beforeEach, afterEach, it */

import * as sinon from 'sinon';
import { assert } from 'chai';
import fs from 'fs';
import cproc from 'child_process';
import RED from 'node-red';
import si from 'systeminformation';
import { DeviceState } from './device-state';
import { LwM2MDeviceManagement } from './lwm2m-device-management';

let server = sinon.spy();
let settings = sinon.spy();
RED.init(server, settings);

describe('LwM2MDeviceManagement', () => {
  let sandbox;
  let lwm2mdm;
  let state;
  let restart;
  let stop;
  beforeEach(() => {
    state = new DeviceState(
      () => {},
      () => {}
    );
    lwm2mdm = new LwM2MDeviceManagement(state);
    sandbox = sinon.createSandbox();
    restart = LwM2MDeviceManagement.restart;
    stop = LwM2MDeviceManagement.stop;
    LwM2MDeviceManagement.restart = () => {
      console.log('>>>>>>>>>> FAKE REBOOT!!');
    };
    LwM2MDeviceManagement.stop = () => {
      console.log('>>>>>>>>>> FAKE STOP!!');
    };
  });
  afterEach(() => {
    delete process.env.DEVICE_MANAGEMENT_ENABLED;
    sandbox.restore();
    LwM2MDeviceManagement.restart = restart;
    LwM2MDeviceManagement.stop = stop;
  });

  describe('#init', () => {
    it('should define an event handler which does nothing when deviceState.candyBoardServiceSupported is false', done => {
      state.candyBoardServiceSupported = false;

      sandbox
        .stub(fs, 'readFile')
        .onFirstCall()
        .yields(null, '[]');
      sandbox
        .stub(fs, 'unlinkSync')
        .onFirstCall()
        .returns();

      let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.on.onFirstCall().yields({
        clientName: 'my-clientName'
      });
      lwm2mdm.init({
        deviceId: 'deviceId'
      });
      setTimeout(() => {
        try {
          assert.isFalse(
            stubEvent.emit.withArgs(
              'clientNameResolved',
              `urn:imei:861000000000000`
            ).called
          );
          assert.equal(0, Object.keys(lwm2mdm.objects).length);
          done();
        } catch (err) {
          done(err);
        }
      }, 10);
    });

    it('should define an event handler which resolve a device id when process.env.DEVICE_MANAGEMENT_ENABLED is "true"', done => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow.json`;
      process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
      process.env.DEVEL = 'true';
      let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.on.onFirstCall().yields({
        clientName: 'my-clientName'
      });

      sandbox
        .stub(si, 'system')
        .onFirstCall()
        .returns(
          Promise.resolve({
            manufacturer: 'Raspberry Pi Foundation',
            model: 'BCM2835 - Pi 3 Model B',
            version: 'a32082 - Rev. 1.2',
            serial: '0000000000000000',
            uuid: '',
            sku: '-'
          })
        );
      sandbox
        .stub(si, 'osInfo')
        .onFirstCall()
        .returns(
          Promise.resolve({
            platform: 'linux',
            distro: 'Raspbian GNU/Linux',
            release: '10',
            codename: 'buster',
            kernel: '4.19.75-v7+',
            arch: 'arm',
            hostname: 'raspberrypi',
            codepage: 'UTF-8',
            logofile: 'raspbian',
            serial: 'abcdefghijklmnopqrstuvwxyz',
            build: '',
            servicepack: ''
          })
        );

      sandbox
        .stub(fs, 'readFile')
        .onFirstCall()
        .yields(null, '[{"type":"tab","label":"CANDY LINE DM"}]')
        .onSecondCall()
        .yields('error!');
      sandbox
        .stub(fs, 'readFileSync')
        .onCall(0)
        .returns('[]')
        .onCall(1)
        .returns('[]')
        .onCall(2)
        .returns('[]');
      sandbox.stub(fs, 'readdir').yields(null, ['test.json']);

      let stubCproc = sandbox.stub(cproc);
      let stdout = sandbox.stub({
        on: () => {}
      });
      stdout.on
        .onFirstCall()
        .yields(
          '\x1B[94m{ "counter": { "rx": "0", "tx": "0" }, "datetime": "80/01/06,00:55:11", "functionality": "Full", "imei": "861000000000000", "timezone": 9.0, "model": "UC20", "revision": "UC20GQBR03A14E1G", "manufacturer": "Quectel" }\x1B[0m'
        );
      let candy = sandbox.stub({
        stdout: stdout,
        on: () => {}
      });
      stubCproc.spawn.onFirstCall().returns(candy);
      candy.on.onFirstCall().yields(0);

      lwm2mdm.init({
        deviceId: 'deviceId',
        userDir: '/opt/candy-line'
      });
      setTimeout(() => {
        try {
          assert.isTrue(candy.on.called, 'candy.on.called');
          assert.isTrue(
            stubEvent.emit.withArgs(
              'configurationDone',
              sinon.match({
                serverId: 97,
                clientName: 'urn:imei:861000000000000',
                clientPort: 57830,
                reconnectSec: 300,
                bootstrapIntervalSec: 3600,
                enableDTLS: false,
                requestBootstrap: true,
                saveProvisionedConfig: true,
                useIPv4: true,
                hideSensitiveInfo: false,
                credentialFilePath: '/opt/candy-line/lwm2m_dm_cred.json'
              })
            ).called,
            'stubEvent.emit.withArgs("configurationDone") ...'
          );
          assert.isTrue(
            Object.keys(lwm2mdm.objects).length === 0,
            'Object.keys(lwm2mdm.objects).length === 0'
          ); // as fake empty array loaded
          done();
        } catch (err) {
          done(err);
        }
      }, 100);
    });

    it('should define an event handler which resolve a device id when a modem info file exists', done => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow.json`;
      process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
      process.env.DEVEL = 'true';
      let stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      stubEvent.on.onFirstCall().yields({
        clientName: 'my-clientName'
      });

      sandbox
        .stub(fs, 'readFile')
        .onFirstCall()
        .yields(null, '[{"type":"tab","label":"CANDY LINE DM"}]')
        .onSecondCall()
        .yields(
          null,
          '{"status":"OK","result":{ "counter": { "rx": "0", "tx": "0" }, "datetime": "80/01/06,00:55:11", "functionality": "Full", "imei": "861000000000000", "timezone": 9.0, "model": "UC20", "revision": "UC20GQBR03A14E1G", "manufacturer": "Quectel" }}'
        );
      sandbox
        .stub(fs, 'readFileSync')
        .onCall(0)
        .returns('[]')
        .onCall(1)
        .returns('[]')
        .onCall(2)
        .returns('[]');
      sandbox.stub(fs, 'readdir').yields(null, ['test.json']);

      lwm2mdm
        .init({
          deviceId: 'deviceId',
          userDir: '/opt/candy-line'
        })
        .then(() => {
          setTimeout(() => {
            try {
              assert.isTrue(
                stubEvent.emit.withArgs(
                  'configurationDone',
                  sinon.match({
                    serverId: 97,
                    clientName: 'urn:imei:861000000000000',
                    clientPort: 57830,
                    reconnectSec: 300,
                    bootstrapIntervalSec: 3600,
                    enableDTLS: false,
                    requestBootstrap: true,
                    saveProvisionedConfig: true,
                    useIPv4: true,
                    hideSensitiveInfo: false,
                    credentialFilePath: '/opt/candy-line/lwm2m_dm_cred.json'
                  })
                ).called,
                'stubEvent.emit.withArgs("configurationDone") ...'
              );
              done();
            } catch (err) {
              done(err);
            }
          }, 10);
        })
        .catch(err => {
          done(err);
        });
    });
  });

  describe('#_updateMindConnectAgentConfiguration', () => {
    it('should modify the existing mindconnect configuration in the flow file', async () => {
      state.candyBoardServiceSupported = true;
      state.flowFilePath = `${__dirname}/test-flow.json`;
      process.env.DEVICE_MANAGEMENT_ENABLED = 'true';
      process.env.DEVICE_MANAGEMENT_BS_DTLS = 'PSK';

      const stubEvent = sandbox.stub(lwm2mdm.internalEventBus);
      let call = 0;
      stubEvent.once.onCall(call++).yields({}); // writeResource
      stubEvent.once.onCall(call++).yields({
        payload: [
          { uri: '/43001/0/0', value: { value: 'https://my-endpoint' } },
          { uri: '/43001/0/1', value: { value: 'my iat' } },
          { uri: '/43001/0/2', value: { value: 2 } },
          { uri: '/43001/0/3', value: { value: 'my client id' } },
          { uri: '/43001/0/4', value: { value: 'my tenant name' } },
          { uri: '/43001/0/5', value: { value: '2019-12-31T09:33:02.000Z' } },
          { uri: '/43001/0/6', value: { value: true } },
          { uri: '/43001/0/7', value: { value: true } },
          { uri: '/43001/0/8', value: { value: true } },
          { uri: '/43001/0/9', value: { value: 999 } },
          { uri: '/43001/0/10', value: { value: 'my node' } }
        ]
      }); // readResources
      stubEvent.once.onCall(call++).yields({}); // writeResource
      stubEvent.once.onCall(call++).yields({}); // writeResource

      lwm2mdm.objectFilePath = `${__dirname}/objects-for-test-flow-mindconnect.json`;
      await lwm2mdm._updateMindConnectAgentConfiguration(
        `${__dirname}/test-flow-mindconnect.json`
      );
      assert.equal(stubEvent.once.callCount, call);
    });
  });
});
