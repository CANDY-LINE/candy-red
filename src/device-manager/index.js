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

import 'source-map-support/register';

let DeviceState;
let LwM2MDeviceManagement;
try {
  const candyRedLwm2m = require('candy-red-lwm2m');
  DeviceState = candyRedLwm2m.DeviceState;
  LwM2MDeviceManagement = candyRedLwm2m.LwM2MDeviceManagement;
} catch (_) {
  DeviceState = require('./default-device-state').DeviceState;
}

export default class DeviceManager {
  constructor() {
    this.store = {};
    this.deviceState = new DeviceState(
      this._onFlowFileChangedFunc(),
      this._onFlowFileRemovedFunc()
    );
    if (LwM2MDeviceManagement) {
      this.lwm2m = new LwM2MDeviceManagement(this.deviceState);
    }
  }

  initSettings(settins) {
    if (this.lwm2m) {
      settins.lwm2m = this.lwm2m;
    }
  }

  async initWithFlowFilePath(filePath) {
    await this.deviceState.initWithFlowFilePath(filePath);
  }

  async initDeviceManagement(settings) {
    let headlessEnabled = false;
    if (this.lwm2m) {
      await this.lwm2m.init(settings);
      headlessEnabled = this.lwm2m.peekLocalValue(42805, 0, 1);
    }
    return headlessEnabled;
  }

  async testIfCANDYBoardServiceInstalled() {
    return await this.deviceState.testIfCANDYBoardServiceInstalled(
      'candy-pi-lite'
    );
  }

  _onFlowFileChangedFunc() {
    return (() => {
      return () => {
        return new Promise(resolve => {
          // TODO
          return resolve();
        });
      };
    })();
  }

  _onFlowFileRemovedFunc() {
    return (() => {
      return () => {
        return new Promise(resolve => {
          // TODO
          return resolve();
        });
      };
    })();
  }
}
