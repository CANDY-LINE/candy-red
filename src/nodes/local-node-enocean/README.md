EnOcean Node-RED nodes
===

This is a Node-RED node for EnOcean devices, in particular, communicating with Packet Type 10: RADIO_ERP2 format for ESP3.

The supported EEPs are described in the help text (appears on `info` tab on the browser).

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
