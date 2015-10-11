#!/bin/sh

skip() {
  logger -s "Skipped to perform preuninstall.sh"
}

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    skip
    exit 1
  fi
fi

systemctl stop gwd
systemctl disable gwd
rm -f /lib/systemd/system/gwd.service
logger -s "gwd service has been uninstalled."
