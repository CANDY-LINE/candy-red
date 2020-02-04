#!/usr/bin/env bash

SERVICE_NAME="candy-red"
# 1 for disabling service installation & uninstallation, 0 for enabling them (default)
DISABLE_SERVICE_INSTALL=${DISABLE_SERVICE_INSTALL:-0}
NODE_PALETTE_ENABLED=${NODE_PALETTE_ENABLED:-true}
NODE_RED_PROJECTS_ENABLED=${NODE_RED_PROJECTS_ENABLED:-false}
CANDY_RED_HOME=${CANDY_RED_HOME:-/opt/${SERVICE_NAME}}
CANDY_RED_MODULE_ROOT="${CANDY_RED_HOME}/.node-red"
CANDY_RED_ADMIN_USER_ID=${CANDY_RED_ADMIN_USER_ID:-""}
CANDY_RED_ADMIN_PASSWORD_ENC=""
CANDY_RED_LOG_LEVEL="info"
CANDY_RED_SESSION_TIMEOUT=${CANDY_RED_SESSION_TIMEOUT:-86400}
CANDY_RED_APT_GET_UPDATED=${CANDY_RED_APT_GET_UPDATED:-0}
CANDY_RED_BIND_IPV4_ADDR=${CANDY_RED_BIND_IPV4_ADDR:-false}
DEVICE_MANAGEMENT_ENABLED=${DEVICE_MANAGEMENT_ENABLED:-false}
DEVICE_MANAGEMENT_BS_HOST=${DEVICE_MANAGEMENT_BS_HOST:-"localhost"}
DEVICE_MANAGEMENT_BS_HOST_IPV6=${DEVICE_MANAGEMENT_BS_HOST_IPV6:-"false"}
DEVICE_MANAGEMENT_BS_PORT=${DEVICE_MANAGEMENT_BS_PORT:-"5784"}
DEVICE_MANAGEMENT_BS_DTLS=${DEVICE_MANAGEMENT_BS_DTLS:-"PSK"}
DEVICE_MANAGEMENT_BS_DTLS_PSK_ID=${DEVICE_MANAGEMENT_BS_DTLS_PSK_ID:-""}
DEVICE_MANAGEMENT_BS_DTLS_PSK=${DEVICE_MANAGEMENT_BS_DTLS_PSK:-""}
DEVICE_MANAGEMENT_MANUFACTURER=${DEVICE_MANAGEMENT_MANUFACTURER:-""}
DEVICE_MANAGEMENT_MODEL=${DEVICE_MANAGEMENT_MODEL:-""}
DEVICE_MANAGEMENT_CL_PORT=${DEVICE_MANAGEMENT_CL_PORT:-"57830"}
DEVICE_MANAGEMENT_RECONNECT_SEC=${DEVICE_MANAGEMENT_RECONNECT_SEC:="300"}
DEVICE_MANAGEMENT_BOOTSTRAP_INTERVAL_SEC=${DEVICE_MANAGEMENT_BOOTSTRAP_INTERVAL_SEC:="28800"}
DEVICE_MANAGEMENT_EXCLUSIVE_TO_MOBILE_NETWORK=${DEVICE_MANAGEMENT_EXCLUSIVE_TO_MOBILE_NETWORK:-"true"}

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

function apt_get_update {
  if [ "${CANDY_RED_APT_GET_UPDATED}" == "1" ]; then
    return
  fi
  CANDY_RED_APT_GET_UPDATED=1
  apt-get update -y
}

