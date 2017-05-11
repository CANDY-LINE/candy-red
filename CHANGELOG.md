## Revision History
* ?.?.?
  - Set NODE_PALETTE_ENABLED=true by default

* 3.1.0
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
