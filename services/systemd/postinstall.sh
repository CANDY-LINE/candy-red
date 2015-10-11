#!/bin/sh

skip() {
  logger -s "Skipped to perform postinstall.sh"
}

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    skip
    exit 1
  fi
fi

cp -f /usr/lib/node_modules/edison-gw/services/systemd/gwd.service /lib/systemd/system/
systemctl enable gwd
systemctl start gwd
logger -s "gwd service has been installed."
