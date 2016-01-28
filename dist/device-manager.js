'use strict';

function _interopRequireWildcard(e) {
  if (e && e.__esModule) return e;
  var t = {};
  if (null != e) for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && (t[r] = e[r]);
  return t['default'] = e, t;
}

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

var _os = require('os'),
    _os2 = _interopRequireDefault(_os),
    _fs = require('fs'),
    _fs2 = _interopRequireDefault(_fs),
    _readline = require('readline'),
    _readline2 = _interopRequireDefault(_readline),
    _events = require('events'),
    _es6Promises = require('es6-promises'),
    _es6Promises2 = _interopRequireDefault(_es6Promises),
    _child_process = require('child_process'),
    _child_process2 = _interopRequireDefault(_child_process),
    _crypto = require('crypto'),
    _crypto2 = _interopRequireDefault(_crypto),
    _path = require('path'),
    _path2 = _interopRequireDefault(_path),
    _chokidar = require('chokidar'),
    chokidar = _interopRequireWildcard(_chokidar),
    _nodeRed = require('node-red'),
    _nodeRed2 = _interopRequireDefault(_nodeRed),
    REBOOT_DELAY_MS = 1000,
    TRACE = process.env.DEBUG || !1,
    EDISON_YOCTO_SN_PATH = '/factory/serial_number',
    PROC_CPUINFO_PATH = '/proc/cpuinfo',
    DeviceIdResolver = (function () {
  function e() {
    _classCallCheck(this, e), this.hearbeatIntervalMs = -1, this.ciotSupported = !1;
  }

  return _createClass(e, [{
    key: 'resolve',
    value: function () {
      var e = this;
      return new _es6Promises2['default'](function (t, r) {
        return e._resolveCANDYIoT(t, r);
      });
    }
  }, {
    key: '_resolveCANDYIoT',
    value: function (e, t) {
      return this._resolveEdison(e, t);
    }
  }, {
    key: '_resolveEdison',
    value: function (e, t) {
      var r = this;

      _fs2['default'].stat(EDISON_YOCTO_SN_PATH, function (n) {
        return n ? r._resolveLTEPi(e, t) : void _fs2['default'].read(EDISON_YOCTO_SN_PATH, function (r, n) {
          return r ? t(r) : void e('EDN:' + n);
        });
      });
    }
  }, {
    key: '_resolveLTEPi',
    value: function (e, t) {
      return this._resolveRPi(e, t);
    }
  }, {
    key: '_resolveRPi',
    value: function (e, t) {
      var r = this;

      _fs2['default'].stat(PROC_CPUINFO_PATH, function (n) {
        if (n) return r._resolveMAC(e, t);

        var i = _readline2['default'].createInterface({
          terminal: !1,
          input: _fs2['default'].createReadStream(PROC_CPUINFO_PATH)
        }),
            s = '';

        i.on('line', function (e) {
          e.indexOf('Serial') >= 0 && e.indexOf(':') >= 0 && (s = e.split(':')[1].trim());
        }), i.on('close', function (n) {
          return n || !s ? r._resolveMAC(e, t) : void e('RPi:' + s);
        });
      });
    }
  }, {
    key: '_resolveMAC',
    value: function (e, t) {
      var r = _os2['default'].networkInterfaces();

      for (var n in r) if (r.hasOwnProperty(n)) for (var i in r[n]) {
        var s = r[n][i].mac;
        if (s && '00:00:00:00:00:00' !== s) return e('MAC:' + n + ':' + s.replace(new RegExp(':', 'g'), '-').toLowerCase());
      }

      t(new Error('No identifier!'));
    }
  }]), e;
})();

exports.DeviceIdResolver = DeviceIdResolver;

