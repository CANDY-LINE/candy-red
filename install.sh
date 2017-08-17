#!/usr/bin/env bash

SERVICE_NAME="candy-red"
# 1 for disabling service installation & uninstallation, 0 for enabling them (default)
DISABLE_SERVICE_INSTALL=${DISABLE_SERVICE_INSTALL:-0}
NODE_PALETTE_ENABLED=${NODE_PALETTE_ENABLED:-true}
CANDY_RED_MODULE_ROOT="/opt/${SERVICE_NAME}/.node-red"

function err {
  echo -e "\033[91m[ERROR] $1\033[0m"
}

function info {
  echo -e "\033[92m[INFO] $1\033[0m"
}

function download_and_npm_install {
  if [ -z "${TARBALL}" ]; then
    info "Performing npm install ${SERVICE_NAME}..."
    npm install -g --unsafe-perm ${SERVICE_NAME}
  else
    info "Performing npm install ${TARBALL}..."
    npm install -g --unsafe-perm ${TARBALL}
  fi
}

function setup {
  if [ "${DEVEL}" == "true" ]; then
    info "Skip to perform install.sh!"
    exit 0
  fi
  assert_root
  assert_node_npm
  if [ "${CP_DESTS}" != "" ]; then
    rm -f "${CP_DESTS}"
    touch "${CP_DESTS}"
  fi
  if [ "$1" == "test" ]; then
    info "Ready for installation!"
    exit 0
  fi
  rm -fr ${PROJECT_ROOT}/node_modules/node-red/red/api/locales/ja
  rm -fr ${PROJECT_ROOT}/node_modules/node-red/red/runtime/locales/ja
  rm -fr ${PROJECT_ROOT}/node_modules/node-red/nodes/core/locales/ja
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
  if [ ! -d "${PROJECT_ROOT}/src" ]; then
    if [[ $EUID -ne 0 ]]; then
       err "This script must be run as root"
       exit 1
    fi
  fi
}

function assert_node_npm {
  if [ `which node>/dev/null && which npm>/dev/null;echo $?` != "0" ]; then
     err "Please install Node.js and npm"
     exit 1
  fi
}

function test_system_service {
  if [ ! -d "${PROJECT_ROOT}/src" ]; then
    _try_systemd
  fi
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

function cd_module_root {
  RET=`which realpath`
  RET=$?
  if [ "${RET}" == "0" ]; then
    REALPATH=`realpath "$0"`
  else
    REALPATH=`readlink -f -- "$0"`
  fi
  REALPATH=${REALPATH:-$(pwd)}
  PROJECT_ROOT=`dirname ${REALPATH}`
  cd ${PROJECT_ROOT}
}

function resolve_version {
  if [ "$1" == "update" ]; then
    unset VERSON
  elif [ -f "${PROJECT_ROOT}/package.json" ]; then
    VERSION=$(node -e "console.log(require('${PROJECT_ROOT}/package.json').version)")
  fi
  if [ -z "${VERSION}" ]; then
    VERSION="master"
    download_and_npm_install
    exit $?
  fi
}

function npm_local_install {
  if [ -d "${PROJECT_ROOT}/dist" ]; then
    cp -r ${PROJECT_ROOT}/dist/nodes/local-node-* node_modules/
  fi
}

function install_preinstalled_nodes {
  NODES_CSV_PATH="${NODES_CSV_PATH:-${PROJECT_ROOT}/default-nodes.csv}"
  if [ -f "${NODES_CSV_PATH}" ]; then
    mkdir -p ${CANDY_RED_MODULE_ROOT}
    info "Installing default nodes to ${CANDY_RED_MODULE_ROOT}..."
    cat ${NODES_CSV_PATH} | tr -d '\r' | \
      while IFS=',' read p v; do
        p=`echo -e ${p} | tr -d ' '`
        v=`echo -e ${v} | tr -d ' '`
        npm install --unsafe-perm --prefix ${CANDY_RED_MODULE_ROOT} ${p}@${v}
      done
    # nodes are installed to {prefix}/lib directory
    # because -g flag is implicitly inherited on performing the above npm
    rm -fr ${CANDY_RED_MODULE_ROOT}/node_modules
    mv ${CANDY_RED_MODULE_ROOT}/lib/node_modules/ ${CANDY_RED_MODULE_ROOT}
    rm -fr ${CANDY_RED_MODULE_ROOT}/etc
  else
    info "Skip to install nodes!!"
  fi
}

function system_service_install {
  if [ "${DISABLE_SERVICE_INSTALL}" == "1" ]; then
    info "Skip to setup a SystemD service (DISABLE_SERVICE_INSTALL is 1)"
    return
  fi

  SERVICES="${PROJECT_ROOT}/services"
  START_SH="${SERVICES}/start_${SYSTEM_SERVICE_TYPE}.sh"

  rm -f ${SERVICES}/start_*
  cpf ${SERVICES}/_start.sh ${START_SH}
  sed -i -e "s/%SERVICE_NAME%/${SERVICE_NAME//\//\\/}/g" ${START_SH}
  sed -i -e "s/%SERVICE_HOME%/${PROJECT_ROOT//\//\\/}/g" ${START_SH}

  cp -f ${SERVICES}/base_environment.txt ${SERVICES}/environment
  sed -i -e "s/%HCIDEVICE%/${HCIDEVICE//\//\\/}/g" ${SERVICES}/environment
  sed -i -e "s/%NODE_OPTS%/${NODE_OPTS//\//\\/}/g" ${SERVICES}/environment
  sed -i -e "s/%WELCOME_FLOW_URL%/${WELCOME_FLOW_URL//\//\\/}/g" ${SERVICES}/environment
  sed -i -e "s/%NODE_PALETTE_ENABLED%/${NODE_PALETTE_ENABLED//\//\\/}/g" ${SERVICES}/environment

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
  sed -i -e "s/%SERVICE_HOME%/${PROJECT_ROOT//\//\\/}/g" ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service
  sed -i -e "s/%VERSION%/${VERSION//\//\\/}/g" ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service

  cpf ${SERVICES}/environment ${LOCAL_SYSTEMD}/environment

  set -e
  cpf ${LOCAL_SYSTEMD}/${SERVICE_NAME}.service "${LIB_SYSTEMD}/system/"
  systemctl enable ${SERVICE_NAME}
  systemctl start ${SERVICE_NAME}
  info "${SERVICE_NAME} service has been installed."
}

cd_module_root
install_preinstalled_nodes
setup $1
resolve_version
test_system_service
if [ -n "${SYSTEM_SERVICE_TYPE}" ]; then
  DISABLE_SERVICE_INSTALL=${DISABLE_SERVICE_INSTALL} ${PROJECT_ROOT}/uninstall.sh
  npm_local_install
  system_service_install
elif [ -d "${PROJECT_ROOT}/src" ]; then
  info "Skip to setup a SystemD service"
else
  info "Won't install a SystemD service as it isn't supported on the system"
  npm_local_install
  info "Run 'npm run start' to start CANDY RED!"
fi
