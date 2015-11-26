'use strict';
/*
 * BLECAST_BL (BLE with Illuminance Sensor) node
 * BLECAST_TM (BLE with Temeprature Sensor) node
 */

import * as blecastBl from './lib/blecast_bl';
import * as blecastTm from './lib/blecast_tm';
import * as ble from './lib/ble';

export default function(RED) {
  ble.start(RED).then(() => {
    function BlecastBlNode(n) {
      RED.nodes.createNode(this, n);
      this.address = n.address;
      this.uuid = n.uuid;
    }
    RED.nodes.registerType('BLECAST_BL', BlecastBlNode);

    function BlecastBlInNode(n) {
      RED.nodes.createNode(this, n);
      this.useString = n.useString;
      this.blecastBlNodeId = n.blecastBl;
      this.blecastBlNode = RED.nodes.getNode(this.blecastBlNodeId);
      ble.registerIn(this, CATEGORY, this.blecastBlNode.address, this.blecastBlNode.uuid,
        blecastBl.parse, this.useString, RED);
      this.name = n.name;
    }
    RED.nodes.registerType('BLECAST_BL in', BlecastBlInNode);

    function BlecastTmNode(n) {
      RED.nodes.createNode(this, n);
      this.address = n.address;
      this.uuid = n.uuid;
    }
    RED.nodes.registerType('BLECAST_TM', BlecastTmNode);

    function BlecastTmInNode(n) {
      RED.nodes.createNode(this, n);
      this.useString = n.useString;
      this.blecastTmNodeId = n.blecastTm;
      this.blecastTmNode = RED.nodes.getNode(this.blecastTmNodeId);
      ble.registerIn(this, CATEGORY, this.blecastTmNode.address, this.blecastTmNode.uuid,
        blecastTm.parse, this.useString, RED);
      this.name = n.name;
    }
    RED.nodes.registerType('BLECAST_TM in', BlecastTmInNode);

  }).catch(e => {
    RED.log.error(RED._('blecast_bl.errors.unknown', { error: e }));
  });
}