var DeviceManager = (function () {
  function e(t, r, n, i) {
    var s = this;
    if ((_classCallCheck(this, e), !n)) throw new Error('accountConfig is required');
    this.primary = t, this.listenerConfig = r, this.accountConfig = n, this.deviceState = i, this.prefix = '[CANDY RED] {DeviceManager}:[' + n.accountFqn + '] ', this.cmdQueue = [], this.events = new _events.EventEmitter(), this.events.on('opened', function () {
      s._warn('connected'), s._resume().then(function (e) {
        e || s._warn('flushed queued commands');
      })['catch'](function (e) {
        s._error(e.stack);
      });
    }), this.events.on('closed', function () {
      s._warn('disconnected'), s._reset();
    }), this.events.on('erro', function (e, t) {
      t ? s._warn('failed to connect' + (t.status ? ' :' + t.status : '')) : s._warn('connection error'), s._reset();
    }), this.events.on('ping', function () {
      s.pingTimeoutTimer && clearTimeout(s.pingTimeoutTimer), s.pingTimeoutTimer = setTimeout(function () {
        s._warn('ping has not come for more than ' + 1.5 * s.hearbeatIntervalMs / 1000 + ' seconds'), s._reset(), s.listenerConfig.server.close();
      }, 1.5 * s.hearbeatIntervalMs);
    }), this.events.send = function (e) {
      var t = e.payload;
      if (t) try {
        t = JSON.parse(t);
      } catch (r) {}

      if ((TRACE && s._info('Received!:' + JSON.stringify(t)), !s.enrolled)) {
        if (!t || !t.status || 2 !== Math.floor(t.status / 100)) return s.listenerConfig.close(), void s._error('Enrollment error! This device is not allowed to access the account:' + n.accountFqn);
        t = t.commands, s.enrolled = !0;
      }

      s._performCommands(t).then(function (e) {
        s._sendToServer(e);
      })['catch'](function (e) {
        if (e instanceof Error) {
          var t = e;
          e = {}, e.status = 500, e.message = t.toString(), e.stack = t.stack;
        } else e && !Array.isArray(e) && (e = [e]);

        s._sendToServer(e);
      })['catch'](function (e) {
        s._error(e.stack);
      });
    }, this.listenerConfig.registerInputNode(this.events), this.listenerConfig.send = function (e) {
      return 'object' != typeof e || e instanceof Buffer || (e = JSON.stringify(e)), s.listenerConfig.broadcast(e);
    }, this._reset();
  }

  return _createClass(e, [{
    key: '_info',
    value: function (e) {
      _nodeRed2['default'].log.info(this.prefix + e);
    }
  }, {
    key: '_warn',
    value: function (e) {
      _nodeRed2['default'].log.warn(this.prefix + e);
    }
  }, {
    key: '_error',
    value: function (e) {
      _nodeRed2['default'].log.error(this.prefix + e);
    }
  }, {
    key: '_resume',
    value: function () {
      var e = this,
          t = this.cmdQueue;
      return 0 === t.length ? new _es6Promises2['default'](function (e) {
        return e(!0);
      }) : (this.cmdQueue = [], t = t.map(function (t) {
        return e.publish(t);
      }), _es6Promises2['default'].all(t));
    }
  }, {
    key: '_enqueue',
    value: function (e) {
      e && this.cmdQueue.push(e);
    }
  }, {
    key: '_reset',
    value: function () {
      this.cmdIdx = 0, this.commands = {}, this.enrolled = !1, this.pingTimeoutTimer && (clearTimeout(this.pingTimeoutTimer), delete this.pingTimeoutTimer);
    }
  }, {
    key: 'publish',
    value: function (e) {
      return this._sendToServer(e);
    }
  }, {
    key: '_sendToServer',
    value: function (t) {
      var r = this;
      return new _es6Promises2['default'](function (n) {
        if (!t || Array.isArray(t) && 0 === t.length || 0 === Object.keys(t)) return r._info('No commands to respond to'), n();
        t = r._numberResponseCommands(t);
        var i = r.listenerConfig.send(t);
        return TRACE && i && r._info('Sent!:' + JSON.stringify(t)), i ? (Array.isArray(t) || (t = [t]), t.reduce(function (e, t) {
          return e || t && t.restart;
        }, !1) && (r._warn('Restarting this process!!'), e.restart()), void n()) : (r._info('Enqueue the commands in order to be sent later on'), r._enqueue(t), n());
      });
    }
  }, {
    key: '_nextCmdIdx',
    value: function () {
      return this.cmdIdx = (this.cmdIdx + 1) % 65536, this.cmdIdx;
    }
  }, {
    key: '_numberResponseCommands',
    value: function (e) {
      var t = this,
          r = e;
      return Array.isArray(e) || (r = [e]), r.forEach(function (e) {
        e.commands ? t._numberRequestCommands(e.commands) : t._numberRequestCommands(e);
      }), e;
    }
  }, {
    key: '_numberRequestCommands',
    value: function (e) {
      var t = this,
          r = e;
      return Array.isArray(e) || (r = [e]), r.forEach(function (e) {
        e.id || (e.id = t._nextCmdIdx()), t.commands[e.id] = e, e.done && (t.done || (t.done = {}), t.done[e.id] = e.done, delete e.done), 'ctrl' !== e.cat || 'sequence' !== e.act && 'parallel' !== e.act || t._numberRequestCommands(e.args);
      }), e;
    }
  }, {
    key: '_performCommands',
    value: function (e) {
      var t = this;
      if (!e) return new _es6Promises2['default'](function (e) {
        return e();
      });

      if (Array.isArray(e)) {
        var r = e.map(function (e) {
          return t._performCommands(e);
        });
        return _es6Promises2['default'].all(r).then(function (e) {
          var t = e.reduce(function (e, t) {
            return e && t ? e.concat(t) : e ? e : t;
          }, []);
          return new _es6Promises2['default'](function (e) {
            return e(t);
          });
        });
      }

      if (e.status) {
        if (e.id) {
          var n = this.commands[e.id];

          if (n) {
            var i = undefined;

            if ((this.done && this.done[e.id] && (i = this.done[e.id]), 2 !== Math.floor(e.status / 100))) {
              _nodeRed2['default'].log.info('Not-OK status to command: ' + JSON.stringify(n) + ', status:' + JSON.stringify(e));

              try {
                i(e.status);
              } catch (s) {}
            } else if (i) try {
              i();
            } catch (s) {}

            i && delete this.done[e.id], delete this.commands[e.id];
          }
        }

        return e.commands ? this._performCommands(e.commands) : (2 !== Math.floor(e.status / 100) && this._info('Server returned Not-OK, status:' + JSON.stringify(e)), new _es6Promises2['default'](function (e) {
          return e();
        }));
      }

      if (!e.id) return new _es6Promises2['default'](function (e) {
        return e({
          status: 400,
          message: 'id missing'
        });
      });
      if (!e.cat) return new _es6Promises2['default'](function (e) {
        return e({
          status: 400,
          message: 'category missing'
        });
      });

      if ('ctrl' === e.cat) {
        var o = e.args || [];
        Array.isArray(o) || (o = [o]);
        var r = undefined;

        switch (e.act) {
          case 'sequence':
            return r = o.reduce(function (e, r) {
              if (!r) return e;
              var n = e.then(function (e) {
                return t._performCommand(r, e);
              });
              return n;
            }, new _es6Promises2['default'](function (e) {
              return e();
            })).then(function (t) {
              return new _es6Promises2['default'](function (r) {
                return t ? (t.push({
                  status: 200,
                  id: e.id
                }), r(t)) : r({
                  status: 400,
                  id: e.id
                });
              });
            });

          case 'parallel':
            return r = o.map(function (e) {
              return t._performCommands(e);
            }), _es6Promises2['default'].all(r).then(function (t) {
              var r = t.reduce(function (e, t) {
                return e && t ? e.concat(t) : e ? e : t;
              }, []);
              return new _es6Promises2['default'](function (t) {
                r.push({
                  status: 200,
                  id: e.id
                }), t(r);
              });
            });

          default:
            throw new Error('unknown action:' + e.act);
        }

        return new _es6Promises2['default'](function (t) {
          return t({
            status: 400,
            errCommands: e
          });
        });
      }

      return this._performCommand(e);
    }
  }, {
    key: '_buildErrResult',
    value: function (e, t) {
      return e instanceof Error ? {
        status: 500,
        message: e.toString(),
        stack: e.stack,
        id: t.id
      } : (e.id = t.id, e);
    }
  }, {
    key: '_performCommand',
    value: function (e, t) {
      var r = this;
      return new _es6Promises2['default'](function (n, i) {
        try {
          switch ((t ? Array.isArray(t) || (t = [t]) : t = [], e.cat)) {
            case 'sys':
              return r._performSysCommand(e).then(function (r) {
                return r ? (r.id = e.id, t.push(r)) : t.push({
                  status: 200,
                  id: e.id
                }), n(t);
              })['catch'](function (n) {
                return t.push(r._buildErrResult(n, e)), i(t);
              });

            default:
              return t.push(r._buildErrResult({
                status: 400
              }, e)), i(t);
          }
        } catch (s) {
          return t.push(r._buildErrResult(s, e)), i(t);
        }
      });
    }
  }, {
    key: '_performSysCommand',
    value: function (e) {
      switch (e.act) {
        case 'provision':
          return this._performProvision(e);

        case 'syncflows':
          return this._performSyncFlows(e);

        case 'updateflows':
          return this._performUpdateFlows(e);

        case 'inspect':
          return this._performInspect(e);

        case 'restart':
          return this._performRestart(e);

        default:
          throw new Error('Unsupported action:' + e.act);
      }
    }
  }, {
    key: '_performInspect',
    value: function (e) {
      var t = this;
      return new _es6Promises2['default'](function (r, n) {
        return n(t.ciotSupported ? e ? {
          status: 501,
          message: 'TODO!!'
        } : {
          status: 400
        } : {
          status: 405
        });
      });
    }
  }, {
    key: '_performProvision',
    value: function (e) {
      return this.hearbeatIntervalMs = e.args.hearbeatIntervalMs, new _es6Promises2['default'](function (e) {
        return e();
      });
    }
  }, {
    key: '_updateLocalFlows',
    value: function (t) {
      var r = this;
      return new _es6Promises2['default'](function (n, i) {
        Array.isArray(t) || (t = [t]);
        var s = t.filter(function (e) {
          return 'CANDY EGG account' !== e.type ? !1 : e.managed && e.accountFqn && e.loginUser ? !0 : !1;
        });
        if (0 === s.length) return i({
          status: 400,
          message: 'invalid flow content'
        });
        s.forEach(function (e) {
          e.revision ? e.revision++ : e.revision = 1, e.originator = r.deviceState.deviceId;
        });
        var o = JSON.stringify(t);

        _fs2['default'].writeFile(r.deviceState.flowFilePath, o, function (t) {
          return t ? i(t) : (r.deviceState.setFlowSignature(o), n({
            data: o,
            done: function () {
              r._warn('FLOW IS UPDATED! RELOAD THE PAGE AFTER RECONNECTING SERVER!!'), e.restart();
            }
          }));
        });
      });
    }
  }, {
    key: '_performSyncFlows',
    value: function (e) {
      var t = this;
      return new _es6Promises2['default'](function (r, n) {
        try {
          if (!e.args.flowUpdateRequired) return n(t.deviceState.flowFileSignature !== e.args.expectedSignature ? t.primary ? {
            status: 202,
            commands: {
              cat: 'sys',
              act: 'deliverflows',
              args: {
                flowId: e.args.flowId
              }
            }
          } : {
            status: 405,
            message: 'not the primary account'
          } : {
            status: 304
          });
          t.deviceState.flowFileSignature !== e.args.expectedSignature && _fs2['default'].readFile(t.deviceState.flowFilePath, function (i, s) {
            if (i) return n(i);
            var o = [];

            try {
              o = JSON.parse(s);
            } catch (a) {
              return n({
                status: 500,
                message: 'My flow is invalid'
              });
            }

            return e.args.publishable ? void t._updateLocalFlows(o).then(function (e) {
              return r(e);
            })['catch'](function (e) {
              return n(e);
            }) : (s = s.toString('utf-8'), t.deviceState.setFlowSignature(s), r({
              data: s
            }));
          });
        } catch (i) {
          return n(i);
        }
      }).then(function (e) {
        return new _es6Promises2['default'](function (r) {
          var n = {
            status: 202,
            commands: {
              cat: 'sys',
              act: 'updateflows',
              args: {
                name: _path2['default'].basename(t.deviceState.flowFilePath),
                signature: t.deviceState.flowFileSignature,
                content: e.data
              },
              done: e.done
            }
          };
          return r(n);
        });
      });
    }
  }, {
    key: '_performUpdateFlows',
    value: function (e) {
      var t = this;
      return new _es6Promises2['default'](function (r, n) {
        try {
          if (!e.args.content) return n({
            status: 400
          });

          _fs2['default'].writeFile(t.deviceState.flowFilePath, e.args.content, function (i) {
            return i ? n(i) : (t.deviceState.setFlowSignature(e.args.content), r({
              status: 200,
              restart: !0
            }));
          });
        } catch (i) {
          return n(i);
        }
      });
    }
  }, {
    key: '_performRestart',
    value: function (e) {
      return new _es6Promises2['default'](function (t, r) {
        return e ? t({
          status: 200,
          restart: !0
        }) : r({
          status: 400
        });
      });
    }
  }], [{
    key: 'restart',
    value: function () {
      setTimeout(function () {
        process.exit(219);
      }, REBOOT_DELAY_MS);
    }
  }]), e;
})();

