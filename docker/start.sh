#!/usr/bin/env bash
# Start script for Docker

if [ ! -d ${USER_DIR} ]; then
  mkdir -p ${USER_DIR}
fi

cd ${CR_DIST}
if [ ! -L "node_modules" ]; then
  ln -s ${CR_HOME}/node_modules node_modules
fi

echo "$(date) : Starting CANDY RED... (@$(pwd))"
/usr/bin/env node ${NODE_OPTS} index.js ${CR_HOME}/package.json
echo "$(date) : CANDY RED exited. Code:${$?}"
