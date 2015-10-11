#!/bin/sh

logger -s "Unblocking Bluetooth..."
/usr/sbin/rfkill unblock bluetooth

logger -s "Starting edison-gw..."
/usr/bin/node /usr/lib/node_modules/edison-gw/dist/index.js