exports.DeviceManager = DeviceManager;

var DeviceState = (function () {
  function e(t, r) {
    _classCallCheck(this, e), this.ciotSupported = !1, this.flowFileSignature = '', this.flowFilePath = '', this.resolver = new DeviceIdResolver(), this.wartcher = null, this.onFlowFileChanged = t, this.onFlowFileRemoved = r;
  }

  return _createClass(e, [{
    key: 'init',
    value: function () {
      var e = this;
      return new _es6Promises2['default'](function (t) {
        e.deviceId ? t() : e.resolver.resolve().then(function (r) {
          e.deviceId = r, t();
        });
      });
    }
  }, {
    key: 'testIfCANDYIoTInstalled',
    value: function () {
      var e = this;
      return this.init().then(function () {
        return new _es6Promises2['default'](function (e, t) {
          var r = _child_process2['default'].spawn('which', ['ciot'], {
            timeout: 1000
          });

          r.on('close', function (t) {
            var r = 0 === t;
            e(r);
          }), r.on('error', function (e) {
            t(e);
          });
        }).then(function (t) {
          return e.ciotSupported = t, new _es6Promises2['default'](function (e, r) {
            var n = process.env.DEBUG_CIOTV || '';

            if (t) {
              var i = _child_process2['default'].spawn('ciot', ['info', 'version'], {
                timeout: 1000
              });

              i.stdout.on('data', function (e) {
                try {
                  var t = JSON.parse(e);
                  n = t.version;
                } catch (r) {
                  _nodeRed2['default'].log.info(r);
                }
              }), i.on('close', function () {
                e(n);
              }), i.on('error', function (e) {
                r(e);
              });
            }

            e(n);
          });
        });
      });
    }
  }, {
    key: 'loadAndSetFlowSignature',
    value: function () {
      var e = this;
      return new _es6Promises2['default'](function (t, r) {
        _fs2['default'].readFile(e.flowFilePath, function (n, i) {
          return n ? r(n) : t(e.setFlowSignature(i));
        });
      });
    }
  }, {
    key: 'setFlowSignature',
    value: function (e) {
      var t = this.flowFileSignature,
          r = _crypto2['default'].createHash('sha1');

      return r.update(e), this.flowFileSignature = r.digest('hex'), t !== this.flowFileSignature;
    }
  }, {
    key: 'testIfUIisEnabled',
    value: function (e) {
      var t = this;
      return this.init().then(function () {
        return e && t.flowFilePath !== e ? (t.flowFilePath = e, t.watcher && t.watcher.close(), t.watcher = null) : e = t.flowFilePath, new _es6Promises2['default'](function (r) {
          _fs2['default'].readFile(e, function (e, n) {
            if (e) return r(!0);
            t.setFlowSignature(n), _nodeRed2['default'].log.info('[CANDY RED] flowFileSignature: ' + t.flowFileSignature);
            var i = JSON.parse(n);
            return Array.isArray(i) ? void r(i.filter(function (e) {
              return 'CANDY EGG account' === e.type;
            }).reduce(function (e, t) {
              return e && !t.headless;
            }, !0)) : r(!0);
          });
        });
      }).then(function (e) {
        return new _es6Promises2['default'](function (r, n) {
          try {
            return t.watcher || !t.flowFileSignature ? r(e) : (t.watcher = chokidar.watch(t.flowFilePath), t.watcher.on('change', t.onFlowFileChanged), t.watcher.on('unlink', t.onFlowFileRemoved), r(e));
          } catch (i) {
            return n(i);
          }
        });
      });
    }
  }]), e;
})();

