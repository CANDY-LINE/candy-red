'use strict';
/*
 * BLECAST_BL (BLE with Illuminance Sensor) node
 * BLECAST_TM (BLE with Temeprature Sensor) node
 */

import * as blecastBl from './lib/blecast_bl';
import * as blecastTm from './lib/blecast_tm';
import * as ble from './lib/ble';
import Promise from 'es6-promises';

export default function(RED) {
  let p = new Promise((resolve, reject) => {
    ble.start(RED).then(() => {
      class BlecastBlNode {
        constructor(n) {
          RED.nodes.createNode(this, n);
          this.address = n.address;
          this.uuid = n.uuid;
        }
      }
      RED.nodes.registerType('BLECAST_BL', BlecastBlNode);

      class BlecastBlInNode {
        constructor(n) {
          RED.nodes.createNode(this, n);
          this.useString = n.useString;
          this.blecastBlNodeId = n.blecastBl;
          this.blecastBlNode = RED.nodes.getNode(this.blecastBlNodeId);
          ble.registerIn(this, 'BLECAST_BL', this.blecastBlNode.address, this.blecastBlNode.uuid,
            blecastBl.parse, this.useString, RED);
          this.name = n.name;
        }
      }
      RED.nodes.registerType('BLECAST_BL in', BlecastBlInNode);

      class BlecastTmNode {
        constructor(n) {
          RED.nodes.createNode(this, n);
          this.address = n.address;
          this.uuid = n.uuid;
        }
      }
      RED.nodes.registerType('BLECAST_TM', BlecastTmNode);

      class BlecastTmInNode {
        constructor(n) {
          RED.nodes.createNode(this, n);
          this.useString = n.useString;
          this.blecastTmNodeId = n.blecastTm;
          this.blecastTmNode = RED.nodes.getNode(this.blecastTmNodeId);
          ble.registerIn(this, 'BLECAST_TM', this.blecastTmNode.address, this.blecastTmNode.uuid,
            blecastTm.parse, this.useString, RED);
          this.name = n.name;
        }
      }
      RED.nodes.registerType('BLECAST_TM in', BlecastTmInNode);
      resolve();

    }).catch(e => {
      RED.log.error(RED._('blecast_bl.errors.unknown', { error: e }));
      reject(e);
    });
  });

  if (RED.debug) {
    // Should not return anything except for test
    // since Node-RED tries to manipulate the return value unless it's null/undefined
    // and TypeError will be raised in the end.
    return p;
  }
}