function setup {
  if [ "${DEVEL}" == "true" ]; then
    info "Skip to perform install.sh!"
    exit 0
  elif [ "${DEVEL}" == "dep" ]; then
    if [ ! -d "${CANDY_RED_HOME}" ]; then
      CANDY_RED_HOME=${PROJECT_ROOT}
      CANDY_RED_MODULE_ROOT="${PROJECT_ROOT}/.node-red"
    fi
    info "Installing dependencies..."
    install_preinstalled_nodes
    exit 0
  fi
  assert_root
  assert_node_npm
  if [ "${CP_DESTS}" != "" ]; then
    rm -f "${CP_DESTS}"
    touch "${CP_DESTS}"
  fi
  if [ ${LOCAL_INSTALL} != "0" ] && [ -d "${PROJECT_ROOT}/src" ]; then
    LOCAL_INSTALL="1"
  fi
  if [ "$1" == "pre" ]; then
    RET=`which apt-get`
    if [ "$?" == "0" ]; then
      info "Ready for installation!"
      install_libpam
      install_pyserial
      if [ -f "/proc/board_info" ]; then
        DT_MODEL=`cat /proc/board_info 2>&1`
        case ${DT_MODEL} in
          "Tinker Board" | "Tinker Board S")
            BOARD="ATB"
            ;;
          *)
            BOARD=""
            ;;
        esac
      else
        python -c "import RPi.GPIO" > /dev/null 2>&1
        if [ "$?" == "0" ]; then
          BOARD="RPi"
          install_sensehat
        fi
      fi
      exit 0
    else
      err "Cannot install on this platform"
      exit 1
    fi
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
  if [ ${LOCAL_INSTALL} = "0" ]; then
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
  if [ ${LOCAL_INSTALL} = "0" ]; then
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
  REALPATH=${REALPATH:-$(pwd)/dummy}
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
    info "Installing local nodes ..."
    cp -r ${PROJECT_ROOT}/dist/nodes/local-node-* ${PROJECT_ROOT}/node_modules/
  fi
}

function install_libpam {
  if ! dpkg -l libpam0g-dev 2>&1 | grep "libpam0g-dev" | grep "^i.*"; then
    apt_get_update
    apt-get install -y libpam0g-dev
  fi
}

function install_sensehat {
  if [ "${BOARD}" != "RPi" ]; then
    return
  fi
  if ! dpkg -l sense-hat 2>&1 | grep "sense-hat" | grep "^i.*"; then
    info "Installing Sense HAT ..."
    apt_get_update
    apt-get install -y sense-hat libjpeg8-dev
  fi
  if ! python -c "import PIL" > /dev/null 2>&1; then
    info "Installing Sense HAT node dependencies..."
    pip install pillow
  fi
}

function install_pyserial {
  if ! python -c "import serial" > /dev/null 2>&1; then
    info "Installing SmartMesh node dependencies..."
    pip install pyserial
  fi
}

function install_preinstalled_nodes {
  NODES_CSV_PATH="${NODES_CSV_PATH:-${PROJECT_ROOT}/default-nodes.csv}"
  if [ -n "${NODES_CSV}" ]; then
    NODES=`echo ${NODES_CSV} | tr ' ' '\n'`
  elif [ -f "${NODES_CSV_PATH}" ]; then
    NODES=`cat ${NODES_CSV_PATH} | tr -d '\r'`
  else
    err "The path [${NODES_CSV_PATH}] is missing."
    exit 1
  fi
  if [ ! -d "${CANDY_RED_MODULE_ROOT}" ]; then
    mkdir -p "${CANDY_RED_MODULE_ROOT}"
    info "The path [${CANDY_RED_MODULE_ROOT}] has been created."
  fi
  if [ -n "${NODES}" ]; then
    if [ "${DEVEL}" == "dep" ]; then
      cd ${CANDY_RED_MODULE_ROOT}
    else
      NPM_OPTS="--unsafe-perm --prefix ${CANDY_RED_MODULE_ROOT}"
      mkdir -p ${CANDY_RED_MODULE_ROOT}
      if [ -d "${CANDY_RED_MODULE_ROOT}/node_modules" ]; then
        mkdir -p ${CANDY_RED_MODULE_ROOT}/lib
        rm -fr ${CANDY_RED_MODULE_ROOT}/lib/node_modules
        mv ${CANDY_RED_MODULE_ROOT}/node_modules/ ${CANDY_RED_MODULE_ROOT}/lib
      elif [ -e "${CANDY_RED_MODULE_ROOT}/node_modules" ]; then
        rm -f ${CANDY_RED_MODULE_ROOT}/node_modules
      fi
    fi
    info "Installing default nodes to ${CANDY_RED_MODULE_ROOT}..."
    rm -f "${PROJECT_ROOT}/deps.txt"
    echo "${NODES}" | \
      while IFS=',' read p v; do
        p=`echo -e ${p} | tr -d ' '`
        v=`echo -e ${v} | tr -d ' '`
        if [ -z "${p}" ] || [[ ${p} == "#"* ]]; then
          continue
        fi
        npm install --production ${NPM_OPTS} ${p}@${v}
        echo "\"${p}\":\"${v}\",${DEPS}" >> "${PROJECT_ROOT}/deps.txt"
      done
    DEPS=`cat "${PROJECT_ROOT}/deps.txt"`
    rm -f "${PROJECT_ROOT}/deps.txt"
    DEPS=${DEPS:0:`echo ${DEPS} | wc -c`-2}
    # nodes are installed to {prefix}/lib directory
    # because -g flag is implicitly inherited on performing the above npm
    if [ -d "${CANDY_RED_MODULE_ROOT}/lib/node_modules" ]; then
      mv ${CANDY_RED_MODULE_ROOT}/lib/node_modules/ ${CANDY_RED_MODULE_ROOT}
    fi
    rm -fr ${CANDY_RED_MODULE_ROOT}/etc
    # Reset cached meta info
    rm -f ${CANDY_RED_MODULE_ROOT}/.config.json
    rm -f ${CANDY_RED_MODULE_ROOT}/.config.json.backup
    cd ${CANDY_RED_MODULE_ROOT}
    echo "{\"name\":\"node-red-project\",\"version\":\"0.0.1\",\"description\":\"A Node-RED Project\",\"dependencies\":{${DEPS}}}" > package.json
    cd ${PROJECT_ROOT}
  else
    info "Skip to install nodes!!"
  fi
}

