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
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || !1, r.configurable = !0, 'value' in r && (r.writable = !0), Object.defineProperty(e, r.key, r);
    }
  }

  return function (t, n, r) {
    return n && e(t.prototype, n), r && e(t, r), t;
  };
})(),
    _ws = require('ws'),
    _ws2 = _interopRequireDefault(_ws),
    _url = require('url'),
    _url2 = _interopRequireDefault(_url),
    TEST_SERVER_PING_TIMEOUT = !1;

exports['default'] = function (e) {
  var t = (function () {
    function t(e, n, r, s, i) {
      _classCallCheck(this, t), this.accountConfig = e, this.account = n, this.path = r, this.webSocketListeners = s, this.server = null, this._inputNodes = [], this._outputNodes = [], this.closing = !1, this.options = i || {}, this.redirect = 0, this.authRetry = 0, this.startconn();
    }

    return _createClass(t, [{
      key: 'startconn',
      value: function (e) {
        var t = this.accountConfig,
            n = 'ws' + (t.secure ? 's' : '') + '://';
        n += t.loginUser + ':' + t.loginPassword + '@';
        var r = t.accountFqn.split('@');
        n += r[1];
        var s = this.path;

        if (e) {
          var i = _url2['default'].parse(e);

          i.host ? (n = i.href, s = null) : s = i.href;
        } else n += '/' + r[0] + '/api';

        s && s.length > 0 && '/' !== s.charAt(0) && (n += '/'), s && (n += s);
        var o = new _ws2['default'](n, this.options);
        this.server = o, this.handleConnection(o);
      }
    }, {
      key: 'handleConnection',
      value: function (t) {
        var n = this,
            r = (1 + 4294967295 * Math.random()).toString(16);
        t.on('open', function () {
          n.emit2all('opened'), n.redirect = 0, n.authRetry = 0, t.skipCloseEventHandler = !1;
        }), t.on('close', function () {
          t.skipCloseEventHandler || (n.emit2all('closed'), n.closing || (n.tout = setTimeout(function () {
            n.startconn();
          }, 3000 + 1000 * Math.random())));
        }), t.on('message', function (e, s) {
          n.handleEvent(r, t, 'message', e, s);
        }), TEST_SERVER_PING_TIMEOUT && t.removeAllListeners('ping'), t.on('ping', function (e, t) {
          n.emit2all('ping', e, t);
        }), t.on('unexpected-response', function (r, s) {
          if ((n.emit2all('erro', r, s), r.abort(), s.socket.end(), 301 === s.statusCode || 302 === s.statusCode || 307 === s.statusCode)) if (s.headers.location) {
            if (!(n.redirect > 3)) return ++n.redirect, n.startconn(s.headers.location);
            n.redirect = 0, e.log.error(e._('candy-egg-ws.errors.too-many-redirects', {
              path: n.path,
              location: s.headers.location
            }));
          } else if (404 === s.statusCode) e.log.error(e._('candy-egg-ws.errors.wrong-path', {
            path: n.path
          }));else if (401 === s.statusCode) {
            if ((e.log.error(e._('candy-egg-ws.errors.auth-error', {
              path: n.path,
              user: n.accountConfig.loginUser
            })), ++n.authRetry, n.authRetry > 10)) return;
            e.log.info(e._('candy-egg-ws.status.auth-retry'));
          } else e.log.error(e._('candy-egg-ws.errors.server-error', {
            path: n.path,
            status: s.statusCode
          }));
          t.skipCloseEventHandler = !0, t.close(), n.tout = setTimeout(function () {
            n.startconn();
          }, 55000 + 10000 * Math.random()), n.redirect = 0;
        }), t.on('error', function (r) {
          n.emit2all('erro', r), e.log.error(e._('candy-egg-ws.errors.connect-error', {
            err: r,
            accountFqn: n.accountConfig.accountFqn
          })), t.skipCloseEventHandler = !0, t.close(), n.closing || (n.tout = setTimeout(function () {
            n.startconn();
          }, 3000 + 1000 * Math.random()));
        });
      }
    }, {
      key: 'registerOutputNode',
      value: function (e) {
        this._outputNodes.push(e);
      }
    }, {
      key: 'removeOutputNode',
      value: function (e) {
        this._outputNodes.forEach(function (t, n, r) {
          t === e && r.splice(n, 1);
        }), 0 === this._inputNodes.length && 0 === this._outputNodes.length && this.close();
      }
    }, {
      key: 'registerInputNode',
      value: function (e) {
        this._inputNodes.push(e);
      }
    }, {
      key: 'removeInputNode',
      value: function (e) {
        this._inputNodes.forEach(function (t, n, r) {
          t === e && r.splice(n, 1);
        }), 0 === this._inputNodes.length && 0 === this._outputNodes.length && this.close();
      }
    }, {
      key: 'handleEvent',
      value: function (t, n, r, s, i) {
        var o = undefined,
            a = undefined;

        try {
          a = JSON.parse(s);
        } catch (u) {
          a = {
            payload: s
          };
        }

        o = {
          payload: s,
          _session: {
            type: 'candy-egg-ws',
            id: t
          }
        }, a._session = o._session;

        for (var c = 0; c < this._inputNodes.length; c++) this._inputNodes[c].wholemsg ? this._inputNodes[c].send(a) : this._inputNodes[c].send(o);

        e.log.debug('flags:' + i);
      }
    }, {
      key: 'emit2all',
      value: function () {
        for (var e = arguments.length, t = Array(e), n = 0; e > n; n++) t[n] = arguments[n];

        for (var r = 0; r < this._inputNodes.length; r++) {
          var s = this._inputNodes[r];
          s.emit.apply(s, t);
        }

        for (var r = 0; r < this._outputNodes.length; r++) {
          var s = this._outputNodes[r];
          s.emit.apply(s, t);
        }
      }
    }, {
      key: 'close',
      value: function () {
        this.closing = !0, this.server.close(), this.tout && clearTimeout(this.tout), this.webSocketListeners.remove(this);
      }
    }, {
      key: 'broadcast',
      value: function (t) {
        try {
          return 'object' != typeof t || t instanceof Buffer || (t = JSON.stringify(t)), this.server.send(t), !0;
        } catch (n) {
          return e.log.error(e._('candy-egg-ws.errors.send-error', {
            err: n,
            accountFqn: this.accountConfig.accountFqn
          })), !1;
        }
      }
    }]), t;
  })(),
      n = (function () {
    function n() {
      _classCallCheck(this, n), this.store = {};
    }

    return _createClass(n, [{
      key: 'get',
      value: function (n) {
        var r = arguments.length <= 1 || undefined === arguments[1] ? null : arguments[1];
        if (!n.accountConfig) throw new Error(e._('candy-egg-ws.errors.missing-conf'));
        var s = n.account + ':' + n.path,
            i = this.store[s];
        return i || (i = new t(n.accountConfig, n.account, n.path, this, r), this.store[s] = i), i;
      }
    }, {
      key: 'remove',
      value: function (e) {
        var t = e.account + ':' + e.path;
        delete this.store[t];
      }
    }, {
      key: 'reset',
      value: function (e) {
        var t = this,
            n = e + ':',
            r = [];

        for (var s in this.store) this.store.hasOwnProperty(s) && 0 === s.indexOf(n) && r.push(s);

        r.forEach(function (e) {
          delete t.store[e];
        });
      }
    }]), n;
  })(),
      r = new n(),
      s = function a(t) {
    _classCallCheck(this, a), e.nodes.createNode(this, t), this.accountFqn = t.accountFqn, this.loginUser = t.loginUser, this.loginPassword = t.loginPassword, this.secure = t.secure, r.reset(t.id), this.managed = t.managed;
    var n = e.settings.deviceManagerStore;
    this.managed && n && n.isWsClientInitialized && (n.isWsClientInitialized(this.accountFqn) || n.initWsClient(t.id, this, r));
  };

  e.nodes.registerType('CANDY EGG account', s);

  var i = function u(t) {
    var n = this;
    _classCallCheck(this, u), e.nodes.createNode(this, t), this.account = t.account, this.accountConfig = e.nodes.getNode(this.account), this.path = t.path, this.wholemsg = t.wholemsg, this.accountConfig ? (this.listenerConfig = r.get(this), this.listenerConfig.registerInputNode(this), this.on('opened', function () {
      n.status({
        fill: 'green',
        shape: 'dot',
        text: 'candy-egg-ws.status.connected'
      });
    }), this.on('erro', function () {
      n.status({
        fill: 'red',
        shape: 'ring',
        text: 'candy-egg-ws.status.error'
      });
    }), this.on('closed', function () {
      n.status({
        fill: 'red',
        shape: 'ring',
        text: 'candy-egg-ws.status.disconnected'
      });
    })) : this.error(e._('candy-egg-ws.errors.missing-conf')), this.on('close', function () {
      n.listenerConfig.removeInputNode(n);
    });
  };

  e.nodes.registerType('CANDY EGG websocket in', i);

  var o = function c(t) {
    var n = this;
    _classCallCheck(this, c), e.nodes.createNode(this, t), this.account = t.account, this.accountConfig = e.nodes.getNode(this.account), this.path = t.path, this.wholemsg = t.wholemsg, this.accountConfig ? (this.listenerConfig = r.get(this), this.listenerConfig.registerOutputNode(this), this.on('opened', function () {
      n.status({
        fill: 'green',
        shape: 'dot',
        text: 'candy-egg-ws.status.connected'
      });
    }), this.on('erro', function () {
      n.status({
        fill: 'red',
        shape: 'ring',
        text: 'candy-egg-ws.status.error'
      });
    }), this.on('closed', function () {
      n.status({
        fill: 'red',
        shape: 'ring',
        text: 'candy-egg-ws.status.disconnected'
      });
    })) : this.error(e._('candy-egg-ws.errors.missing-conf')), this.on('close', function () {
      n.listenerConfig.removeOutputNode(n);
    }), this.on('input', function (t) {
      var r = undefined;
      n.wholemsg ? (delete t._session, r = JSON.stringify(t)) : t.hasOwnProperty('payload') && (r = Buffer.isBuffer(t.payload) ? t.payload : e.util.ensureString(t.payload)), r && n.listenerConfig.broadcast(r);
    });
  };

  e.nodes.registerType('CANDY EGG websocket out', o);
}, module.exports = exports['default'];

/**
 * Copyright 2013, 2015 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// socket for server connection

// collection of input nodes want to receive events
// node status event listeners
// start outbound connection
// Connect to remote endpoint
// keep for closing
/*socket*/
// try to reconnect every 3+ secs
// never retry

// try to reconnect every approx. 1 min

// try to reconnect every 3+ secs
/*Node*/ /*Node*/ /*Node*/ /*Node*/ /*socket*/ /*String*/ /*Object*/ /*Object*/
// deploying implicit API clients (candy-ws)
// if it's not a buffer make sure it's a string.
//# sourceMappingURL=candy-egg-ws.js.map
