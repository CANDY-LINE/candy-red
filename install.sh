#!/usr/bin/env bash

SERVICE_NAME="candyred"

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform postinstall.sh"
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
  logger -s "install.sh is placed on a wrong place. Make sure 'npm install' is successful."
  exit 2
fi

RET=`npm ls`
RET=$?
if [ "${RET}" != "0" ]; then
  logger -s "Installing ${SERVICE_NAME}..."
  install=`npm install .`
  RET=$?
  if [ ${RET} != 0 ]; then
    logger -s "npm install failed: code [${RET}]"
    exit ${RET}
  fi
fi

SERVICES="${ROOT}/services"
LOCAL_SYSTEMD="${SERVICES}/systemd"
LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))/lib/systemd"

cp -f ${SERVICES}/base_environment.txt ${SERVICES}/environment
sed -i -e "s/%WS_URL%/${WS_URL//\//\\/}/g" ${SERVICES}/environment
sed -i -e "s/%WS_USER%/${WS_USER//\//\\/}/g" ${SERVICES}/environment
sed -i -e "s/%WS_PASSWORD%/${WS_PASSWORD//\//\\/}/g" ${SERVICES}/environment

set -e
cp -f ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service "${LIB_SYSTEMD}/system/"
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}
logger -s "${SERVICE_NAME} service has been installed."

if [ -z "${WS_URL}" ]; then
  logger -s "[WARNING] Please manually modify [${SERVICES}/environment] in order to populate valid WebSocket server address."
  logger -s "[WARNING] Then run 'systemctl start ${SERVICE_NAME}' again."
  systemctl stop ${SERVICE_NAME}
fi
