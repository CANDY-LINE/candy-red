Asakusa Giken BLE device Node-RED nodes
===

This project offers the following BLE device nodes manufactured by Asakusa Giken.

1. [BLECAST_TM](https://translate.google.com/translate?hl=en&sl=ja&tl=en&u=http%3A%2F%2Fwww.robotsfx.com%2Frobot%2FBLECAST_TM.html) ... A BLE temperature sensor device
1. [BLECAST_TM](https://translate.google.com/translate?hl=en&sl=ja&tl=en&u=http%3A%2F%2Fwww.robotsfx.com%2Frobot%2FBLECAST_BL.html) ... A BLE illuminance sensor device

# Prior to building

Install the following CLI tools globally.

```
$ npm install -g grunt-cli babel mocha jshint
```

Then, try this.
```
$ npm install
```

# Build

```
$ grunt build
```
will generate ES5 js files.

# Copyrught and License

The project is released under MIT License. See LICENSE for detail.
