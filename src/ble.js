'use strict';

import noble from 'noble';
import Promise from 'es6-promises';

let peripheralsIn = {};
let isScanning = false;
let isMonitoring = false;

/**
 * Associate the given in-Node object with the BLE module.
 * @param n the in-Node object to be registered as a BLE node
 * @param categoryName the category name
 * @param address the ble address delimited by '-'
 * @param uuid the ble identifier (optional)
 * @param parse the parse function
 * @param useString whether or not to use String type rather than JSON object as the payload format
 * @param RED the initialized RED object
 * @return void (sync)
 */
export function registerIn(n, categoryName, address, uuid, parse, useString, RED) {
  if (!n || !categoryName || !address || !parse) {
    throw new Error('Invalid node!');
  }
  if (!RED) {
    throw new Error('RED is required!!');
  }
  let category = peripheralsIn[categoryName];
  if (!category) {
    category = {};
    peripheralsIn[categoryName] = category;
  }
  category[address] = {
    node: n,
    parse: parse,
    useString: useString
  };
  if (uuid) {
    category[uuid] = category[address];
    RED.log.info(`[BLE] category=[${categoryName}], address=[${address}, uuid=[${uuid}]] has been registered.`);
  } else {
    RED.log.info(`[BLE] category=[${categoryName}], address=[${address}] has been registered.`);
  }
}

/**
 * Start the BLE module.
 * @param RED the initialized RED object
 * @return Promise
 */
export function start(RED) {
  if (!RED) {
    throw new Error('RED is required!');
  }
  return new Promise((resolve, reject) => {
    if (isScanning) {
      resolve();
      return;
    }
    noble.on('stateChange', state => {
      if (state === 'poweredOn') {
        RED.log.info('[BLE] Start Scanning...');
        noble.startScanning([], true);
        isScanning = true;
        resolve();
      } else {
        noble.stopScanning();
        isScanning = false;
        reject();
      }
    });
    if (noble.state === 'poweredOn') {
      RED.log.info('[BLE] Start Scanning...');
      noble.startScanning([], true);
      isScanning = true;
      resolve();
    }
  }).then(() => {
    return new Promise((resolve, reject) => {
      if (isMonitoring) {
        resolve();
        return;
      }
      isMonitoring = true;
      noble.on('discover', peripheral => {
        let adv = peripheral.advertisement;
        // Remove a NULL terminator
        let categoryName = adv.localName.replace(new RegExp('\0', 'g'), '');
        // look up a category by the category name
        let category = peripheralsIn[categoryName];
        if (!category) {
          RED.log.warn(`[BLE] Unknown peripheral: category=[${categoryName}], peripheral.address=[${peripheral.address}], peripheral.uuid=[${peripheral.uuid}]`);
          return;
        }
        // check if the peripheral.address matches
        let address = peripheral.address;
        let uuid = null;
        let bleNode = null;
        if (address === 'unknown') {
          uuid = peripheral.uuid;
          bleNode = category[uuid];
          if (!bleNode) {
            RED.log.warn(`[BLE] Unknown node: category=[${categoryName}], uuid=[${uuid}]`);
            return;
          }
        }
        if (!uuid) {
          bleNode = category[address];
          if (!bleNode) {
            RED.log.warn(`[BLE] Unknown node: category=[${categoryName}], address=[${address}]`);
            return;
          }
        }
        // send the ble node a payload if the address exists
        let node = bleNode.node;
        let data = bleNode.parse(adv.manufacturerData);
        let payload = {
          data: data,
          tstamp: Date.now(),
          rssi: peripheral.rssi,
          address: address
        };
        if (uuid) {
          payload.uuid = uuid;
        }
        if (bleNode.useString) {
          payload = JSON.stringify(payload);
        }
        node.send({'payload': payload});
      });
      resolve();
      RED.log.info('[BLE] Set up done.');
    });
  });
}

/**
 * Stop the BLE module immediately.
 * @param RED the initialized RED object
 * @return void (sync)
 */
export function stop(RED) {
  noble.stopScanning();
  isScanning = false;
  RED.log.info('[BLE] Stop scanning.');
}
