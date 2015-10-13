#!/bin/sh

logger -s "Unblocking Bluetooth..."
/usr/sbin/rfkill unblock bluetooth

logger -s "Starting candyred..."
/usr/bin/node /usr/lib/node_modules/candyred/dist/index.js
