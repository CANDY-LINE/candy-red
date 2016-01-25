CANDY EGG http/ws client nodes for Node-RED
===

This project provides an HTTP client and a WebSocket client dedicated to CANDY EGG cloud environment. The use of the nodes require a CANDY EGG user account.

These nodes are drivative works from Node-RED's httprequest node and websocket input node.

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

The original works are released under Apache Software License 2.0. See node-red.LICENSE for the copyright holder and the entire license text.

The project itself is released under MIT License as well. See LICENSE for detail.
