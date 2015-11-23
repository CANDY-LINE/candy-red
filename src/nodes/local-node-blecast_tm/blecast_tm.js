'use strict';
/*
 * BLECAST_TM (BLE with Temeprature Sensor) node
 */

import noble from 'noble';
import Promise from 'es6-promises';
import * as blecastTm from './lib/blecast_tm';

const CATEGORY = 'BLECAST_TM';

export default function(RED) {
  let ble = RED.settings.ble;
  ble.start(RED).then(enabled => {
    function BlecastTmNode(n) {
      RED.nodes.createNode(this, n);
      this.address = n.address;
      this.uuid = n.uuid;
    }
    RED.nodes.registerType(CATEGORY, BlecastTmNode);

    function BlecastTmInNode(n) {
      RED.nodes.createNode(this, n);
      this.blecastTmNodeId = n.blecastTm;
      this.blecastTmNode = RED.nodes.getNode(this.blecastTmNodeId);
      ble.registerIn(this, CATEGORY, this.blecastTmNode.address, this.blecastTmNode.uuid, blecastTm.parse, RED);
      this.name = n.name;
    }
    RED.nodes.registerType(`${CATEGORY} in`, BlecastTmInNode);

  }).catch(e => {
    RED.log.error(RED._('blecast_tm.errors.unknown', { error: e }));
  });
}
