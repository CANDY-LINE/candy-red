function _interopRequireWildcard(e) {
  if (e && e.__esModule) return e;
  var t = {};
  if (null != e) for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && (t[r] = e[r]);
  return t['default'] = e, t;
}

function _classCallCheck(e, t) {
  if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function');
}

Object.defineProperty(exports, '__esModule', {
  value: !0
});

var _libBlecast_bl = require('./lib/blecast_bl'),
    blecastBl = _interopRequireWildcard(_libBlecast_bl),
    _libBlecast_tm = require('./lib/blecast_tm'),
    blecastTm = _interopRequireWildcard(_libBlecast_tm),
    _libBle = require('./lib/ble'),
    ble = _interopRequireWildcard(_libBle);

exports['default'] = function (e) {
  var t = ble.start(e).then(function () {
    var t = function s(t) {
      _classCallCheck(this, s), e.nodes.createNode(this, t), this.address = t.address, this.uuid = t.uuid;
    };

    e.nodes.registerType('BLECAST_BL', t);

    var r = function o(t) {
      _classCallCheck(this, o), e.nodes.createNode(this, t), this.useString = t.useString, this.blecastBlNodeId = t.blecastBl, this.blecastBlNode = e.nodes.getNode(this.blecastBlNodeId), ble.registerIn(this, 'BLECAST_BL', this.blecastBlNode.address, this.blecastBlNode.uuid, blecastBl.parse, this.useString, e), this.name = t.name;
    };

    e.nodes.registerType('BLECAST_BL in', r);

    var n = function a(t) {
      _classCallCheck(this, a), e.nodes.createNode(this, t), this.address = t.address, this.uuid = t.uuid;
    };

    e.nodes.registerType('BLECAST_TM', n);

    var i = function u(t) {
      _classCallCheck(this, u), e.nodes.createNode(this, t), this.useString = t.useString, this.blecastTmNodeId = t.blecastTm, this.blecastTmNode = e.nodes.getNode(this.blecastTmNodeId), ble.registerIn(this, 'BLECAST_TM', this.blecastTmNode.address, this.blecastTmNode.uuid, blecastTm.parse, this.useString, e), this.name = t.name;
    };

    e.nodes.registerType('BLECAST_TM in', i);
  });
  return e.debug ? t : void t['catch'](function (t) {
    e.log.error(e._('blecast_bl.errors.unknown', {
      error: t
    }));
  });
}, module.exports = exports['default'];

/*
 * BLECAST_BL (BLE with Illuminance Sensor) node
 * BLECAST_TM (BLE with Temeprature Sensor) node
 */

// Should not return anything except for test
// since Node-RED tries to manipulate the return value unless it's null/undefined
// and TypeError will be raised in the end.
//# sourceMappingURL=asakusa_giken.js.map
