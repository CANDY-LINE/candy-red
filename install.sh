#!/usr/bin/env bash

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform postinstall.sh"
    exit 1
  fi
fi

if [ ! -f "./package.json" ]; then
  logger -s "Please run this script on the package root directory where package.json exists."
  exit 2
fi

install=`GWD_INSTALLER=running npm install -g . --production`
RET=$?
if [ ${RET} != 0 ]; then
  logger -s "npm uninstall failed: code [${RET}]"
  exit ${RET}
fi

SERVICES="/usr/lib/node_modules/candyred/services"
SYSTEMD="${SERVICES}/systemd"

cp -f ${SERVICES}/base_environment.txt ${SERVICES}/environment
sed -i -e "s/%WS_URL%/${WS_URL//\//\\/}/g" ${SERVICES}/environment
sed -i -e "s/%WS_USER%/${WS_USER//\//\\/}/g" ${SERVICES}/environment
sed -i -e "s/%WS_PASSWORD%/${WS_PASSWORD//\//\\/}/g" ${SERVICES}/environment

cp -f ${SYSTEMD}/candyred.service /lib/systemd/system/
systemctl enable candyred
systemctl start candyred
logger -s "candyred service has been installed."

if [ -z "${WS_URL}" ]; then
  logger -s "[WARNING] Please manually modify [${SERVICES}/environment] in order to populate valid WebSocket server address."
  logger -s "[WARNING] Then run 'systemctl start candyred' again."
  systemctl stop candyred
fi
