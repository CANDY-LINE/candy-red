#!/usr/bin/env bash

logger -s "Activating Bluetooth..."
RET=`which rfkill`
RET=$?
if [ "${RET}" == "0" ]; then
  rfkill unblock bluetooth
fi

HCIDEVICE="${HCIDEVICE:-hci0}"
RET=`which hciconfig`
RET=$?
if [ "${RET}" == "0" ]; then
  hciconfig ${HCIDEVICE} reset
fi

mkdir -p /opt/candy-red

rm -fr %SERVICE_HOME%/node_modules/node-red/red/api/locales/ja && \
rm -fr %SERVICE_HOME%/node_modules/node-red/red/runtime/locales/ja && \
rm -fr %SERVICE_HOME%/node_modules/node-red/nodes/core/locales/ja && \

logger -s "Starting %SERVICE_NAME%..."
HOME=/opt/candy-red /usr/bin/env node ${NODE_OPTS} %SERVICE_HOME%/dist/index.js
