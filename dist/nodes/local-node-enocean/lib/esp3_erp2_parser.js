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
    _es6Promises = require('es6-promises'),
    _es6Promises2 = _interopRequireDefault(_es6Promises),
    CRC8_TABLE = [0, 7, 14, 9, 28, 27, 18, 21, 56, 63, 54, 49, 36, 35, 42, 45, 112, 119, 126, 121, 108, 107, 98, 101, 72, 79, 70, 65, 84, 83, 90, 93, 224, 231, 238, 233, 252, 251, 242, 245, 216, 223, 214, 209, 196, 195, 202, 205, 144, 151, 158, 153, 140, 139, 130, 133, 168, 175, 166, 161, 180, 179, 186, 189, 199, 192, 201, 206, 219, 220, 213, 210, 255, 248, 241, 246, 227, 228, 237, 234, 183, 176, 185, 190, 171, 172, 165, 162, 143, 136, 129, 134, 147, 148, 157, 154, 39, 32, 41, 46, 59, 60, 53, 50, 31, 24, 17, 22, 3, 4, 13, 10, 87, 80, 89, 94, 75, 76, 69, 66, 111, 104, 97, 102, 115, 116, 125, 122, 137, 142, 135, 128, 149, 146, 155, 156, 177, 182, 191, 184, 173, 170, 163, 164, 249, 254, 247, 240, 229, 226, 235, 236, 193, 198, 207, 200, 221, 218, 211, 212, 105, 110, 103, 96, 117, 114, 123, 124, 81, 86, 95, 88, 77, 74, 67, 68, 25, 30, 23, 16, 5, 2, 11, 12, 33, 38, 47, 40, 61, 58, 51, 52, 78, 73, 64, 71, 82, 85, 92, 91, 118, 113, 120, 127, 106, 109, 100, 99, 62, 57, 48, 55, 34, 37, 44, 43, 6, 1, 8, 15, 26, 29, 20, 19, 174, 169, 160, 167, 178, 181, 188, 187, 150, 145, 152, 159, 138, 141, 132, 131, 222, 217, 208, 215, 194, 197, 204, 203, 230, 225, 232, 239, 250, 253, 244, 243],
    LONG_DATA_ID_IDX = [[3, 0], [4, 0], [4, 4], [6, 0]],
    TELEGRAM_TYPES = {
  0: ['RPS', 246],
  1: ['1BS', 213],
  2: ['4BS', 165],
  3: ['Smart Acknowledge Signal', 208],
  4: ['VDL', 210],
  5: ['Universal Teach-In EEP', 212],
  6: ['MSC', 209],
  7: ['SEC', 48],
  8: ['SEC_ENCAPS', 49],
  9: ['Secure Teach-In telegram for switch', 53],
  10: ['Generic Profiles selective data', 179],
  11: ['reserved'],
  12: ['reserved'],
  13: ['reserved'],
  14: ['reserved'],
  15: ['Extended Telegram type available']
};

Uint8Array.prototype.slice || (Uint8Array.prototype.slice = Array.prototype.slice);