exports.DeviceState = DeviceState;

var DeviceManagerStore = (function () {
  function e() {
    _classCallCheck(this, e), this.store = {}, this.deviceState = new DeviceState(this._onFlowFileChangedFunc(), this._onFlowFileRemovedFunc());
  }

  return _createClass(e, [{
    key: '_onFlowFileChangedFunc',
    value: function () {
      var e = this;
      return (function () {
        var t = !1;
        return function () {
          return new _es6Promises2['default'](function (r, n) {
            t || (t = !0, e.deviceState.loadAndSetFlowSignature().then(function (n) {
              if (!n) return t = !1, r();
              var i = Object.keys(e.store).map(function (t) {
                return e.store[t].publish({
                  cat: 'sys',
                  act: 'syncflows',
                  args: {
                    expectedSignature: e.deviceState.flowFileSignature
                  }
                });
              });
              return _es6Promises2['default'].all(i);
            }).then(function () {
              return t = !1, r();
            })['catch'](function (e) {
              return _nodeRed2['default'].log.warn(e.stack), t = !1, n(e);
            }));
          });
        };
      })();
    }
  }, {
    key: '_onFlowFileRemovedFunc',
    value: function () {
      var e = this;
      return (function () {
        return function () {
          return new _es6Promises2['default'](function (t, r) {
            try {
              if (!e.deviceState.flowFileSignature) return t();
              var n = Object.keys(e.store).map(function (t) {
                return e.store[t].primary ? e.store[t].publish({
                  cat: 'sys',
                  act: 'deliverflows'
                }) : undefined;
              });

              _es6Promises2['default'].all(n).then(function () {
                return t();
              })['catch'](function (e) {
                return _nodeRed2['default'].log.warn(e.stack), r(e);
              });
            } catch (i) {
              return r(i);
            }
          });
        };
      })();
    }
  }, {
    key: '_get',
    value: function (e) {
      return this.store[e];
    }
  }, {
    key: '_remove',
    value: function (e) {
      delete this.store[e];
    }
  }, {
    key: 'isWsClientInitialized',
    value: function (e) {
      return !!this._get(e);
    }
  }, {
    key: 'initWsClient',
    value: function (e, t, r) {
      var n = this,
          i = t.accountFqn,
          s = 0 === Object.keys(this.store).length;
      s && _nodeRed2['default'].log.error('[CANDY RED] This account is PRIMARY: ' + i);
      var o = r.get({
        accountConfig: t,
        account: e,
        path: 'candy-ws'
      }, {
        headers: {
          'x-acc-fqn': i,
          'x-acc-user': t.loginUser,
          'x-device-id': this.deviceState.deviceId,
          'x-hostname': _os2['default'].hostname(),
          'x-candy-iotv': _nodeRed2['default'].settings.candyIotVersion,
          'x-candy-redv': _nodeRed2['default'].settings.candyRedVersion
        }
      });
      t.on('close', function () {
        o.close(), n._remove(i), _nodeRed2['default'].log.info('[CANDY RED] Disassociated from [' + i + ']');
      }), this.store[i] = new DeviceManager(s, o, t, this.deviceState), _nodeRed2['default'].log.info('[CANDY RED] Associated with [' + i + ']');
    }
  }]), e;
})();

exports.DeviceManagerStore = DeviceManagerStore;

// CANDY IoT
// TODO

// Intel Edison Yocto

// LTE Pi
// TODO

// RPi
// close event will start a new connection after 3+ seconds

// receiving an incoming message (sent from a source)

// Terminate everything and never retry

// systemctl shuould restart the service

// do nothing

// done callback
// do nothing

// same as act:parallel

// response to the issued command
// do nothing

// do stuff if any after provisioning

// non-primary accounts are NOT allowed to download (to be delivered) flow files

// 304 Not Modified

// non-primary accounts are allowed to upload flow files

// true for modified
//# sourceMappingURL=device-manager.js.map
