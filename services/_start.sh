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
  hciconfig ${HCIDEVICE} up
fi

logger -s "Starting %SERVICE_NAME%..."
/usr/bin/env node %SERVICE_HOME%/dist/index.js
