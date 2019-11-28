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

if [[ ${NODE_OPTS} != *--max-old-space-size=* ]]; then
  if [ -n "`which free`" ]; then
    MEM=`free -m | grep "Mem:" | awk '{print $2}'`
    MAX_OLD_SPACE_SIZE=${MAX_OLD_SPACE_SIZE:-`expr ${MEM} / 3`}
  fi
  MAX_OLD_SPACE_SIZE=${MAX_OLD_SPACE_SIZE:-256}
  NODE_OPTS="${NODE_OPTS} --max-old-space-size=${MAX_OLD_SPACE_SIZE}"
fi
logger -s "node options => ${NODE_OPTS}"

mkdir -p /opt/candy-red

logger -s "Starting %SERVICE_NAME%..."
HOME=/opt/candy-red /usr/bin/env node ${NODE_OPTS} %SERVICE_HOME%/dist/index.js
