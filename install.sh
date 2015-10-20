#!/usr/bin/env bash

SERVICE_NAME="candyred"

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   exit 1
fi

edison=`uname -r | grep "\-edison+"`
if [ "$?" != 0 ]; then
  edison=`uname -r | grep "\-yocto-"`
  if [ "$?" != 0 ]; then
    logger -s "Skipped to perform install.sh"
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

cp -f ${SERVICES}/_start.sh ${SERVICES}/start.sh
sed -i -e "s/%SERVICE_NAME%/${SERVICE_NAME//\//\\/}/g" ${SERVICES}/start.sh
sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${SERVICES}/start.sh

LOCAL_SYSTEMD="${SERVICES}/systemd"
LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))/lib/systemd"

cp -f ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service.txt ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service
sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service

cp -f ${LOCAL_SYSTEMD}/base_environment.txt ${LOCAL_SYSTEMD}/environment
sed -i -e "s/%WS_URL%/${WS_URL//\//\\/}/g" ${LOCAL_SYSTEMD}/environment
sed -i -e "s/%WS_USER%/${WS_USER//\//\\/}/g" ${LOCAL_SYSTEMD}/environment
sed -i -e "s/%WS_PASSWORD%/${WS_PASSWORD//\//\\/}/g" ${LOCAL_SYSTEMD}/environment

set -e
cp -f ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service "${LIB_SYSTEMD}/system/"
systemctl enable ${SERVICE_NAME}
systemctl start ${SERVICE_NAME}
logger -s "${SERVICE_NAME} service has been installed."

if [ -z "${WS_URL}" ]; then
  logger -s "[WARNING] Please manually modify [${LOCAL_SYSTEMD}/environment] in order to populate valid WebSocket server address."
  logger -s "[WARNING] Then run 'systemctl start ${SERVICE_NAME}' again."
  systemctl stop ${SERVICE_NAME}
fi
