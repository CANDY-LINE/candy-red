function _interopRequireDefault(e) {
  return e && e.__esModule ? e : {
    'default': e
  };
}

function registerIn(e, t, r, n, i, s, a) {
  if (!(e && t && r && i)) throw new Error('Invalid node!');
  if (!a) throw new Error('RED is required!!');
  var o = peripheralsIn[t];
  o || (o = {}, peripheralsIn[t] = o);
  var u = [];
  r in o && (u = o[r], u = u.filter(function (t) {
    return a.nodes.getNode(t.id) ? t.id !== e.id : !1;
  })), u.push({
    id: e.id,
    parse: i,
    useString: s
  }), o[r] = u, n ? (o[n] = o[r], a.log.info('[BLE] category=[' + t + '], address=[' + r + '], uuid=[' + n + '], node ID=[' + e.id + '] has been registered.')) : a.log.info('[BLE] category=[' + t + '], address=[' + r + '], node ID=[' + e.id + '] has been registered.');
}

function stop(e) {
  _noble2['default'].stopScanning(), isScanning = !1, e && e._ && e.log.info(e._('asakusa_giken.message.stop-scanning'));
}

function start(e) {
  if (!e) throw new Error('RED is required!');
  var t = e.settings.exitHandlers;
  return t && t.indexOf(stop) < 0 ? t.push(stop) : (t = [stop], e.settings.exitHandlers = t), new _es6Promises2['default'](function (t) {
    return isScanning ? t() : (_noble2['default'].on('stateChange', function (t) {
      'poweredOn' === t ? isScanning || (e.log.info(e._('asakusa_giken.message.start-scanning')), _noble2['default'].startScanning([], !0), isScanning = !0) : (_noble2['default'].stopScanning(), isScanning = !1);
    }), isScanning || 'poweredOn' !== _noble2['default'].state || (e.log.info(e._('asakusa_giken.message.start-scanning')), _noble2['default'].startScanning([], !0), isScanning = !0), void t());
  }).then(function () {
    return new _es6Promises2['default'](function (t) {
      return isMonitoring ? t() : (isMonitoring = !0, _noble2['default'].on('discover', function (t) {
        var r = t.advertisement;

        if (r.localName) {
          var n = r.localName.replace(new RegExp('\u0000', 'g'), ''),
              i = peripheralsIn[n];

          if (!i) {
            var s = n + ':' + t.address + ':' + t.uuid;
            return void (unknown.get(s) || (unknown.set(s, 1), e.log.warn(e._('asakusa_giken.errors.unknown-peripheral', {
              categoryName: n,
              peripheralAddress: t.address,
              peripheralUuid: t.uuid
            }))));
          }

          var a = t.address,
              o = null,
              u = null;

          if ('unknown' === a && (o = t.uuid, u = i[o], !u || 0 === u.length)) {
            var s = n + ':' + o;
            return void (unknown.get(s) || (unknown.set(s, 1), e.log.warn(e._('asakusa_giken.errors.unknown-uuid', {
              categoryName: n,
              peripheralUuid: o
            }))));
          }

          if (!o && (a.indexOf('-') >= 0 && (a = a.replace(new RegExp('-', 'g'), ':')), u = i[a], !u || 0 === u.length)) {
            var s = n + ':' + a;
            return void (unknown.get(s) || (unknown.set(s, 1), e.log.warn(e._('asakusa_giken.errors.unknown-address', {
              categoryName: n,
              peripheralAddress: a
            }))));
          }

          var c = !1;
          u = u.filter(function (n) {
            var i = e.nodes.getNode(n.id);
            if (!i) return c = !0, !1;
            var s = n.parse(r.manufacturerData);
            return s.tstamp = Date.now(), s.rssi = t.rssi, s.address = a, o && (s.uuid = o), n.useString && (s = JSON.stringify(s)), i.send({
              payload: s
            }), !0;
          }), c && (i[o] = u, 'unknown' !== a && (i[a] = u));
        }
      }), t(), void e.log.info(e._('asakusa_giken.message.setup-done')));
    });
  });
}

Object.defineProperty(exports, '__esModule', {
  value: !0
}), exports.registerIn = registerIn, exports.stop = stop, exports.start = start;

var _noble = require('noble'),
    _noble2 = _interopRequireDefault(_noble),
    _es6Promises = require('es6-promises'),
    _es6Promises2 = _interopRequireDefault(_es6Promises),
    _lruCache = require('lru-cache'),
    _lruCache2 = _interopRequireDefault(_lruCache),
    peripheralsIn = {},
    isScanning = !1,
    isMonitoring = !1,
    unknown = (0, _lruCache2['default'])({
  max: 100,
  maxAge: 3600000
});

/**
 * Associate the given in-Node object with the BLE module.
 * @param n the in-Node object to be registered as a BLE node
 * @param categoryName the category name
 * @param address the ble address delimited by '-'
 * @param uuid the ble identifier (optional)
 * @param parse the parse function
 * @param useString whether or not to use String type rather than JSON object as the payload format
 * @param RED the initialized RED object
 * @return void (sync)
 */

/**
 * Stop the BLE module immediately.
 * @param RED the initialized RED object
 * @return void (sync)
 */

/**
 * Start the BLE module.
 * @param RED the initialized RED object
 * @return Promise
 */

// Remove a NULL terminator

// look up a category by the category name

// check if the peripheral.address matches

// send the ble node a payload if the address exists
//# sourceMappingURL=ble.js.map
