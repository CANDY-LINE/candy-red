Candy-RED
===

[![master Build Status](https://travis-ci.org/dbaba/candy-red.svg?branch=master)](https://travis-ci.org/dbaba/candy-red/)

Candy-RED is a gateway service working between local area wiress network devices and internet servers.

In this version, Candy-RED acts like a transceiver, which receives BLE advertisement packets and transmits them over WebSocket session.

You can add an advertisement packet parser for your own BLE module by editing `src/peripherals.js`. Note that `Local Name` AD Data Type is required in order for peripheral.js to identify a type of BLE data.

## Install on Intel Edison

```
$ npm install -g dbaba/candy-red
$ WS_URL=ws://your-websocket-address/and/path $(npm root -g)/candy-red/install.sh
```

This will take a couple of minutes.

You can ignore `npm WARN`s, `gyp WARN`s, `gyp ERR!`s and `node-pre-gyp ERR!`s unless the installation terminates normally. You can check if the installation is successful by `systemctl status candy-red` command.

## Stop/Start/Status Service

The service name is `candy-red`.

```
$ systemctl stop candy-red
$ systemctl start candy-red
$ systemctl status candy-red
```

## Uninstall from Intel Edison

Run `uninstall.sh` for the same reason described above.

```
$ $(npm root -g)/candy-red/uninstall.sh
```

If you run `npm uninstall candy-red -g` prior to run the `uninstall.sh`, please run the following commands in order to reset systemd configurations.

```
$ systemctl stop candy-red
$ systemctl disable candy-red
$ rm -f "$(dirname $(dirname $(which systemctl)))/lib/systemd/system/candy-red.service"
```

## Setup for Building

In order to install dependencies for development use.

```
$ npm run setup
```

## Build

```
$ npm run build
```

Please remember to insert `run` between `npm` and `build`.

## Run on localhost for development use

Try the following commands after `npm run build`:
### without auth
```
$ WS_DEBUG=true WS_URL=ws://your-ws-host ./dist/index.js
```

e.g. `WS_DEBUG=true WS_URL=ws://echo.websocket.org ./dist/index.js`

And you'll see the sensor info like this:
```
connecting to ws://echo.websocket.org
ready
WebSocket opened.
Starting Scanning...
Data:{"data":{"type":"lx","unit":"lx","val":11},"tstamp":1444892603243,"rssi":-34,"id":"20:73:7a:10:ad:bd"}
```

### with basic auth
```
$ WS_DEBUG=true WS_URL=ws://your-ws-host WS_USER=foo WS_PASSWORD=bar ./dist/index.js
```

## Test

```
$ npm test
```
or
```
$ npm run test
```

## Package

```
$ npm pack
```

## Revison History

* 1.0.0
  - Initial Release
* 1.1.0
  - Modifies the installation process, running `npm install` then `install.sh`
