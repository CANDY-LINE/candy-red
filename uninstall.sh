#!/usr/bin/env bash

SERVICE_NAME="candy-red"

function err {
  echo -e "\033[91m[ERROR] $1\033[0m"
}

function info {
  echo -e "\033[92m[INFO] $1\033[0m"
}

function assert_root {
  if [[ $EUID -ne 0 ]]; then
     err "This script must be run as root"
     exit 1
  fi
}

function cd_module_root {
  RET=`which realpath`
  RET=$?
  if [ "${RET}" == "0" ]; then
    REALPATH=`realpath "$0"`
  else
    REALPATH=`readlink -f -- "$0"`
  fi
  ROOT=`dirname ${REALPATH}`
  cd ${ROOT}

  if [ ! -f "./package.json" ]; then
    err "uninstall.sh is placed on a wrong place. Make sure 'npm install' is successful."
    exit 2
  fi
}

function system_service_uninstall {
  _lookup_system_service_type
  if [ -n "${SYSTEM_SERVICE_TYPE}" ]; then
    _uninstall_${SYSTEM_SERVICE_TYPE}
    info "${SERVICE_NAME} service has been uninstalled."
  fi
}

function _lookup_system_service_type {
  SERVICES="${ROOT}/services"
  START_SH="${SERVICES}/start_${SYSTEM_SERVICE_TYPE}.sh"

  START_SH=`ls ${SERVICES}/start_*`
  RET=$?
  if [ "${RET}" != "0" ]; then
    err "The service ${SERVICE_NAME} isn't installed yet."
  else
    START_SH=$(basename ${START_SH})
    SYSTEM_SERVICE_TYPE=${START_SH:6:`expr length ${START_SH}`-9}
  fi
}

function _uninstall_systemd {
  LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))/lib/systemd"

  set -e
  systemctl stop ${SERVICE_NAME}
  systemctl disable ${SERVICE_NAME}
  set +e
  rm -f "${LIB_SYSTEMD}/system/${SERVICE_NAME}.service"
}

assert_root
cd_module_root
system_service_uninstall
