#!/usr/bin/env bash

SERVICE_NAME="candyred"

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform preuninstall.sh"
    exit 1
  fi
fi

systemctl stop ${SERVICE_NAME}
systemctl disable ${SERVICE_NAME}
rm -f /lib/systemd/system/${SERVICE_NAME}.service

uninstall=`GWD_INSTALLER=running npm uninstall -g ${SERVICE_NAME}`
RET=$?
if [ "${RET}" != 0 ]; then
  logger -s "npm uninstall failed: code [${RET}]"
  exit ${RET}
fi

logger -s "${SERVICE_NAME} service has been uninstalled."
