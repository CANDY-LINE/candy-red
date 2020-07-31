CANDY RED
===

[![GitHub release](https://img.shields.io/github/release/CANDY-LINE/candy-red.svg)](https://github.com/CANDY-LINE/candy-red/releases/latest)
[![master Build Status](https://travis-ci.org/CANDY-LINE/candy-red.svg?branch=master)](https://travis-ci.org/CANDY-LINE/candy-red/)

CANDY RED is IoT gateway software designed for [CANDY Pi Lite board](https://translate.google.com/translate?hl=en&sl=ja&u=https://www.candy-line.io/%25E8%25A3%25BD%25E5%2593%2581%25E4%25B8%2580%25E8%25A6%25A7/candy-pi-lite/&prev=search) with [Raspberry Pi](https://www.raspberrypi.org) and [ASUS Tinker Board](https://www.asus.com/Single-Board-Computer/Tinker-Board/) powered by [Node-RED](https://nodered.org).

## Features

* Include Node-RED flow editor/flow execution runtime
* PAM Authentication is enabled by default
* Running as a systemd service
* Dashboard UI is installed by default
* More builtin nodes
    * [OMA LwM2M client nodes](https://www.npmjs.com/package/node-red-contrib-lwm2m)
    * [Analog Devices SmartMesh IP™ nodes](https://www.npmjs.com/package/node-red-contrib-smartmesh)
    * [EnOcean nodes (ESP3 over ERP2)](src/nodes/local-node-enocean)
    * [GATT BLE nodes](https://www.npmjs.com/package/node-red-contrib-generic-ble)
    * [Serialport node](https://www.npmjs.com/package/node-red-node-serialport)
    * [Device Statistics node](https://www.npmjs.com/package/node-red-contrib-device-stats)
    * [CANDY Pi Lite/CANDY Pi Lite+ 3G/4G LTE board nodes](src/nodes/local-node-candy-pi-lite)
    * [CANDY EGG cloud service nodes](src/nodes/local-node-candy-egg) \*

_\* [CANDY EGG cloud service](https://www.candy-line.io/%E8%A3%BD%E5%93%81%E4%B8%80%E8%A6%A7/candy-red-egg/) account is required_

## OS and Hardwares

* [Raspberry Pi + Raspbian](#raspberry-pi--raspbian)
* ASUS Tinker Board + Tinker OS (Debian) v2.0.5+
* [OSX/Debian/Ubuntu/Raspbian for Development](#development)

# Screenshots
## CANDY RED flow editor page on browser

This is the default screen theme.

![CANDY RED Screenshot](https://raw.githubusercontent.com/CANDY-LINE/candy-red/master/images/screenshot-candy-red.png "CANDY RED Screenshot")

# Raspberry Pi + Raspbian

## Prerequisites

### Raspbian version

 * 2020-02-13-raspbian-buster

### Tested Node.js versions

* v10 (Active LTS)
* v12 (Active LTS)

### Supported npm version

* v6.x+

## Install/Version-up

The module installation will take around 30 minutes on RPi1. On RPi2+, the installation time will be shorter.

Please consider to change your hostname as [described below](#change-hostname) prior to installing CANDY RED.

`--unsafe-perm` flag is required for installing this project module since npm performs privileged actions during the installation. This is discussed in the [issue](https://github.com/voodootikigod/node-serialport/issues/535).

You can ignore `npm WARN`s, `gyp WARN`s, `gyp ERR!`s and `node-pre-gyp ERR!`s unless the installation terminates normally. You can check if the installation is successful by `sudo service candy-red status` command after running `install.sh` script as well as `npm install`.

** Please export your flow data prior to performing version-up **

Please refer to the following commands to install.

```
$ sudo npm install -g --unsafe-perm --production candy-red
```

You can access `http://<hostname.local or ip address>:8100` with your browser on the same LAN where `<hostname.local or ip address>` is a host name with `.local` suffix or IP address.

## Authentication

PAM authentication is enabled by default for both Linux (Raspbian/Debian/Ubuntu) and macOS. So you need to login with your OS account such as `pi` user. You can add custom user ID/password as well by providing the following environmental variables on installation.

When providing the credentials, PAM authentication is disabled.

```
$ sudo \
    CANDY_RED_ADMIN_USER_ID=... \
    CANDY_RED_ADMIN_PASSWORD=... \
    npm install -g --unsafe-perm --production candy-red
```

The password is encrypted while the installation process.

Note that PAM authentication feature (not custom credentials authentication) is disabled unless `NODE_ENV` is `production`.

## Stop/Start/Status Service (Raspbian)

The service name is `candy-red`. As of Jessie, systemd comes as a default system manager.

```
$ sudo systemctl stop candy-red
$ sudo systemctl start candy-red
$ sudo systemctl status candy-red
$ sudo journalctl -f -u candy-red -o cat
```

## Uninstall

```
$ sudo npm uninstall -g --unsafe-perm candy-red
```

If you run `sudo npm uninstall -g candy-red` (without `--unsafe-perm`) and see `[ERROR] This script must be run as root` message, please run the following commands in order to reset systemd configurations.

```
$ sudo systemctl stop candy-red
$ sudo systemctl disable candy-red
$ sudo rm -f "$(dirname $(dirname $(which systemctl)))/lib/systemd/system/candy-red.service"
```

## RPi Tips

### Change Hostname

Since RPi hostname is `raspberrypi` by default, you will get confused when you have 2 or more devices and they're online.

You can change the host name by either `sudo raspi-config`.

### BLE USB adaptor/dongle

CANDY RED service tries to activate the `hci0` device if it exists on boot so that you can use BLE devices on the flow editor. This is performed silently at background and you usually don't have to care of it.

However, you need to tell the system to restart the CANDY RED service by performing `sudo systemctl restart candy-red` when you insert the dongle after boot. Or BLE is not available.

### Node-RED home

The Node-RED home path, where flow files are placed, is found at `$(npm root -g)/candy-red/.node-red/`.
Alternately, you can provide the arbitrary path with `CANDY_RED_HOME` environment variable defined in `$(npm root -g)/candy-red/.node-red/environment` file.

### BlueZ source code build

The latest Raspbian offers you to install BlueZ with `apt-get` command as described above.
However, you can still use the latest version of BlueZ if you want.

You can find the installation instruction in the [article](http://www.elinux.org/RPi_Bluetooth_LE). The compilation takes around 40 minutes (RPi B+).

Here is a brief instruction. (Check the latest version of BlueZ at www.bluez.org)
```
$ BLUEZ_VER=5.52
$ sudo apt-get install -y build-essential libdbus-1-dev \
    libdbus-glib-1-dev libglib2.0-dev libical-dev \
    libreadline-dev libudev-dev libusb-dev make
$ wget https://www.kernel.org/pub/linux/bluetooth/bluez-${BLUEZ_VER}.tar.xz
$ tar xvf bluez-${BLUEZ_VER}.tar.xz
$ cd bluez-${BLUEZ_VER}
$ ./configure
$ make
$ sudo make install
```

# Configuration

## Initial Welcome Flow

Welcome flow is a sample flow for helping users to understand the flow editor, which is created by CANDY RED when user's flow is missing.

`WELCOME_FLOW_URL` environmental variable allows users to specify the initial welcome flow file in URL form. You can set it on installation by, for example, `WELCOME_FLOW_URL=http://... npm install -g ....`.

By default, [`welcome-flow.json`](src/welcome-flow.json) is used as the initial flow.

Note that the downloaded flow file will be discarded if it is not a valid JSON data.

## Preinstalled nodes

```
$ sudo NODES_CSV="node-ed-contib-cache,>=1.0.4 node-ed-contib-geneic-ble,>=2.0.4 node-ed-contib-smartmesh,>=1.0.0" npm install -g --unsafe-perm --production candy-red
```
Either a single space` ` or `\n` can be a delimiter of `NODE_CSV` value.

# Development

## Prerequisites

### Supported Node.js versions

* v10 (Active LTS)
* v12 (Active LTS)

## Setup for Building

Install the local dependencies.

```
$ git clone https://github.com/CANDY-LINE/candy-red.git
$ cd candy-red
$ DEVEL=true npm install
# Run one of the following command to install default nodes
$ make #=> default nodes are installed into ~/.node-red/node_modules
$ make CANDY_RED_HOME=$(pwd)/tmp #=> default nodes are installed into $(pwd)/tmp/.node-red/node_modules
```

## Build

```
$ npm run build
```

The processed files are placed under `dist` directory.

## Version up

Just pull the update on the `candy-red` directory and perform `npm install`.

```
$ cd candy-red
$ git pull
$ npm install --production
```

## Run on localhost for development use

Try the following commands after `npm run build`:
(Prepends `sudo` for Raspbian)

```
$ npm run start
```

With a remote welcome flow file:

```
$ WELCOME_FLOW_URL=https://git.io/vKx5r npm run start
```

And you'll see the sensor info like this:

    [INFO] Default welcome flow has been created
    29 Jul 21:52:35 - [info] [CANDY RED] flowFileSignature: 6cbf44cb244f38acf29d2ef061aabc4ac70e991a
    29 Jul 21:52:35 - [info] [CANDY RED] Deploying Flow Editor UI...


    Welcome to Node-RED
    ===================

    29 Jul 21:52:35 - [info] Node-RED version: v0.14.6 [candy-red v2.6.3]
    29 Jul 21:52:35 - [info] Node.js  version: v4.4.7
    29 Jul 21:52:35 - [info] Darwin 15.6.0 x64 LE
    29 Jul 21:52:35 - [info] Loading palette nodes
    29 Jul 21:52:36 - [info] UI started at /api/ui
    29 Jul 21:52:36 - [warn] ------------------------------------------------------
    29 Jul 21:52:36 - [warn] [rpi-gpio] Info : Ignoring Raspberry Pi specific node
    29 Jul 21:52:36 - [warn] ------------------------------------------------------
    29 Jul 21:52:36 - [info] User directory : /Users/guest/.node-red
    29 Jul 21:52:36 - [info] Flows file     : /Users/guest/.node-red/flows_candy-red.json
    29 Jul 21:52:36 - [info] [BLE] Set up done
    29 Jul 21:52:36 - [info] Listen port=8100
    29 Jul 21:52:36 - [info] Starting flows
    29 Jul 21:52:36 - [info] [inject:89c364b0.763c98] repeat = 1000
    29 Jul 21:52:36 - [info] Started flows

With password authentication:

```
$ CANDY_RED_ADMIN_USER_ID=admin \
  CANDY_RED_ADMIN_PASSWORD_ENC=`node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 8));" password` \
  CANDY_RED_SESSION_TIMEOUT=3600 \
  npm run start
```

The above variables allows you to use the following credentials,

- username: `admin`
- password: `password`
- session timeout: 1 hour

## Test

```
$ npm test
```

## Package

```
# Development Machine
$ npm pack
$ scp ./candy-red-9.6.0.tgz pi@raspberrypi.local:~

# RPi (on ~)
$ sudo npm uninstall -g --unsafe-perm candy-red
$ sudo rm -fr /opt/candy-red # to prune user specific files if necessary
$ time sudo npm install -g --unsafe-perm ./candy-red-9.6.0.tgz
$ sudo journalctl -f -u candy-red -o cat # to show logs
```

### Upload dist

```
$ scp -rp ./dist/* pi@raspberrypi.local:/usr/lib/node_modules/candy-red/dist
```

## Docker

### Image Building

```
$ cd candy-red
$ docker build -t candy-red .
```

### Run CANDY RED container

Run in foreground:
```
$ docker run -ti --rm candy-red
```

`Ctrl+C` to exit.

Run in background:
```
$ docker run -tid --name candy-red candy-red
```

Run `docker rm -f candy-red` to stop (and remove) the container.

### Run CANDY RED container with manually built code

Run in foreground:
```
$ npm run build
$ docker run -ti --rm -v ./dist:/candy-red-dist candy-red
```

Run in background:
```
$ npm run build
$ docker run -tid -v ./dist:/candy-red-dist candy-red
```

### How to release

1. Publish NPM package: `npm publish`
1. Tag Release and Push

## Coding Styles

1. Use ES6 (except gulpfile.js and \*.html)
1. 2-space soft tabs
1. Append .es6.js suffix to ES6 JS files
1. See .jshintrc for detail

## TODO
* publish local Node-RED nodes in this project to npm repository

### Files including the package version

1. README.md
1. [package.json](package.json)

# Copyright and License

## Source Code License

© [CANDY LINE INC.](https://www.candy-line.io)

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## Creative works

PNG/ICO images under src/public folder are released under [CC BY-NC-SA](http://creativecommons.org/licenses/by-nc-sa/4.0/), Copyright (c) 2019 [CANDY LINE INC.](https://www.candy-line.io)
