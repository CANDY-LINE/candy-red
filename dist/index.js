function _interopRequireDefault(e) {
  return e && e.__esModule ? e : {
    'default': e
  };
}

function _classCallCheck(e, t) {
  if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function');
}

Object.defineProperty(exports, '__esModule', {
  value: !0
});

var _createClass = (function () {
  function e(e, t) {
    for (var r = 0; r < t.length; r++) {
      var n = t[r];
      n.enumerable = n.enumerable || !1, n.configurable = !0, 'value' in n && (n.writable = !0), Object.defineProperty(e, n.key, n);
    }
  }

  return function (t, r, n) {
    return r && e(t.prototype, r), n && e(t, n), t;
  };
})();

require('source-map-support/register');

var _http = require('http'),
    _http2 = _interopRequireDefault(_http),
    _express = require('express'),
    _express2 = _interopRequireDefault(_express),
    _nodeRed = require('node-red'),
    _nodeRed2 = _interopRequireDefault(_nodeRed),
    _os = require('os'),
    _os2 = _interopRequireDefault(_os),
    _fs = require('fs'),
    _fs2 = _interopRequireDefault(_fs),
    _deviceManager = require('./device-manager'),
    PORT = process.env.PORT || 8100,
    DEFAULT_PACKAGE_JSON = __dirname + '/../package.json',
    CandyRed = (function () {
  function e(t) {
    _classCallCheck(this, e), this.app = (0, _express2['default'])(), this.server = _http2['default'].createServer(this.app), this.deviceManagerStore = new _deviceManager.DeviceManagerStore(_nodeRed2['default']), this.flowFile = this._createCandyRedFlowFile(), this.editorTheme = this._createCandyRedEditorTheme(), this.packageJsonPath = t;
  }

  return _createClass(e, [{
    key: 'start',
    value: function () {
      var e = this;
      return this.server.listen(PORT), this._setupExitHandler(), this._inspectBoardStatus(this.packageJsonPath).then(function (t) {
        var r = e._createREDSettigngs(t);

        _nodeRed2['default'].init(e.server, r), r.version += ' [candy-red v' + t.candyRedv + ']', e.app.use(r.httpNodeRoot, _nodeRed2['default'].httpNode);
        var n = r.userDir + '/' + e.flowFile;
        e.deviceManagerStore.deviceState.testIfUIisEnabled(n).then(function (t) {
          t && (_nodeRed2['default'].log.info('[CANDY RED] Deploying Flow Editor UI...'), e.app.use('/', _express2['default']['static'](__dirname + '/public')), r.httpAdminRoot && e.app.get('/', function (e, t) {
            t.redirect(r.httpAdminRoot);
          }), e.app.use(r.httpAdminRoot, _nodeRed2['default'].httpAdmin)), _nodeRed2['default'].start().then(function () {
            _nodeRed2['default'].log.info('Listen port=' + PORT);
          });
        });
      });
    }
  }, {
    key: '_createCandyRedFlowFile',
    value: function () {
      return 'flows_candy-red_' + _os2['default'].hostname() + '.json';
    }
  }, {
    key: '_createCandyRedEditorTheme',
    value: function () {
      return {
        page: {
          title: 'CANDY RED@' + _os2['default'].hostname(),
          favicon: __dirname + '/public/images/candy-red.ico',
          css: __dirname + '/public/css/candy-red.css'
        },
        header: {
          title: ' ** ' + _os2['default'].hostname() + ' **',
          image: __dirname + '/public/images/candy-red.png'
        },
        menu: {
          'menu-item-help': {
            label: 'Powered By Node-RED',
            url: 'http://nodered.org/docs'
          },
          'menu-item-keyboard-shortcuts': !0
        }
      };
    }
  }, {
    key: '_createCandyBoxFlowFile',
    value: function () {
      return 'flows_candy-box_' + _os2['default'].hostname() + '.json';
    }
  }, {
    key: '_createCandyBoxEditorTheme',
    value: function () {
      return {
        page: {
          title: 'CANDY BOX@' + _os2['default'].hostname(),
          favicon: __dirname + '/public/images/candy-box.ico',
          css: __dirname + '/public/css/candy-box.css'
        },
        header: {
          title: ' ** ' + _os2['default'].hostname() + ' **',
          image: __dirname + '/public/images/candy-box.png'
        },
        menu: {
          'menu-item-help': {
            label: 'Powered By Node-RED',
            url: 'http://nodered.org/docs'
          },
          'menu-item-keyboard-shortcuts': !0
        }
      };
    }
  }, {
    key: '_inspectBoardStatus',
    value: function (e) {
      var t = this;
      return this.deviceManagerStore.deviceState.testIfCANDYIoTInstalled().then(function (r) {
        return r && (t.flowFile = t._createCandyBoxFlowFile(), t.editorTheme = t._createCandyBoxEditorTheme()), new Promise(function (t, r) {
          _fs2['default'].stat(e, function (n) {
            return n ? r(n) : t(e);
          });
        }).then(function (e) {
          return new Promise(function (t) {
            _fs2['default'].readFile(e, function (e, n) {
              if (e) return t({
                candyIotv: r,
                candyRedv: 'N/A'
              });
              var i = JSON.parse(n);
              return t({
                candyIotv: r,
                candyRedv: i.version || 'N/A'
              });
            });
          });
        });
      });
    }
  }, {
    key: '_setupExitHandler',
    value: function () {
      function e(e) {
        console.log('[CANDY RED] Bye'), _nodeRed2['default'].settings && _nodeRed2['default'].settings.exitHandlers && _nodeRed2['default'].settings.exitHandlers.forEach(function (e) {
          try {
            e(_nodeRed2['default']);
          } catch (t) {
            console.log('The error [' + t + '] is ignored'), console.log(t.stack);
          }
        }), e instanceof Error ? (console.log(e.stack), process.exit(1)) : isNaN(e) ? process.exit() : process.exit(e);
      }

      process.stdin.resume(), process.on('exit', e), process.on('SIGINT', e), process.on('uncaughtException', e);
    }
  }, {
    key: '_createREDSettigngs',
    value: function (e) {
      return {
        verbose: !0,
        disableEditor: !1,
        httpAdminRoot: '/red',
        httpNodeRoot: '/api',
        userDir: (process.env.HOME || process.env.USERPROFILE) + '/.node-red',
        flowFile: this.flowFile,
        functionGlobalContext: {},
        exitHandlers: [],
        deviceManagerStore: this.deviceManagerStore,
        editorTheme: this.editorTheme,
        candyIotVersion: e.candyIotv,
        candyRedVersion: e.candyRedv
      };
    }
  }]), e;
})();

if ((exports.CandyRed = CandyRed, require.main === module)) {
  var packageJsonPath = DEFAULT_PACKAGE_JSON;
  process.argv.length > 2 && (packageJsonPath = process.argv[2]);
  var app = new CandyRed(packageJsonPath);
  app.start()['catch'](function (e) {
    console.error(e.stack), process.exit(1);
  });
}

// Listen port

// Create an Express app

// Create a server

// Device Management

// Default Theme

// path to package.json

// Create the settings object - see default settings.js file for other options

// Initialise the runtime with a server and settings

// Serve the http nodes from /api

// Add a simple route for static content served from 'public'

// Serve the editor UI from /red

// Start the runtime

// Exit handler

// main
//# sourceMappingURL=index.js.map