function setup_credentials {
  if [ -n "${CANDY_RED_ADMIN_PASSWORD}" ]; then
    CANDY_RED_ADMIN_PASSWORD_ENC=`node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 8));" ${CANDY_RED_ADMIN_PASSWORD}`
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
  for e in HCIDEVICE \
      NODE_OPTS \
      WELCOME_FLOW_URL \
      PPPD_DEBUG \
      NODE_PALETTE_ENABLED \
      NODE_RED_PROJECTS_ENABLED \
      CANDY_RED_SESSION_TIMEOUT \
      CANDY_RED_BIND_IPV4_ADDR \
      CANDY_RED_ADMIN_USER_ID \
      CANDY_RED_ADMIN_PASSWORD_ENC \
      DEVICE_MANAGEMENT_ENABLED \
      DEVICE_MANAGEMENT_BS_HOST \
      DEVICE_MANAGEMENT_BS_HOST_IPV6 \
      DEVICE_MANAGEMENT_BS_PORT \
      DEVICE_MANAGEMENT_BS_DTLS \
      DEVICE_MANAGEMENT_BS_DTLS_PSK_ID \
      DEVICE_MANAGEMENT_BS_DTLS_PSK \
      DEVICE_MANAGEMENT_MANUFACTURER \
      DEVICE_MANAGEMENT_MODEL \
      DEVICE_MANAGEMENT_CL_PORT \
      DEVICE_MANAGEMENT_RECONNECT_SEC \
      DEVICE_MANAGEMENT_BOOTSTRAP_INTERVAL_SEC \
      DEVICE_MANAGEMENT_EXCLUSIVE_TO_MOBILE_NETWORK \
      CANDY_RED_LOG_LEVEL; do
    sed -i -e "s/%${e}%/${!e//\//\\/}/g" ${SERVICES}/environment
  done
  chmod 0600 ${SERVICES}/environment
  rm -f ${SERVICES}/environment-e
  _install_${SYSTEM_SERVICE_TYPE}
  rm -f ${SERVICES}/environment
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
setup $1
resolve_version
test_system_service
setup_credentials
install_preinstalled_nodes
if [ -n "${SYSTEM_SERVICE_TYPE}" ]; then
  DISABLE_SERVICE_INSTALL=${DISABLE_SERVICE_INSTALL} ${PROJECT_ROOT}/uninstall.sh
  npm_local_install
  system_service_install
elif [ ${LOCAL_INSTALL} != "0" ]; then
  info "Skip to setup a SystemD service"
else
  info "Won't install a SystemD service as it isn't supported on the system"
  npm_local_install
  info "Run 'npm run start' to start CANDY RED!"
fi
