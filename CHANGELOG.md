## Revision History
* 7.0.2
  - Add a missing package

* 7.0.1
  - Remove devDependencies by default on generating a shrinkwrap file
  - Remove devDependencies from the shrinkwrap file

* 7.0.0
  - Add new preinstalled nodes
    - node-red-node-smooth
    - node-red-node-base64
    - node-red-node-data-generator
    - node-red-node-random
    - node-red-node-suncalc
    - node-red-contrib-web-worldmap
  - Add GNSS nodes with example flows dedicated to CANDY Pi Lite 3G and CANDY Pi Lite+
  - Add a new category for CANDY LINE (CANDY EGG nodes and GNSS nodes are placed there)

* 6.1.0
  - Bump up Node-RED Dashboard version to v2.9.1
  - Add a new preinstalled package (SmartMesh IP™ device node)
  - Install PySerial for preinstalled SmartMesh IP™ device node

* 6.0.1
  - Fix an issue where ATB with Tinker OS v2.0.5+ was misidentified as RPi because of preinstalled `RPI.GPIO` package

* 6.0.0
  - Bump up Node-RED version to v0.18.4
  - Bump up Node-RED Dashboard version to v2.8.2
  - Remove `node-red-contrib-sequence-functions` nodes as the similar nodes are now included as core nodes
  - Add a new option `NODE_RED_PROJECTS_ENABLED` to enable/disable Node-RED Projects support, which allows you git-based version control on your flow files (disabled by default for now)

* 5.6.1
  - Fix issues where type errors can be thrown on some node state

* 5.6.0
  - Add support for binding IPv4 interface as well as IPv6/dual-stack interfaces
  - Bump dependency versions

* 5.5.0
  - Add device id prefix support for Tinker Board and generic Linux boards as well as RPi
  - Warn weak passwords as well as Raspberry Pi default password

* 5.4.0
  - Add Show warning alert when the given username and password are Raspberry Pi's default
  - Add Raspberry Pi Sense HAT support

* 5.3.0
  - Add PAM authentication support (enabled by default)
  - Fix an issue where API authentication didn't work when basic authentication is enabled
  - Compute --max-old-space-size value when the option is missing
  - Fix an issue where ESP3Parser doesn't support node-serialport@5+ interface
  - Add a new endpoint to provide enocean ports as well as serial ports

* 5.2.0
  - Add basic authentication support for admin role account
  - Add a new option to enable/disable the warning output on unknown originator ids being detected
  - Add node-red-contrib-lwm2m node as a builtin node
  - Add support for Node.js v8.9+
  - Fix an issue where the runtime error can be thrown when properties in accountConfig is missing
  - Fix an issue where WS client failed to connect to non-default port

* 5.1.0
  - Add a new environment `NODES_CSV` to provide preinstalled nodes on installing CANDY RED
  - Add CANDY RED icons to appear on Node-RED Dashboard
  - Fix an issue where install_preinstalled_nodes were invoked on installation test
  - Disable drop_console in order to show logs at pre-initialized state
  - Fix an issue where folders under node_moudles cannot be removed

* 5.0.1
  - Fix an issue where some of default packages cannot be installed because of existing packages

* 5.0.0
  - Migrate to Apache Software License 2.0 as of this version
  - Add a feature to allow users to install additional node packages on installing CANDY RED
    * Set `NODES_CSV_PATH` pointing to the path to node package list CSV file
  - Bump default Node.js version to 6.11
  - DO NOT bump node-enocean version to 2.x or later as Node.js 7+ isn't yet supported
  - Remove obsolete board support (CANDY BOX)
  - `node-red-contrib-asakusa_giken` is now an optional node, which can be installed via the Node Palette
  - `node-red-contrib-generic-ble` is installed as a preinstalled BLE node

* 4.0.0
  - Set NODE_PALETTE_ENABLED=true by default
  - Repo transferred to CANDY-LINE
  - Fix an issue where ws complained of the credentials containing unescaped special characters like '%'
  - Allow hyphen as CANDY EGG account id
  - Migrate to gulp
  - Use credentials property for CANDY EGG account node (with backward compatibilities)

* 3.0.0
  - Bump up Node-RED version to v0.16.2 (NOTE: Node-RED Node Palette is disabled by default, set NODE_PALETTE_ENABLED=true for enabling the palette UI)
  - Node.js v0.12 is no longer supported
  - Intel Edison is no longer supported
  - LTEPiGPS is retired

* 2.9.1
  - Add a new switch to enable/disable learning mode on start up for test use (local-node-enocean)
  - Add a new boolean property whether or not to ignore LRN bit while learning mode (local-node-enocean)

