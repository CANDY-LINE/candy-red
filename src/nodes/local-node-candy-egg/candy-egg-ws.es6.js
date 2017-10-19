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

import WebSocket from 'ws';
import urllib from 'url';

const TEST_SERVER_PING_TIMEOUT = false;

export default function(RED) {

  class WebSocketListener {
    constructor(accountConfig, account, path, webSocketListeners, options) {
      this.accountConfig = accountConfig;
      this.account = account;
      this.path = path;
      this.webSocketListeners = webSocketListeners;
      this.server = null; // socket for server connection

      this._inputNodes = [];  // collection of input nodes want to receive events
      this._outputNodes = []; // node status event listeners
      this.closing = false;
      this.options = options || {};
      this.redirect = 0;
      this.authRetry = 0;
      this.connected = false;
      this.startconn(); // start outbound connection
    }

    startconn(url) {  // Connect to remote endpoint
      if (this.connected) {
        return;
      }
      let conf = this.accountConfig;
      let prefix = 'ws' + (conf.secure ? 's' : '') + '://';
      prefix += encodeURIComponent(conf.loginUser) + ':' + encodeURIComponent(conf.loginPassword) + '@';
      let accountId = conf.accountFqn.split('@');
      let port = accountId[1].split(':');
      prefix += encodeURIComponent(port[0]);
      if (port[1]) {
        prefix += `:${port[1]}`;
      }
      let path = this.path;
      if (url) {
        let urlobj = urllib.parse(url);
        if (!urlobj.host) {
          path = urlobj.href;
        } else {
          prefix = urlobj.href;
          path = null;
        }
      } else {
        prefix += '/' + encodeURIComponent(accountId[0]) + '/api';
      }

      if (path && path.length > 0 && path.charAt(0) !== '/') {
        prefix += '/';
      }
      if (path) {
        prefix += path;
      }
      if (this.server) {
        this.server.close();
      }
      let socket = new WebSocket(prefix, this.options);
      this.server = socket; // keep for closing
      this.handleConnection(socket);
    }

    handleConnection(/*socket*/socket) {
      let id = (1+Math.random()*4294967295).toString(16);
      socket.on('open', () => {
        this.connected = true;
        this.emit2all('opened');
        this.redirect = 0;
        this.authRetry = 0;
        socket.skipCloseEventHandler = false;
      });
      socket.on('close', () => {
        this.connected = false;
        if (socket.skipCloseEventHandler) {
          return;
        }
        this.emit2all('closed');
        if (!this.closing) {
          // try to reconnect every 3+ secs
          this.tout = setTimeout(() => { this.startconn(); }, 3000 + Math.random() * 1000);
        }
      });
      socket.on('message', (data,flags) => {
        this.handleEvent(id,socket,'message',data,flags);
      });
      if (TEST_SERVER_PING_TIMEOUT) {
        socket.removeAllListeners('ping');
      }
      socket.on('ping', (data,flags) => {
        this.emit2all('ping', data, flags);
      });
      socket.on('unexpected-response', (req, res) => {
        this.emit2all('erro', req, res);
        req.abort();
        res.socket.end();
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          if (res.headers.location) {
            if (this.redirect > 3) {
              this.redirect = 0;
              this.emit2all('log-error', RED._('candy-egg-ws.errors.too-many-redirects', { path: this.path, location: res.headers.location }));
            } else {
              ++this.redirect;
              return this.startconn(res.headers.location);
            }
          }
        } else if (res.statusCode === 404) {
          this.emit2all('log-error', RED._('candy-egg-ws.errors.wrong-path', { path: this.path }));
        } else if (res.statusCode === 401) {
          this.emit2all('log-error', RED._('candy-egg-ws.errors.auth-error', { path: this.path, user: this.accountConfig.loginUser }));
          ++this.authRetry;
          if (this.authRetry > 10) {
            return; // never retry
          }
          this.emit2all('log-info', RED._('candy-egg-ws.status.auth-retry'));
        } else {
          this.emit2all('log-error', RED._('candy-egg-ws.errors.server-error', { path: this.path, status: res.statusCode }));
        }
        // try to reconnect every approx. 1 min
        socket.skipCloseEventHandler = true;
        socket.close();
        this.tout = setTimeout(() => { this.startconn(); }, 55000 + Math.random() * 10000);
        this.redirect = 0;
      });
      socket.on('error', err => {
        this.emit2all('erro', err);
        this.emit2all('log-error', RED._('candy-egg-ws.errors.connect-error', { err: err, accountFqn: this.accountConfig.accountFqn}));
        socket.skipCloseEventHandler = true;
        socket.close();
        if (!this.closing) {
          // try to reconnect every 3+ secs
          this.tout = setTimeout(() => { this.startconn(); }, 3000 + Math.random() * 1000);
        }
      });
    }

    registerOutputNode(/*Node*/handler) {
      this._outputNodes.push(handler);
    }

    removeOutputNode(/*Node*/handler) {
      this._outputNodes.forEach((node, i, outputNodes) => {
        if (node === handler) {
          outputNodes.splice(i, 1);
        }
      });
      if (this._inputNodes.length === 0 && this._outputNodes.length === 0) {
        this.close();
      }
    }

    registerInputNode(/*Node*/handler) {
      this._inputNodes.push(handler);
    }

    removeInputNode(/*Node*/handler) {
      this._inputNodes.forEach((node, i, inputNodes) => {
        if (node === handler) {
          inputNodes.splice(i, 1);
        }
      });
      if (this._inputNodes.length === 0 && this._outputNodes.length === 0) {
        this.close();
      }
    }

    _deserialize(data) {
      return JSON.parse(data, (k, v) => {
        if (v && typeof(v) === 'object' && Array.isArray(v.data) && v.type === 'Buffer') {
          return Buffer.from(v.data);
        }
        return v;
      });
    }

    handleEvent(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags) {
      let msg, wholemsg, obj;
      try {
        obj = this._deserialize(data);
      } catch(err) {
        obj = data;
      }
      msg = {
        payload: obj,
        _session: {type:'candy-egg-ws',id:id}
      };
      for (let i = 0; i < this._inputNodes.length; i++) {
        if (this._inputNodes[i].wholemsg) {
          if (!wholemsg) {
            try {
              wholemsg = this._deserialize(data);
            } catch(err) {
              wholemsg = { payload:data };
            }
            if (typeof(wholemsg) === 'object') {
              wholemsg._session = msg._session;
            }
          }
          this._inputNodes[i].send(wholemsg);
        } else {
          this._inputNodes[i].send(msg);
        }
      }
    }

    emit2all(...args) {
      for (let i = 0; i < this._inputNodes.length; i++) {
        let thisArg = this._inputNodes[i];
        thisArg.emit.apply(thisArg, args);
      }
      for (let i = 0; i < this._outputNodes.length; i++) {
        let thisArg = this._outputNodes[i];
        thisArg.emit.apply(thisArg, args);
      }
    }

    close() {
      this.closing = true;
      this.server.close();
      if (this.tout) { clearTimeout(this.tout); }
      this.webSocketListeners.remove(this);
    }

    broadcast(data) {
      try {
        if ((typeof(data) === 'object') && !(data instanceof Buffer)) {
          data = JSON.stringify(data);
        }
        this.server.send(data);
        return true;
      } catch (err) {
        this.emit2all('log-error', RED._('candy-egg-ws.errors.send-error', { err: err, accountFqn: this.accountConfig.accountFqn}));
        return false;
      }
    }
  }

  class WebSocketListeners {
    constructor() {
      this.store = {};
    }

    get(node, options=null) {
      if (!node.accountConfig) {
        throw new Error(RED._('candy-egg-ws.errors.missing-conf'));
      }
      let key = node.account + ':' + node.path;
      let listener = this.store[key];
      if (!listener) {
        listener = new WebSocketListener(node.accountConfig, node.account, node.path, this, options);
        this.store[key] = listener;
      }
      return listener;
    }

    remove(listener) {
      let key = listener.account + ':' + listener.path;
      delete this.store[key];
    }

    reset(nodeId) {
      let prefix = nodeId + ':';
      let keys = [];
      for (let key in this.store) {
        if (this.store.hasOwnProperty(key) && key.indexOf(prefix) === 0) {
          keys.push(key);
        }
      }
      keys.forEach(key => {
        delete this.store[key];
      });
    }
  }
  let webSocketListeners = new WebSocketListeners();

  class CANDYEggAccountNode {
    constructor(n) {
      RED.nodes.createNode(this,n);
      this.accountFqn = this.credentials ? this.credentials.accountFqn : n.accountFqn;
      this.loginUser = this.credentials ? this.credentials.loginUser : n.loginUser;
      this.loginPassword = this.credentials ? this.credentials.loginPassword : n.loginPassword;
      this.secure = n.secure;
      webSocketListeners.reset(n.id);

      this.managed = n.managed;
      // deploying implicit API clients (candy-ws)
      let deviceManagerStore = RED.settings.deviceManagerStore;
      if (this.managed && deviceManagerStore && deviceManagerStore.isWsClientInitialized) {
        if (!deviceManagerStore.isWsClientInitialized(this.accountFqn)) {
          deviceManagerStore.initWsClient(n.id, this, webSocketListeners);
        }
      }
    }
  }
  RED.nodes.registerType('CANDY EGG account', CANDYEggAccountNode, {
    credentials: {
      accountFqn: {type: 'text'},
      loginUser: {type: 'text'},
      loginPassword: {type: 'password'},
    }
  });

  class WebSocketInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);

      this.account = n.account;
      this.accountConfig = RED.nodes.getNode(this.account);
      this.path = n.path;
      this.wholemsg = (n.wholemsg === 'true');
      this.status({});

      if (this.accountConfig) {
        this.listenerConfig = webSocketListeners.get(this);
        this.listenerConfig.registerInputNode(this);
        this.on('opened', () => { this.status({fill:'green',shape:'dot',text:'candy-egg-ws.status.connected'}); });
        this.on('erro',  () => { this.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.error'}); });
        this.on('closed',  () => { this.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.disconnected'}); });
      } else {
        this.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

      this.on('close', () => {
        if (this.listenerConfig) {
          this.listenerConfig.removeInputNode(this);
        }
      });

      this.on('log-info', (msg) => {
        this.info(msg);
      });
      this.on('log-error', (msg) => {
        this.error(msg);
      });
    }
  }
  RED.nodes.registerType('CANDY EGG websocket in', WebSocketInNode);

  class WebSocketOutNode {
    constructor(n) {
      RED.nodes.createNode(this, n);

      this.account = n.account;
      this.accountConfig = RED.nodes.getNode(this.account);
      this.path = n.path;
      this.wholemsg = (n.wholemsg === 'true');
      this.status({});

      if (this.accountConfig) {
        this.listenerConfig = webSocketListeners.get(this);
        this.listenerConfig.registerOutputNode(this);
        this.on('opened', () => { this.status({fill:'green',shape:'dot',text:'candy-egg-ws.status.connected'}); });
        this.on('erro',  () => { this.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.error'}); });
        this.on('closed',  () => { this.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.disconnected'}); });
      } else {
        this.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

      this.on('close', () => {
        this.listenerConfig.removeOutputNode(this);
      });

      this.on('log-info', (msg) => {
        this.info(msg);
      });
      this.on('log-error', (msg) => {
        this.error(msg);
      });

      this.on('input', msg => {
        let payload;
        if (this.wholemsg) {
          delete msg._session;
          payload = JSON.stringify(msg);
        } else if (msg.hasOwnProperty('payload')) {
          if (!Buffer.isBuffer(msg.payload)) { // if it's not a buffer make sure it's a string.
            payload = RED.util.ensureString(msg.payload);
          }
          else {
            payload = msg.payload;
          }
        }
        if (payload) {
          this.listenerConfig.broadcast(payload);
        }
      });
    }
  }
  RED.nodes.registerType('CANDY EGG websocket out',WebSocketOutNode);
}
