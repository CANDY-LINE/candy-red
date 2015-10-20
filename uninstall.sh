#!/usr/bin/env bash

SERVICE_NAME="candy-red"

function assert_root {
  if [[ $EUID -ne 0 ]]; then
     echo "This script must be run as root" 
     exit 1
  fi
}

function assert_edison_yocto {
  edison=`uname -r | grep "\-edison+"`
  if [ "$?" != 0 ]; then
    edison=`uname -r | grep "\-yocto-"`
    if [ "$?" != 0 ]; then
      logger -s "Skipped to perform install.sh"
      exit 1
    fi
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
  pushd ${ROOT}

  if [ ! -f "./package.json" ]; then
    logger -s "uninstall.sh is placed on a wrong place. Make sure 'npm install' is successful."
    exit 2
  fi
}

function system_service_uninstall {
  _lookup_system_service_type
  _uninstall_${SYSTEM_SERVICE_TYPE}
}

function _lookup_system_service_type {
  SERVICES="${ROOT}/services"
  START_SH="${SERVICES}/start_${SYSTEM_SERVICE_TYPE}.sh"
  
  START_SH=`ls ${SERVICES}/start_*`
  RET=$?
  if [ "${RET}" != "0" ]; then
    logger -s "The service ${SERVICE_NAME} isn't installed yet."
    exit 3
  fi
  START_SH=$(basename ${START_SH})
  SYSTEM_SERVICE_TYPE=${START_SH:6:`expr length ${START_SH}`-9}
  
  case "${SYSTEM_SERVICE_TYPE}" in
    systemd)
      ;;
    sysvinit)
      ;;
    *)
    logger -s "${SYSTEM_SERVICE_TYPE} is unsupported. Either systemd or sysvinit is available"
    exit 3
  esac
}

# function _uninstall_sysvinit {
# }

function _uninstall_systemd {
  LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))/lib/systemd"

  set -e
  systemctl stop ${SERVICE_NAME}
  systemctl disable ${SERVICE_NAME}
  rm -f "${LIB_SYSTEMD}/system/${SERVICE_NAME}.service"

  npm uninstall .

  logger -s "${SERVICE_NAME} service has been uninstalled."
}

assert_root
assert_edison_yocto
cd_module_root
system_service_uninstall
