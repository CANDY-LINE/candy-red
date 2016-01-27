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

var _followRedirects = require('follow-redirects'),
    _url = require('url'),
    _url2 = _interopRequireDefault(_url),
    _mustache = require('mustache'),
    _mustache2 = _interopRequireDefault(_mustache),
    _querystring = require('querystring'),
    _querystring2 = _interopRequireDefault(_querystring);

exports['default'] = function (e) {
  var t = function r(t) {
    _classCallCheck(this, r), e.nodes.createNode(this, t), this.path = t.path;
    var n = -1 !== (this.path || '').indexOf('{{'),
        i = t.method || 'GET';
    this.ret = t.ret || 'obj';
    var s = this;
    s.account = t.account, s.accountConfig = e.nodes.getNode(s.account);
    var a = undefined,
        o = undefined;
    ['http_proxy', 'HTTP_PROXY'].forEach(function (e) {
      process.env[e] && (a = process.env[e]);
    }), ['no_proxy', 'NO_PROXY'].forEach(function (e) {
      process.env[e] && (o = process.env[e].split(','));
    }), this.on('input', function (r) {
      var u = process.hrtime();
      s.status({
        fill: 'blue',
        shape: 'dot',
        text: 'candy-box-httpreq.status.requesting'
      });
      var c = s.accountConfig,
          d = (c.secure ? 'https' : 'http') + '://',
          l = c.accountFqn.split('@');
      d += l[1] + '/' + l[0] + '/api';
      var f = r.path || s.path;
      r.path && s.path && r.path !== s.path && s.warn(e._('common.errors.nooverride')), f && f.length > 0 && '/' !== f.charAt(0) && (d += '/'), f && (n && (f = _mustache2['default'].render(f, r)), d += f);
      var h = i.toUpperCase() || 'GET';
      r.method && t.method && 'use' !== t.method && (s.warn(e._('common.errors.nooverride')), h = r.method.toUpperCase());

      var _ = _url2['default'].parse(d);

      if ((_.method = h, _.headers = {}, r.headers)) for (var p in r.headers) if (r.headers.hasOwnProperty(p)) {
        var v = p.toLowerCase();
        'content-type' !== v && 'content-length' !== v && (v = p), _.headers[v] = r.headers[p];
      }
      _.auth = c.loginUser + ':' + c.loginPassword;
      var m = null;
      !r.payload || 'POST' !== h && 'PUT' !== h && 'PATCH' !== h || ('string' == typeof r.payload || Buffer.isBuffer(r.payload) ? m = r.payload : 'number' == typeof r.payload ? m = r.payload + '' : 'application/x-www-form-urlencoded' === _.headers['content-type'] ? m = _querystring2['default'].stringify(r.payload) : (m = JSON.stringify(r.payload), null === _.headers['content-type'] && (_.headers['content-type'] = 'application/json')), null === _.headers['content-length'] && (Buffer.isBuffer(m) ? _.headers['content-length'] = m.length : _.headers['content-length'] = Buffer.byteLength(m)));
      var g = d,
          y = undefined;
      if (o) for (var w in o) -1 !== d.indexOf(o[w]) && (y = !0);

      if (a && !y) {
        var R = a.match(/undefined/i);

        if (R) {
          _.headers.Host = _.host;
          var C = _.headers,
              S = _.pathname = _.href;
          _ = _url2['default'].parse(a), _.path = _.pathname = S, _.headers = C, _.method = h, g = R[0];
        } else s.warn('Bad proxy url: ' + a);
      }

      var b = (/undefined/.test(g) ? _followRedirects.https : _followRedirects.http).request(_, function (t) {
        'bin' === s.ret ? t.setEncoding('binary') : t.setEncoding('utf8'), r.statusCode = t.statusCode, r.headers = t.headers, r.payload = '', t.on('data', function (e) {
          r.payload += e;
        }), t.on('end', function () {
          if (s.metric()) {
            var n = process.hrtime(u),
                i = 1000 * n[0] + 0.000001 * n[1],
                a = i.toFixed(3);
            s.metric('duration.millis', r, a), t.client && t.client.bytesRead && s.metric('size.bytes', r, t.client.bytesRead);
          }

          if ('bin' === s.ret) r.payload = new Buffer(r.payload, 'binary');else if ('obj' === s.ret) try {
            r.payload = JSON.parse(r.payload);
          } catch (o) {
            s.warn(e._('candy-box-httpreq.errors.json-error'));
          }
          s.send(r), s.status({});
        });
      });
      b.on('error', function (e) {
        r.payload = e.toString() + ' : ' + d, r.statusCode = e.code, s.send(r), s.status({
          fill: 'red',
          shape: 'ring',
          text: e.code
        });
      }), m && b.write(m), b.end();
    });
  };

  e.nodes.registerType('CANDY EGG http request', t);
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

// warn if override option not set
// warn if override option not set
// use the msg parameter

// only normalise the known headers used later in this
// function. Otherwise leave them alone.

//opts.protocol = 'http:';
//opts.host = opts.hostname = match[2];
//opts.port = (match[3] !== null ? match[3] : 80);

//console.log(opts);

// msg.url = url;   // revert when warning above finally removed

// Calculate request time
//# sourceMappingURL=candy-egg-httpreq.js.map
