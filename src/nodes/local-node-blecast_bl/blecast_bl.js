'use strict';
/*
 * BLECAST_BL (BLE with Illuminance Sensor) node
 */

import noble from 'noble';
import Promise from 'es6-promises';
import * as blecastBl from './lib/blecast_bl';

const CATEGORY = 'BLECAST_BL';

export default function(RED) {
  let ble = RED.settings.ble;
  ble.start(RED).then(enabled => {
    function BlecastBlNode(n) {
      RED.nodes.createNode(this, n);
      this.address = n.address;
      this.uuid = n.uuid;
    }
    RED.nodes.registerType(CATEGORY, BlecastBlNode);

    function BlecastBlInNode(n) {
      RED.nodes.createNode(this, n);
      this.useString = n.useString;
      this.blecastBlNodeId = n.blecastBl;
      this.blecastBlNode = RED.nodes.getNode(this.blecastBlNodeId);
      ble.registerIn(this, CATEGORY, this.blecastBlNode.address, this.blecastBlNode.uuid,
        blecastBl.parse, this.useString, RED);
      this.name = n.name;
    }
    RED.nodes.registerType(`${CATEGORY} in`, BlecastBlInNode);

  }).catch(e => {
    RED.log.error(RED._('blecast_bl.errors.unknown', { error: e }));
  });
}
