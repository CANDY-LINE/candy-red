CANDY-Red
===

[![master Build Status](https://travis-ci.org/dbaba/candy-red.svg?branch=master)](https://travis-ci.org/dbaba/candy-red/)

CANDY-Red is a gateway service working between local area wiress network devices and internet servers.

In this version, CANDY-Red acts like a transceiver, which receives BLE advertisement packets and transmits them over WebSocket session.

# Intel Edison + Yocto

## Prerequisites

### Tested Node.js versions

* v0.10.38 (preinstalled)

## Install

```
$ npm install -g --production dbaba/candy-red
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

## Uninstall

```
$ $(npm root -g)/candy-red/uninstall.sh
```

If you run `npm uninstall -g candy-red` prior to run the `uninstall.sh`, please run the following commands in order to reset systemd configurations.

```
$ systemctl stop candy-red
$ systemctl disable candy-red
$ rm -f "$(dirname $(dirname $(which systemctl)))/lib/systemd/system/candy-red.service"
```

# Raspberry Pi + Raspbian

## Prerequisites

### Tested Node.js versions

* v0.12.6
* v4.1.2
* v4.2.1

### Node.js
Install Node.js on your Raspbian prior to install the package.

The brief instruction for installing Node.js v4.0.0+ is as follows.
(See the [Node-RED page](http://nodered.org/docs/hardware/raspberrypi.html) for installing Node.js v0.12.6)

```
$ VERSION=v4.2.1
$ ARCH=armv6l
$ wget https://nodejs.org/dist/${VERSION}/node-${VERSION}-linux-${ARCH}.tar.gz
$ tar -xvf node-${VERSION}-linux-${ARCH}.tar.gz
$ rm -f node-${VERSION}-linux-${ARCH}/*
$ cd node-${VERSION}-linux-${ARCH}/
$ sudo cp -R * /usr/local/
```

Set `ARCH=armv7l` for Raspberry Pi 2 users.

See [elinux.org instruction](http://elinux.org/Node.js_on_RPi) for detail.

### GCC 4.7+ (for Node.js v4.0.0+)

GCC 4.7+ is used for building some native libraries with Node.js v4.0.0+.

```
$ sudo apt-get update && sudo apt-get install -y g++-4.8
```

### BlueZ

BlueZ is required for managing BLE devices.

You can find the installation instruction in the [article](http://www.elinux.org/RPi_Bluetooth_LE).

Here is a brief instruction. (Check the latest version of Bluez at www.bluez.org)
```
$ BLUEZ_VER=5.35
$ sudo apt-get install libdbus-1-dev \
    libdbus-glib-1-dev libglib2.0-dev libical-dev \
    libreadline-dev libudev-dev libusb-dev make
$ wget https://www.kernel.org/pub/linux/bluetooth/bluez-${BLUEZ_VER}.tar.xz
$ tar xvf bluez-${BLUEZ_VER}.tar.xz
$ cd bluez-${BLUEZ_VER}
$ ./configure --disable-systemd
$ make
$ sudo make install
```

## Install

The module installation will take a couple of minutes.

You can ignore `npm WARN`s, `gyp WARN`s, `gyp ERR!`s and `node-pre-gyp ERR!`s unless the installation terminates normally. You can check if the installation is successful by `sudo service candy-red status` command.

Please refer to the following commands to isntall.

### With BLE only
```
$ sudo CC=/usr/bin/gcc-4.8 CXX=/usr/bin/g++-4.8 npm install -g --production dbaba/candy-red
$ sudo WS_URL=ws://your-websocket-address/and/path $(npm root -g)/candy-red/install.sh
```

### With BLE and EnOcean
```
$ sudo CC=/usr/bin/gcc-4.8 CXX=/usr/bin/g++-4.8 npm install -g --production dbaba/candy-red
$ sudo WS_URL=ws://your-websocket-address/and/path \
    ENOCEAN_PORT=/dev/your/enocean/port $(npm root -g)/candy-red/install.sh
```

### With BLE and EnOcean and Serial port
```
$ sudo CC=/usr/bin/gcc-4.8 CXX=/usr/bin/g++-4.8 npm install -g --production dbaba/candy-red
$ sudo WS_URL=ws://your-websocket-address/and/path \
    ENOCEAN_PORT=/dev/your/enocean/port \
    SERIAL_PORT=/dev/your/serial/port $(npm root -g)/candy-red/install.sh
```

## Stop/Start/Status Service

The service name is `candy-red`.

```
$ sudo service candy-red stop
$ sudo service candy-red start
$ sudo service candy-red status
```

## Uninstall

```
$ sudo $(npm root -g)/candy-red/uninstall.sh
```

If you run `sudo npm uninstall -g candy-red` prior to run the `uninstall.sh`, please run the following commands in order to reset systemd configurations.

```
$ sudo service candy-red stop
$ sudo rm -f "/etc/default/candy-red"
$ sudo rm -f "/etc/init.d/candy-red"
```

# Wireless Protocol Support

## BLE

You can add an advertisement packet parser for your own BLE module by editing `src/peripherals.js`. Note that `Local Name` AD Data Type is required in order for peripheral.js to identify a type of BLE data.

[`noble`](https://www.npmjs.com/package/noble) is used for BLE support.

## EnOcean

In order to activate EnOcean support, set an environment variable `ENOCEAN_PORT` which points to a serial port for EnOcean communication, e.g. `ENOCEAN_PORT=/dev/tty.usbserial-ABCDE`.

EnOcean support is inactivated unless ENOCEAN_PORT is set.

[`node-enocean`](https://www.npmjs.com/package/node-enocean) and [esp3_erp2_parser.js](./src/esp3_erp2_parser.js) are used for EnOcean support.

## Serial/UART

In order to activate Serial port support, set an environment variable `SERIAL_PORT` which points to a serial port for serial communication, e.g. `SERIAL_PORT=/dev/tty.usbserial-ABCDE`.

Serial port support is inactivated unless SERIAL_PORT is set.

[`serialport`](https://www.npmjs.com/package/serialport) is used for Serial port support.

# Development

## Setup for Building

In order to install dependencies for development use.

Install the global dependencies at first (`sudo` is required for Raspbian).

```
$ npm install -g babel mocha jshint
```

Then install the local dependencies.

```
$ git clone https://github.com/dbaba/candy-red.git
$ cd candy-red
$ npm install
```

## Build

```
$ npm run build
```

The processed files are placed under `dist` diretory.

Please remember to insert `run` between `npm` and `build`.

## Run on localhost for development use

Try the following commands after `npm run build`:
### without auth
(Prepends `sudo` for Raspbian)

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
Serial port is inactivated...
EnOcean is inactivated...
Data:{"data":{"type":"lx","unit":"lx","val":11},"tstamp":1444892603243,"rssi":-34,"id":"20:73:7a:10:ad:bd"}
```

### with basic auth
(Prepends `sudo` for Raspbian)

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

* 1.2.0
  - EnOcean Protocol and Profile support (ESP3 with ERP2 and EEP2.6)

* 1.1.0
  - Modifies the installation process, running `npm install` then `install.sh`
  - Renames the module name
  - Raspberry Pi (Raspbian) Support

* 1.0.0
  - Initial Release
