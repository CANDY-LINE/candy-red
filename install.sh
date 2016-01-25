#!/usr/bin/env bash

SERVICE_NAME="candy-red"

function setup {
  assert_root
  if [ "${CP_DESTS}" != "" ]; then
    rm -f "${CP_DESTS}"
    touch "${CP_DESTS}"
  fi
}

function cpf {
  cp -f $1 $2
  if [ "$?" == "0" ] && [ -f "${CP_DESTS}" ]; then
    if [ -f "$2" ]; then
      echo "$2" >> "${CP_DESTS}"
    else
      case "$2" in
        */)
        DEST="$2"
        ;;
        *)
        DEST="$2/"
        ;;
      esac
      echo "${DEST}$(basename $1)" >> "${CP_DESTS}"
    fi
  fi
}

function assert_root {
  if [[ $EUID -ne 0 ]]; then
     echo "This script must be run as root" 
     exit 1
  fi
}

function test_system_service_arg {
  if [ "$1" == "" ]; then
    _try_systemd
    _try_sysvinit
  else
    SYSTEM_SERVICE_TYPE="$1"
  fi

  if [ "${SYSTEM_SERVICE_TYPE}" == "" ]; then
    logger -s "Please provide the type of working system service. Either systemd or sysvinit is available"
    exit 1
  fi
  
  _test_system_service_type
}

function _try_systemd {
  if [ "${SYSTEM_SERVICE_TYPE}" != "" ]; then
    return
  fi
  RET=`which systemctl`
  if [ "$?" != 0 ]; then
    return
  fi
  SYSTEM_SERVICE_TYPE="systemd"
}

function _try_sysvinit {
  if [ "${SYSTEM_SERVICE_TYPE}" != "" ]; then
    return
  fi
  RET=`which init`
  if [ "$?" != 0 ]; then
    return
  fi
  SYSTEM_SERVICE_TYPE="sysvinit"
}

function _test_system_service_type {
  case "${SYSTEM_SERVICE_TYPE}" in
    systemd)
      ;;
    sysvinit)
      ;;
    *)
    logger -s "${SYSTEM_SERVICE_TYPE} is unsupported. Either systemd or sysvinit is available"
    exit 1
  esac
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
    logger -s "install.sh is placed on a wrong place. Make sure 'npm install' is successful."
    exit 2
  fi
}

function resolve_version {
  # https://gist.github.com/DarrenN/8c6a5b969481725a4413
  PACKAGE_VERSION=$(cat ${ROOT}/package.json \
    | grep version \
    | head -1 \
    | awk -F: '{ print $2 }' \
    | sed 's/[",]//g' \
    | tr -d '[[:space:]]')
}

function npm_install {
  RET=`npm ls | grep candy-red`
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
}

function system_service_install {
  SERVICES="${ROOT}/services"
  START_SH="${SERVICES}/start_${SYSTEM_SERVICE_TYPE}.sh"

  rm -f ${SERVICES}/start_*
  cpf ${SERVICES}/_start.sh ${START_SH}
  sed -i -e "s/%SERVICE_NAME%/${SERVICE_NAME//\//\\/}/g" ${START_SH}
  sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${START_SH}

  cp -f ${SERVICES}/base_environment.txt ${SERVICES}/environment
  sed -i -e "s/%HCIDEVICE%/${HCIDEVICE//\//\\/}/g" ${SERVICES}/environment
  sed -i -e "s/%NODE_OPTS%/${NODE_OPTS//\//\\/}/g" ${SERVICES}/environment
  
  _install_${SYSTEM_SERVICE_TYPE}
}

function _install_systemd {
  LOCAL_SYSTEMD="${SERVICES}/systemd"
  LIB_SYSTEMD="$(dirname $(dirname $(which systemctl)))"
  if [ "${LIB_SYSTEMD}" == "/" ]; then
    LIB_SYSTEMD=""
  fi
  LIB_SYSTEMD="${LIB_SYSTEMD}/lib/systemd"

  cpf ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service.txt ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service
  sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service
  sed -i -e "s/%VERSION%/${VERSION//\//\\/}/g" ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service

  cpf ${SERVICES}/environment ${LOCAL_SYSTEMD}/environment

  set -e
  cpf ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service "${LIB_SYSTEMD}/system/"
  systemctl enable ${SERVICE_NAME}
  systemctl start ${SERVICE_NAME}
  logger -s "${SERVICE_NAME} service has been installed."
}

function _install_sysvinit {
  LOCAL_SYSVINIT="${SERVICES}/sysvinit"
  INIT=/etc/init.d/${SERVICE_NAME}

  cpf ${LOCAL_SYSVINIT}/${SERVICE_NAME}.sh ${INIT}
  sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${INIT}
  sed -i -e "s/%VERSION%/${VERSION//\//\\/}/g" ${INIT}

  cpf ${LOCAL_SYSVINIT}/_wrapper.sh ${LOCAL_SYSVINIT}/wrapper.sh
  sed -i -e "s/%SERVICE_HOME%/${ROOT//\//\\/}/g" ${LOCAL_SYSVINIT}/wrapper.sh

  cpf ${SERVICES}/environment /etc/default/${SERVICE_NAME}

  if which insserv >/dev/null 2>&1; then
    insserv ${SERVICE_NAME}
  else
    update-rc.d ${SERVICE_NAME} defaults > /dev/null
  fi

  logger -s "${SERVICE_NAME} service has been installed."

  if which invoke-rc.d >/dev/null 2>&1; then
    invoke-rc.d ${SERVICE_NAME} restart
  else
    ${INIT} restart
  fi
}

setup
test_system_service_arg
cd_module_root
resolve_version
npm_install
system_service_install
