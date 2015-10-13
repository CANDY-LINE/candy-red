#!/bin/sh

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform preuninstall.sh"
    exit 1
  fi
fi

systemctl stop candyred
systemctl disable candyred
rm -f /lib/systemd/system/candyred.service

RET=`GWD_INSTALLER=running npm uninstall -g candyred`
if [ "${RET}" != 0 ]; then
  logger -s "npm uninstall failed"
  exit ${RET}
fi

logger -s "candyred service has been uninstalled."
