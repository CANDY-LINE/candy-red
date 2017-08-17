CANDY RED
===

[![GitHub release](https://img.shields.io/github/release/CANDY-LINE/candy-red.svg)](https://github.com/CANDY-LINE/candy-red/releases/latest)
[![master Build Status](https://travis-ci.org/CANDY-LINE/candy-red.svg?branch=master)](https://travis-ci.org/CANDY-LINE/candy-red/)
[![License MIT](https://img.shields.io/github/license/CANDY-LINE/candy-red.svg)](http://opensource.org/licenses/MIT)

CANDY RED is a gateway service working between local area wireless network devices and internet servers.

## Features

* Include Node-RED flow editor/flow execution runtime
* Running as a systemd service
* Preinstalled EnOcean node
* Preinstalled helper nodes for CANDY EGG cloud service \*

_\* [CANDY EGG cloud service](https://www.candy-line.io/%E8%A3%BD%E5%93%81%E4%B8%80%E8%A6%A7/candy-red-egg/) account is required_

## OS and Hardwares

* [Raspberry Pi + Raspbian](#raspberry-pi--raspbian)
* [OSX/Linux for Development](#development)

# Screenshots
## CANDY RED flow editor page on browser

This is the default screen theme.

![CANDY RED Screenshot](https://raw.githubusercontent.com/CANDY-LINE/candy-red/master/images/screenshot-candy-red.png "CANDY RED Screenshot")

# Raspberry Pi + Raspbian

## Prerequisites

### Raspbian version

 * JESSIE/JESSIE LITE Kernel Version: 4.9 (2017-07-05)

### Tested Node.js versions

* v6.11.2

The preinstalled version of Node.js v0.10.29 won't work because of the [header file issue](http://dustinbolton.com/replace_invalid_utf8-is-not-a-member-of-v8string-installing-nodejs-packages-on-raspbian-debian-on-raspberry-pi-2-b/) appearing on installing native addons.

I highly recommend you to uninstall the preinstalled version of Node.js, Node-RED (which depends on `nodejs` and `nodejs-legacy` packages) and npm by the following command, and to install another version instead.

```
$ sudo apt-get remove -y nodered nodejs nodejs-legacy npm
```

### Supported npm version

* v3.x (same as default npm bundled with Node.js v6)

## Install/Version-up

The module installation will take around 30 minutes on RPi1. On RPi2+, the installation time will be shorter.

Please consider to change your hostname as [described below](#change-hostname) prior to installing CANDY RED.

`--unsafe-perm` flag is required for installing this project module since npm performs privileged actions during the installation. This is discussed in the [issue](https://github.com/voodootikigod/node-serialport/issues/535).

You can ignore `npm WARN`s, `gyp WARN`s, `gyp ERR!`s and `node-pre-gyp ERR!`s unless the installation terminates normally. You can check if the installation is successful by `sudo service candy-red status` command after running `install.sh` script as well as `npm install`.

** Please export your flow data prior to performing version-up **

Please refer to the following commands to install.

```
$ sudo NODE_OPTS=--max-old-space-size=256 npm install -g --unsafe-perm candy-red
```

You can access `http://<hostname.local or ip address>:8100` with your browser on the same LAN where `<hostname.local or ip address>` is a host name with `.local` suffix or IP address.

## Stop/Start/Status Service

The service name is `candy-red`. As of Jessie, systemd comes as a default system manager.

```
$ sudo systemctl stop candy-red
$ sudo systemctl start candy-red
$ sudo systemctl status candy-red
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

You can change the host name by either `sudo raspi-config` or modifying `/etc/hosts`. Regarding the latter method, here is a brief instruction.

```
$ export NEW_NAME="my-candy-pi" # Modify my-candy-pi as you like
$ sudo sed -i -e "s/raspberrypi/${NEW_NAME//\//\\/}/g" /etc/hosts
$ sudo sed -i -e "s/raspberrypi/${NEW_NAME//\//\\/}/g" /etc/hostname
$ sudo /etc/init.d/hostname.sh && sudo reboot
```
You can ignore `sudo: unable to resolve host raspberrypi` error message.

### BLE USB adaptor/dongle

CANDY RED service tries to activate the `hci0` device if it exists on boot so that you can use BLE devices on the flow editor. This is performed silently at background and you usually don't have to care of it.

However, you need to tell the system to restart the CANDY RED service by performing `sudo systemctl restart candy-red` when you insert the dongle after boot. Or BLE is not available.

### Node-RED home

The Node-RED home path, where flow files are placed, is found at `$(npm root -g)/candy-red/.node-red/`.

### Slow boot time

It takes up to around a minute to boot up the service. Please be patient and wait until the service is online.

### BlueZ source code build

The latest Raspbian offers you to install BlueZ with `apt-get` command as described above.
However, you can still use the latest version of BlueZ if you want.

You can find the installation instruction in the [article](http://www.elinux.org/RPi_Bluetooth_LE). The compilation takes around 40 minutes (RPi B+).

Here is a brief instruction. (Check the latest version of BlueZ at www.bluez.org)
```
$ BLUEZ_VER=5.45
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

# Development

## Prerequisites

### Supported Node.js versions

* v6.11

## Setup for Building

Install the local dependencies.

```
$ git clone https://github.com/CANDY-LINE/candy-red.git
$ cd candy-red
$ DEVEL=true npm install
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
$ npm install
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

## Test

```
$ npm test
```

## Package

```
$ npm pack
# RPi
$ sudo npm uninstall -g --unsafe-perm candy-red
$ time sudo npm install -g --unsafe-perm ./candy-red-5.0.0.tgz
```

## Vagrant

### Version

 * v1.8.4+

### Run on Vagrant Instance

```
(host)  $ vagrant up
(host)  $ vagrant ssh
(varant)$ cd /vagrant
(varant)$ npm install
(varant)$ npm run start
```

### Local Installation Test

```
(host)  $ vagrant up
(host)  $ vagrant ssh
(varant)$ cd /vagrant
(varant)$ npm pack
(varant)$ mv *.tgz /tmp
(varant)$ cp ./install.sh /tmp
(varant)$ cd /tmp
(varant)$ sudo TARBALL=/tmp/candy-red-<version>.tgz ./install.sh
```

Then access to `http://localhost:8100/red/` with a browser on the host OS.

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

### Shrinkwrap

```
$ rm -fr node_modules; \
  rm -f npm-shrinkwrap.json; \
  docker run --name build --rm -ti -v $(pwd):/work -w /work -e DEVEL=true \
    node:6.11 bash -c "npm install;npm run freeze"
```

## Coding Styles

1. Use ES6 (except Gruntfile.js and \*.html)
1. 2-space soft tabs
1. Append .es6.js suffix to ES6 JS files
1. See .jshintrc for detail

## Known Issues

* CANDY EGG cloud services aren't yet available

## TODO
* publish local Node-RED nodes in this project to npm repository

### Files including the package version

1. README.md
1. [package.json](package.json)

# Copyright and License

PNG/ICO images under src/public folder are released under [CC BY-NC-SA](http://creativecommons.org/licenses/by-nc-sa/4.0/), © 2017 CANDY LINE INC.

Other stuff than the files above in this project repository is released under MIT. See [LICENSE](LICENSE) for the license terms and the copyright.
