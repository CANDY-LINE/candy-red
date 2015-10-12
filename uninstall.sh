#!/bin/sh

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform preuninstall.sh"
    exit 1
  fi
fi

systemctl stop gwd
systemctl disable gwd
rm -f /lib/systemd/system/gwd.service

RET=`GWD_INSTALLER=running npm uinstall -g edison-gw`
if [ ${RET} != 0 ]; then
  logger -s "npm uninstall failed"
  exit ${RET}
fi

logger -s "gwd service has been uninstalled."
