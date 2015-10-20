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

RET=`which realpath`
RET=$?
if [ "${RET}" == "0" ]; then
  REALPATH=`realpath "$0"`
else
  REALPATH=`readlink -f -- "$0"`
fi
ROOT=`dirname ${REALPATH}`
pushd ${ROOT}

if [ ! -f "./package.json" ]; then
  logger -s "uninstall.sh is placed on a wrong place. Make sure 'npm install' is successful."
  exit 2
fi

LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))/lib/systemd"

set -e
systemctl stop ${SERVICE_NAME}
systemctl disable ${SERVICE_NAME}
rm -f "${LIB_SYSTEMD}/system/${SERVICE_NAME}.service"

npm uninstall .

logger -s "${SERVICE_NAME} service has been uninstalled."
