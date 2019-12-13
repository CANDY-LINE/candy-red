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

export default Object.freeze({
  REBOOT_DELAY_MS: 1000,
  MAX_MOBILE_NETWORK_CONN_RETRY: 2147483647,
  PROC_CPUINFO_PATH: '/proc/cpuinfo',
  PROC_DT_MODEL_PATH: '/proc/device-tree/model',
  MODEM_INFO_FILE_PATH: '/opt/candy-line/candy-pi-lite/__modem_info',
  DM_FLOW: `${__dirname}/device-management-flow.json`,
  EXCLUDED_URI_LIST: [
    '/3/0/2',
    '/3/0/3',
    '/3/0/6',
    '/3/0/9',
    '/3/0/10',
    '/3/0/13',
    '/3/0/14',
    '/3/0/15',
    '/3/0/18',
    '/3/0/20',
    '/3/0/21'
  ],
  MODULE_MODEL_MAPPINGS: {
    EC21: 'CANDY Pi Lite LTE',
    UC20: 'CANDY Pi Lite 3G',
    EC25: 'CANDY Pi Lite+',
    BG96: 'CANDY Pi Lite LTE-M'
  },
  CLIENT_CREDENTIAL_PROFILE: {
    '1': 'RSA_3072',
    '2': 'SHARED_SECRET'
  },
  UPDATE_INTERVAL_MS: process.env.UPDATE_INTERVAL_MS || 60 * 1000
});
