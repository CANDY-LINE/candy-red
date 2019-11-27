'use strict';
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
/**
 * @license
 * Copyright (c) 2019 CANDY LINE INC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { http, https } from 'follow-redirects';
import urllib from 'url';
import mustache from 'mustache';
import querystring from 'querystring';

export default function(RED) {
  function HTTPRequest(n) {
    RED.nodes.createNode(this, n);
    this.path = n.path;
    let isTemplatedPath = (this.path || '').indexOf('{{') !== -1;
    let nodeMethod = n.method || 'GET';
    this.ret = n.ret || 'obj';
    this.status({});
    let node = this;

    node.account = n.account;
    node.accountConfig = RED.nodes.getNode(node.account);

    let prox, noprox;
    ['http_proxy', 'HTTP_PROXY'].forEach(k => {
      if (process.env[k]) {
        prox = process.env[k];
      }
    });
    ['no_proxy', 'NO_PROXY'].forEach(k => {
      if (process.env[k]) {
        noprox = process.env[k].split(',');
      }
    });

    this.on('input', msg => {
      let preRequestTimestamp = process.hrtime();
      node.status({
        fill: 'blue',
        shape: 'dot',
        text: 'candy-egg-httpreq.status.requesting'
      });
      let conf = node.accountConfig;
      let url = (conf.secure ? 'https' : 'http') + '://';
      let accountId = conf.accountFqn.split('@');
      url += accountId[1] + '/' + accountId[0] + '/api';

      let path = msg.path || node.path;
      if (msg.path && node.path && msg.path !== node.path) {
        // warn if override option not set
        node.warn(RED._('common.errors.nooverride'));
      }
      if (path && path.length > 0 && path.charAt(0) !== '/') {
        url += '/';
      }
      if (path) {
        if (isTemplatedPath) {
          path = mustache.render(path, msg);
        }
        url += path;
      }

      let method = nodeMethod.toUpperCase() || 'GET';
      if (msg.method && n.method && n.method !== 'use') {
        // warn if override option not set
        node.warn(RED._('common.errors.nooverride'));
        method = msg.method.toUpperCase(); // use the msg parameter
      }
      let opts = urllib.parse(url);
      opts.method = method;
      opts.headers = {};
      if (msg.headers) {
        for (const v in msg.headers) {
          if (Object.prototype.hasOwnProperty.call(msg.headers, v)) {
            let name = v.toLowerCase();
            if (name !== 'content-type' && name !== 'content-length') {
              // only normalise the known headers used later in this
              // function. Otherwise leave them alone.
              name = v;
            }
            opts.headers[name] = msg.headers[v];
          }
        }
      }
      opts.auth = conf.loginUser + ':' + conf.loginPassword;

      let payload = null;
      if (
        msg.payload &&
        (method === 'POST' || method === 'PUT' || method === 'PATCH')
      ) {
        if (typeof msg.payload === 'string' || Buffer.isBuffer(msg.payload)) {
          payload = msg.payload;
        } else if (typeof msg.payload === 'number') {
          payload = msg.payload + '';
        } else {
          if (
            opts.headers['content-type'] === 'application/x-www-form-urlencoded'
          ) {
            payload = querystring.stringify(msg.payload);
          } else {
            payload = JSON.stringify(msg.payload);
            if (opts.headers['content-type'] === null) {
              opts.headers['content-type'] = 'application/json';
            }
          }
        }
        if (opts.headers['content-length'] === null) {
          if (Buffer.isBuffer(payload)) {
            opts.headers['content-length'] = payload.length;
          } else {
            opts.headers['content-length'] = Buffer.byteLength(payload);
          }
        }
      }
      let urltotest = url;
      let noproxy;
      if (noprox) {
        for (let i in noprox) {
          if (url.indexOf(noprox[i]) !== -1) {
            noproxy = true;
          }
        }
      }
      if (prox && !noproxy) {
        let match = prox.match(/^(http:\/\/)?(.+)?:([0-9]+)?/i);
        if (match) {
          //opts.protocol = 'http:';
          //opts.host = opts.hostname = match[2];
          //opts.port = (match[3] !== null ? match[3] : 80);
          opts.headers.Host = opts.host;
          let heads = opts.headers;
          let path = (opts.pathname = opts.href);
          opts = urllib.parse(prox);
          opts.path = opts.pathname = path;
          opts.headers = heads;
          opts.method = method;
          //console.log(opts);
          urltotest = match[0];
        } else {
          node.warn('Bad proxy url: ' + prox);
        }
      }
      let req = (/^https/.test(urltotest) ? https : http).request(opts, res => {
        if (node.ret === 'bin') {
          res.setEncoding('binary');
        } else {
          res.setEncoding('utf8');
        }
        msg.statusCode = res.statusCode;
        msg.headers = res.headers;
        msg.payload = '';
        // msg.url = url;   // revert when warning above finally removed
        res.on('data', chunk => {
          msg.payload += chunk;
        });
        res.on('end', () => {
          if (node.metric()) {
            // Calculate request time
            let diff = process.hrtime(preRequestTimestamp);
            let ms = diff[0] * 1e3 + diff[1] * 1e-6;
            let metricRequestDurationMillis = ms.toFixed(3);
            node.metric('duration.millis', msg, metricRequestDurationMillis);
            if (res.client && res.client.bytesRead) {
              node.metric('size.bytes', msg, res.client.bytesRead);
            }
          }
          if (node.ret === 'bin') {
            msg.payload = Buffer.from(msg.payload, 'binary');
          } else if (node.ret === 'obj') {
            try {
              msg.payload = JSON.parse(msg.payload);
            } catch (e) {
              node.warn(RED._('candy-egg-httpreq.errors.json-error'));
            }
          }
          node.send(msg);
          node.status({});
        });
      });
      req.on('error', err => {
        msg.payload = err.toString() + ' : ' + url;
        msg.statusCode = err.code;
        node.send(msg);
        node.status({ fill: 'red', shape: 'ring', text: err.code });
      });
      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  RED.nodes.registerType('CANDY EGG http request', HTTPRequest);
}
