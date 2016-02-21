Device Statistics Node-RED node
===

This node creates statistics information according to the node settings on the editor. The statistics will be embedded into msg.payload and emitted to the output port.

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

# Copyright and License

The project is released under MIT License. See LICENSE for detail.
