function _interopRequireDefault(e) {
  return e && e.__esModule ? e : {
    'default': e
  };
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
  function t(t) {
    e.nodes.createNode(this, t), this.path = t.path;
    var r = -1 !== (this.path || '').indexOf('{{'),
        n = t.method || 'GET';
    this.ret = t.ret || 'obj';
    var s = this;
    s.account = t.account, s.accountConfig = e.nodes.getNode(s.account);
    var i = undefined,
        a = undefined;
    ['http_proxy', 'HTTP_PROXY'].forEach(function (e) {
      process.env[e] && (i = process.env[e]);
    }), ['no_proxy', 'NO_PROXY'].forEach(function (e) {
      process.env[e] && (a = process.env[e].split(','));
    }), this.on('input', function (o) {
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
      var f = o.path || s.path;
      o.path && s.path && o.path !== s.path && s.warn(e._('common.errors.nooverride')), f && f.length > 0 && '/' !== f.charAt(0) && (d += '/'), f && (r && (f = _mustache2['default'].render(f, o)), d += f);
      var h = n.toUpperCase() || 'GET';
      o.method && t.method && 'use' !== t.method && (s.warn(e._('common.errors.nooverride')), h = o.method.toUpperCase());

      var _ = _url2['default'].parse(d);

      if ((_.method = h, _.headers = {}, o.headers)) for (var p in o.headers) if (o.headers.hasOwnProperty(p)) {
        var v = p.toLowerCase();
        'content-type' !== v && 'content-length' !== v && (v = p), _.headers[v] = o.headers[p];
      }
      _.auth = c.loginUser + ':' + c.loginPassword;
      var m = null;
      !o.payload || 'POST' !== h && 'PUT' !== h && 'PATCH' !== h || ('string' == typeof o.payload || Buffer.isBuffer(o.payload) ? m = o.payload : 'number' == typeof o.payload ? m = o.payload + '' : 'application/x-www-form-urlencoded' === _.headers['content-type'] ? m = _querystring2['default'].stringify(o.payload) : (m = JSON.stringify(o.payload), null === _.headers['content-type'] && (_.headers['content-type'] = 'application/json')), null === _.headers['content-length'] && (Buffer.isBuffer(m) ? _.headers['content-length'] = m.length : _.headers['content-length'] = Buffer.byteLength(m)));
      var g = d,
          y = undefined;
      if (a) for (var w in a) -1 !== d.indexOf(a[w]) && (y = !0);

      if (i && !y) {
        var R = i.match(/undefined/i);

        if (R) {
          _.headers.Host = _.host;
          var C = _.headers,
              S = _.pathname = _.href;
          _ = _url2['default'].parse(i), _.path = _.pathname = S, _.headers = C, _.method = h, g = R[0];
        } else s.warn('Bad proxy url: ' + i);
      }

      var b = (/undefined/.test(g) ? _followRedirects.https : _followRedirects.http).request(_, function (t) {
        'bin' === s.ret ? t.setEncoding('binary') : t.setEncoding('utf8'), o.statusCode = t.statusCode, o.headers = t.headers, o.payload = '', t.on('data', function (e) {
          o.payload += e;
        }), t.on('end', function () {
          if (s.metric()) {
            var r = process.hrtime(u),
                n = 1000 * r[0] + 0.000001 * r[1],
                i = n.toFixed(3);
            s.metric('duration.millis', o, i), t.client && t.client.bytesRead && s.metric('size.bytes', o, t.client.bytesRead);
          }

          if ('bin' === s.ret) o.payload = new Buffer(o.payload, 'binary');else if ('obj' === s.ret) try {
            o.payload = JSON.parse(o.payload);
          } catch (a) {
            s.warn(e._('candy-box-httpreq.errors.json-error'));
          }
          s.send(o), s.status({});
        });
      });
      b.on('error', function (e) {
        o.payload = e.toString() + ' : ' + d, o.statusCode = e.code, s.send(o), s.status({
          fill: 'red',
          shape: 'ring',
          text: e.code
        });
      }), m && b.write(m), b.end();
    });
  }

  e.nodes.registerType('CANDY EGG http request', t, {
    credentials: {
      user: {
        type: 'text'
      },
      password: {
        type: 'password'
      }
    }
  });
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
