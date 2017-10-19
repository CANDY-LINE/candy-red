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

# Disable i18n resources other than en-US for now (will be enabled in the future release)
for l in `find -f %SERVICE_HOME%/node_modules/node-red | grep locales/ | grep -v en-US | grep -v json`; do
  rm -fr ${l}
done

logger -s "Starting %SERVICE_NAME%..."
HOME=/opt/candy-red /usr/bin/env node ${NODE_OPTS} %SERVICE_HOME%/dist/index.js
