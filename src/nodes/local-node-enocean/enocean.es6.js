'use strict';
/*
 * EnOcean Serial Node for Packet Type 10: RADIO_ERP2
 * Supported Protocols (Partially):
 * - EnOcean Serial Protocol 3 (ESP3) V1.27 / July 30, 2014
 * - EnOcean Radio Protocol 2 SPECIFICATION V1.0 September 26, 2013
 *
 * This node expects 'node-red-node-serialport' to be available
 * on the editor in order to use its `/serialports` endpoint.
 */

import { SerialPool } from './lib/enocean';
import { ERP2_HANDLERS } from './lib/eep_handlers';

export default function(RED) {
  class EnOceanPortNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      try {
        this.serialPort = n.serialPort;
        EnOceanPortNode.pool.add(this);
      } catch (e) {
        RED.log.warn(RED._('enocean.errors.serialPortError', { error: e }));
      }
    }
  }
  EnOceanPortNode.pool = new SerialPool(RED);
  RED.nodes.registerType('EnOcean Port', EnOceanPortNode);

  class EnOceanInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.originatorId = n.originatorId;
      this.originatorIdInt = parseInt(this.originatorId, 16);
      this.eepType = n.eepType;
      this.addEepType = n.addEepType;
      this.useString = n.useString;
      this.enoceanPortNodeId = n.enoceanPort;
      this.enoceanPortNode = RED.nodes.getNode(this.enoceanPortNodeId);
      this.status({});
      this.on('close', done => {
        if (this.enoceanPortNode) {
          EnOceanPortNode.pool.close(this.enoceanPortNode.serialPort).then(() => {
            done();
          });
        } else {
          done();
        }
      });
      try {
        let enocean = EnOceanPortNode.pool.get(this.enoceanPortNode.serialPort);
        enocean.port.on(`ctx-${this.originatorIdInt}`, ctx => {
          let handleIt = ERP2_HANDLERS[this.eepType];
          if (!handleIt) {
            RED.log.warn(RED._('enocean.warn.noHandler', { eepType: this.eepType }));
            return;
          }
          let payload = handleIt(ctx);
          payload.tstamp = Date.now();
          payload.rssi = ctx.container.dBm;
          payload.id = ctx.originatorId; // hex string
          if (this.addEepType) {
            payload.eep = this.eepType;
          }
          if (this.useString) {
            payload = JSON.stringify(payload);
          }
          this.send({ payload: payload });
        });
        enocean.port.on('ready', () => {
          this.status({ fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
        });
        enocean.port.on('closed', () => {
          this.status({ fill: 'red', shape: 'ring', text: 'node-red:common.status.not-connected'});
        });
      } catch (e) {
        RED.log.warn(RED._('enocean.errors.serialPortError', { error: e }));
      }
    }
  }
  RED.nodes.registerType('EnOcean in', EnOceanInNode);

  RED.httpAdmin.get('/eeps', RED.auth.needsPermission('eep.read'), function(req,res) {
    res.json(Object.keys(ERP2_HANDLERS));
  });
}