* 2.9.0
  - Bump up Node-RED version to v0.15.2 (NOTE: Node-RED Node Palette is disabled by default, set NODE_PALETTE_ENABLED=true for enabling the palette UI)
  - Bump up Dashboard UI version to v2.1.0
  - Add a new EnOcean device support for A5-07-01(4BS/Occupancy with Supply voltage monitor)
  - Add teach-in feature to EnOcean node

* 2.8.2
  - Fix an issue where a socket wasn't closed when WebSocketListener handled redirect response

* 2.8.1
  - Fix an issue where the process will exit on the flow file being empty

* 2.8.0
  - Accept the latest version of node-red-contrib-asakusa_giken and node-red-contrib-device-stats packages
  - Fix validation rules (local-nodecandy-egg)
  - Parse JSON string when the incoming message is a JSON string (local-nodecandy-egg)

* 2.7.0
  - Modify the way to detect if candy-iot board is installed so that the valid UI theme is chosen even when the modem is offline
  - Add new functions for detecting LTEPi-II board

* 2.6.3
  - Bump up Node-RED version to v0.14.6
  - Bump up Dashboard UI version to v2.0.1

* 2.6.2
  - Fix welcome flow download error

* 2.6.1
  - Fix publish error

* 2.6.0
  - Add a new feature to setup the default flow when user flow file is missing
  - Enable to pretty flow file format by default
  - Enable node-red-contrib-moment v2.0.0 by default for better date/time operation
  - Disable LTEPiGPS on unsupported device

* 2.5.0
  - Bump up Node-RED version to v0.14.5
  - Enable node-red-dashboard v2.0.0 by default
  - Bump up asakusa_giken node version to v1.1.0
  - Fix CSS

* 2.4.0
  - Bump up Node-RED version to v0.13.4

* 2.3.0
  - Remove global dependencies (`npm install -g ...` is no longer required to build the project)
  - Show device ID on the editor header
  - Bump up Node-RED version to v0.13.3
  - Interact with a service for [CANDY IoT Board for Intel® Edison](https://translate.googleusercontent.com/translate_c?act=url&depth=1&hl=en&ie=UTF8&prev=_t&rurl=translate.google.com&sl=ja&tl=en&u=https://github.com/Robotma-com/candy-iot-service&usg=ALkJrhgViBgwht0t9vgBvmuJNkJb_kjoJg) in order to collect the modem information
  - Add a new node for providing GPS location with LTEPi board (RPi series only)

* 2.2.0
  - Create a dedicated user data directory on `/opt/candy-red`, where flow files are stored so that they're left on performing version up
  - Add a new experimental local node for collecting device statistics
  - Bump up Node-RED version to v0.13.2
  - Modify the flow file name definition (not depending on hostname but always `flows_candy-red.json`)
  - [LTEPi Board for Raspberry Pi](https://translate.google.co.jp/translate?sl=auto&tl=en&js=y&prev=_t&hl=en&ie=UTF-8&u=http%3A%2F%2Flte4iot.com%2Fproducts%2Fltepi%2F&edit-text=&act=url) is now automatically detected and `RED.settings.ltepiVersion` will be set if LTEPi is available
  - Improve device management connection stability

* 2.1.2
  - Fix jshint error

* 2.1.1
  - Publish to npm
  - npm installation/uninstallation/version-up support

* 2.1.0
  - SysVinit is no longer supported
  - Publish the asakusa_giken local nodes as [node-red-contrib-asakusa_giken](https://github.com/Robotma-com/node-red-contrib-asakusa_giken) and separate the repo
  - Add Dockerfile for development and testing
  - Add Vagrantfile for development and testing

* 2.0.1
  - Fix CANDY EGG nodes issues

* 2.0.0
  - Node-RED integration
  - Add CANDY EGG cloud endpoint nodes
  - Add Asakusa Giken-made BLE nodes
  - Add EnOcean node
  - Add device management features provided with CANDY EGG cloud
     - This feature includes process restart which should work with system services like systemd/sysvinit
  - Bump up Node.js version and BlueZ version for RPi devices

* 1.3.0
  - Add an option to enable to generate a list of copied files
  - [Edison (Yocto)] Fix an issue where npm install with a github repo id didn't work
  - `npm test` now works

* 1.2.0
  - EnOcean Protocol and Profile support (ESP3 with ERP2 and EEP2.6)
  - Source map support for transpiled code
  - [RaspberryPi (Raspbian)] `--unsafe-perm` flag is required for installation

* 1.1.0
  - Modifies the installation process, running `npm install` then `install.sh`
  - Renames the module name
  - Raspberry Pi (Raspbian) Support

* 1.0.0
  - Initial Release