var Utils = (function () {
  function e() {
    _classCallCheck(this, e);
  }

  return _createClass(e, null, [{
    key: 'pad',
    value: function (e, t, r) {
      return r = r || '0', e += '', e.length >= t ? e : new Array(t - e.length + 1).join(r) + e;
    }
  }, {
    key: 'crc8',
    value: function (e, t) {
      return CRC8_TABLE[e ^ t];
    }
  }]), e;
})(),
    ERP2Parser = (function () {
  function e() {
    _classCallCheck(this, e);
  }

  return _createClass(e, [{
    key: 'parse',
    value: function (t) {
      var r = undefined,
          n = undefined,
          o = undefined,
          s = undefined;
      if ('object' == typeof t && t.payload && e.isArray(t.payload)) n = t.payload, s = t;else if ('string' == typeof t) n = new Uint8Array(new Buffer(t, 'hex'));else if (e.isArray(t)) n = t;else {
        if (!(t instanceof Buffer)) throw new Error('Unsupported ERP2 payload data type!');
        n = new Uint8Array(t);
      }
      return r = n.length, o = 6 >= r ? this._doParseShort(r, n, s) : this._doParseLong(r, n, s);
    }
  }, {
    key: '_doParseShort',
    value: function (e, t, r) {
      return new _es6Promises2['default'](function (n, o) {
        try {
          var s = undefined,
              i = {
            len: e,
            payload: t,
            originatorId: ''
          },
              a = e - 1,
              u = 1;

          for (1 === e ? (i.originatorId = Utils.pad(t[0].toString(16), 2), u = 0) : e >= 6 && (a = 4, u = 2), s = 0; a > s; s++) i.originatorId += Utils.pad(t[s].toString(16), 2);

          for (s = 0; u > s; s++) i.dataDl += Utils.pad(t[s + a].toString(16), 2);

          r && (i.container = r), n(i);
        } catch (c) {
          o(c);
        }
      });
    }
  }, {
    key: '_doParseLong',
    value: function (e, t, r) {
      return new _es6Promises2['default'](function (n, o) {
        try {
          var s = t[0] >> 5;
          if (!LONG_DATA_ID_IDX[s]) throw new Error('Reserved address is unsupported');
          var i = undefined,
              a = {
            len: e,
            payload: t,
            originatorId: '',
            destinationId: ''
          },
              u = LONG_DATA_ID_IDX[s][0],
              c = LONG_DATA_ID_IDX[s][1];

          for (i = 0; u > i; i++) a.originatorId += Utils.pad(t[i + 1].toString(16), 2);

          for (i = 0; c > i; i++) a.destinationId += Utils.pad(t[i + u + 1].toString(16), 2);

          var l = (16 & t[0]) >> 4;
          if (l > 0) throw new Error('Extended header is unsuported');
          var d = 15 & t[0];
          if (15 === d) throw new Error('Extended Telegram type is unsuported');
          a.telegramType = TELEGRAM_TYPES[d][0], a.rorg = TELEGRAM_TYPES[d][1], a.dataDl = t.slice(u + c + 1, t.length - 1);
          var f = 0;

          for (i = 0; i < t.length - 1; i++) f = Utils.crc8(f, t[i]);

          if (f !== t[t.length - 1]) throw new Error('CRC8 checksum failure');
          r && (a.container = r), n(a);
        } catch (h) {
          o(h);
        }
      });
    }
  }], [{
    key: 'isArray',
    value: function (e) {
      return e instanceof Array || e instanceof Uint8Array;
    }
  }]), e;
})();

exports.ERP2Parser = ERP2Parser;

var ESP3RadioERP2Parser = (function () {
  function e() {
    _classCallCheck(this, e);
  }

  return _createClass(e, [{
    key: 'parse',
    value: function (e) {
      var t = undefined,
          r = undefined;
      if ('string' == typeof e) r = new Uint8Array(new Buffer(e, 'hex'));else if (e instanceof Array) r = e;else {
        if (!(e instanceof Buffer)) throw new Error('Unsupported ESP3 payload data type!');
        r = new Uint8Array(e);
      }
      return t = r.length, new _es6Promises2['default'](function (e, n) {
        try {
          if (85 !== r[0]) throw new Error('Unknown Synchronization-word');
          if (10 !== r[4]) throw new Error('Invalid packet type, RADIO_ERP2(0x0a) is expected');
          if (2 !== r[3]) throw new Error('Invalid optinal size');
          var o = 0,
              s = undefined,
              i = r.slice(1, 5);

          for (s = 0; s < i.length; s++) o = Utils.crc8(o, i[s]);

          if (o !== r[5]) throw new Error('CRC8 for header value checksum failure');
          var a = {
            len: t
          },
              u = 256 * r[1] + r[2];

          for (a.payload = r.slice(6, 6 + u), a.subTelNum = r[6 + u], a.dBm = r[7 + u], o = 0, s = 0; u + 2 > s; s++) o = Utils.crc8(o, r[s + 6]);

          if (o !== r[r.length - 1]) throw new Error('CRC8 for data value checksum failure');
          e(a);
        } catch (c) {
          n(c);
        }
      });
    }
  }]), e;
})();

exports.ESP3RadioERP2Parser = ESP3RadioERP2Parser;

/*jshint bitwise: false*/

// EnOcean Radio Protocol 2 SPECIFICATION V1.0 September 26, 2013

// Bit 5...7 Address Control

// Bit4 Extended header available

// Bit 0...3 Telegram type (R-ORG)

// Compute CRC8 with DATA_PL except CRC

// EnOcean Serial Protocol 3 (ESP3) V1.27 / July 30, 2014
//# sourceMappingURL=esp3_erp2_parser.js.map
