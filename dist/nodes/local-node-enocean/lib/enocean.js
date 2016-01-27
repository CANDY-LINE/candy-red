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
})(),
    _nodeEnocean = require('node-enocean'),
    _nodeEnocean2 = _interopRequireDefault(_nodeEnocean),
    _esp3_erp2_parser = require('./esp3_erp2_parser'),
    _es6Promises = require('es6-promises'),
    _es6Promises2 = _interopRequireDefault(_es6Promises),
    _fs = require('fs'),
    _fs2 = _interopRequireDefault(_fs),
    _lruCache = require('lru-cache'),
    _lruCache2 = _interopRequireDefault(_lruCache),
    unknown = (0, _lruCache2['default'])({
  max: 100,
  maxAge: 3600000
}),
    ESP3_PACKET_PARSERS = {
  10: new _esp3_erp2_parser.ESP3RadioERP2Parser()
},
    ESP3Parser = (function () {
  function e(t) {
    _classCallCheck(this, e), this.RED = t;
  }

  return _createClass(e, [{
    key: 'parse',
    value: function (e) {
      return new _es6Promises2['default'](function (t, r) {
        var n = ESP3_PACKET_PARSERS[e.packetType];
        if (n) t({
          parser: n,
          payload: e.rawByte
        });else {
          var o = new Error('enocean.errors.unsupportedPacketType');
          o.packetType = e.packetType, r(o);
        }
      });
    }
  }]), e;
})(),
    SerialPool = (function () {
  function e(t) {
    _classCallCheck(this, e), this.pool = {}, this.esp3Parser = new ESP3Parser(t), this.erp2Parser = new _esp3_erp2_parser.ERP2Parser(), this.RED = t;
  }

  return _createClass(e, [{
    key: 'add',
    value: function (e) {
      var t = this,
          r = e.serialPort;
      if (!r) throw new Error('serialPort proeprty is missing!');
      if (!_fs2['default'].existsSync(r)) throw new Error('The port [' + r + '] is NOT ready!');
      if (t.pool[r]) throw new Error('The serial port [' + r + '] is duplicate!');
      var n = (0, _nodeEnocean2['default'])();
      n.listen(r), n.on('data', function (e) {
        t.esp3Parser.parse(e).then(function (e) {
          e.parser.parse(e.payload).then(function (e) {
            t.erp2Parser.parse(e).then(function (e) {
              var r = e.originatorId;
              n.emit('ctx-' + r, e) || unknown.get(r) || (unknown.set(r, 1), t.RED.log.warn(t.RED._('enocean.warn.noNode', {
                originatorId: r
              })));
            })['catch'](function (r) {
              t.RED.log.error(t.RED._('enocean.errors.parseError', {
                error: r,
                data: JSON.stringify(e)
              }));
            });
          })['catch'](function (r) {
            t.RED.log.error(t.RED._('enocean.errors.parseError', {
              error: r,
              data: e.payload
            }));
          });
        })['catch'](function (r) {
          r instanceof Error && 'enocean.info.unsupportedPacketType' === r.message ? t.RED.log.info(t.RED._('enocean.info.unsupportedPacketType', {
            packetType: r.packetType
          })) : t.RED.log.error(t.RED._('enocean.errors.parseError', {
            error: r,
            data: JSON.stringify(e)
          }));
        });
      }), n.on('error', function (e) {
        t.RED.log.error(t.RED._('enocean.errors.serialPortError', {
          error: e
        })), delete t.pool[r];
      }), n.on('close', function () {
        t.RED.log.info(t.RED._('enocean.info.serialPortClosed', {
          portName: r
        })), delete t.pool[r];
      }), t.pool[r] = {
        node: e,
        port: n
      }, t.RED.log.info(t.RED._('enocean.info.serialPortAdded', {
        portName: r
      }));
    }
  }, {
    key: 'get',
    value: function (e) {
      var t = this,
          r = t.pool[e];
      if (!r) throw new Error('The given port ' + e + ' is missing!');
      return r;
    }
  }, {
    key: 'close',
    value: function (e) {
      var t = this,
          r = t.pool[e];
      return new _es6Promises2['default'](function (n) {
        r ? (delete t.pool[e], r.port.close(function () {
          n();
        })) : n();
      });
    }
  }]), e;
})();

exports.SerialPool = SerialPool;

/*
 * EnOcean Module
 */

// Packet Type 10: RADIO_ERP2
//# sourceMappingURL=enocean.js.map
