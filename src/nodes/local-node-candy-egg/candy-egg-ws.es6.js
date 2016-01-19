'use strict';

import WebSocket from 'ws';
import urllib from 'url';

export default function(RED) {
  
  class WebSocketListener {
    constructor(accountConfig, account, path, webSocketListeners, options) {
      this.accountConfig = accountConfig;
      this.account = account;
      this.path = path;
      this.webSocketListeners = webSocketListeners;
      this.server = null; // socket for server connection

      this._inputNodes = [];  // collection of thats that want to receive events
      this._outputNodes = []; // node status event listeners
      this.closing = false;
      this.options = options || {};
      this.redirect = 0;
      this.authRetry = 0;
      this.startconn(); // start outbound connection
    }

    startconn(url) {  // Connect to remote endpoint
      let conf = this.accountConfig;
      let prefix = 'ws' + (conf.secure ? 's' : '') + '://';
      prefix += conf.loginUser + ':' + conf.loginPassword + '@';
      let accountId = conf.accountFqn.split('@');
      prefix += accountId[1];
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
        prefix += '/' + accountId[0] + '/api';
      }
      
      if (path && path.length > 0 && path.charAt(0) !== '/') {
        prefix += '/';
      }
      if (path) {
        prefix += path;
      }
      let socket = new WebSocket(prefix, this.options);
      this.server = socket; // keep for closing
      this.handleConnection(socket);
    }

    handleConnection(/*socket*/socket) {
      let id = (1+Math.random()*4294967295).toString(16);
      socket.on('open', () => {
        this.emit2all('opened');
        this.redirect = 0;
        this.authRetry = 0;
        socket.skipCloseEventHandler = false;
      });
      socket.on('close', () => {
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
      socket.on('unexpected-response', (req, res) => {
        this.emit2all('erro');
        req.abort();
        res.socket.end();
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          if (res.headers.location) {
            if (this.redirect > 3) {
              this.redirect = 0;
              RED.log.error(RED._('candy-egg-ws.errors.too-many-redirects', { path: this.path, location: res.headers.location }));
            } else {
              ++this.redirect;
              return this.startconn(res.headers.location);
            }
          }
        } else if (res.statusCode === 404) {
          RED.log.error(RED._('candy-egg-ws.errors.wrong-path', { path: this.path }));
        } else if (res.statusCode === 401) {
          RED.log.error(RED._('candy-egg-ws.errors.auth-error', { path: this.path, user: this.accountConfig.loginUser }));
          ++this.authRetry;
          if (this.authRetry > 10) {
            return; // never retry
          }
          RED.log.info(RED._('candy-egg-ws.status.auth-retry'));
        } else {
          RED.log.error(RED._('candy-egg-ws.errors.server-error', { path: this.path, status: res.statusCode }));
        }
        // try to reconnect every approx. 1 min
        socket.skipCloseEventHandler = true;
        socket.close();
        this.tout = setTimeout(() => { this.startconn(); }, 55000 + Math.random() * 10000);
        this.redirect = 0;
      });
      socket.on('error', err => {
        this.emit2all('erro');
        RED.log.error(RED._('candy-egg-ws.errors.connect-error', { err: err, accountFqn: this.accountConfig.accountFqn}));
        socket.close(); // retry will be performed on the above 'close' event handler
        socket.skipCloseEventHandler = true;
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

    handleEvent(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags) {
      let msg, wholemsg;
      try {
        wholemsg = JSON.parse(data);
      }
      catch(err) {
        wholemsg = { payload:data };
      }
      msg = {
        payload: data,
        _session: {type:'candy-egg-ws',id:id}
      };
      wholemsg._session = msg._session;
      for (let i = 0; i < this._inputNodes.length; i++) {
        if (this._inputNodes[i].wholemsg) {
          this._inputNodes[i].send(wholemsg);
        } else {
          this._inputNodes[i].send(msg);
        }
      }
      RED.log.debug('flags:' + flags);
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
      } catch(e) { // swallow any errors
        RED.log.warn(e.stack);
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
      this.accountFqn = n.accountFqn;
      this.loginUser = n.loginUser;
      this.loginPassword = n.loginPassword;
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
  RED.nodes.registerType('CANDY EGG account', CANDYEggAccountNode);

  class WebSocketInNode {
    constructor(n) {
      RED.nodes.createNode(this, n);

      let that = this;
      that.account = n.account;
      that.accountConfig = RED.nodes.getNode(that.account);
      that.path = n.path;
      that.wholemsg = n.wholemsg;

      if (that.accountConfig) {
        that.listenerConfig = webSocketListeners.get(that);
        that.listenerConfig.registerInputNode(that);
        that.on('opened', () => { that.status({fill:'green',shape:'dot',text:'candy-egg-ws.status.connected'}); });
        that.on('erro',  () => { that.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.error'}); });
        that.on('closed',  () => { that.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.disconnected'}); });
      } else {
        that.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

      that.on('close', () => {
        that.listenerConfig.removeInputNode(that);
      });
    }
  }
  RED.nodes.registerType('CANDY EGG websocket in', WebSocketInNode);

  class WebSocketOutNode {
    constructor(n) {
      RED.nodes.createNode(this, n);

      let that = this;
      that.account = n.account;
      that.accountConfig = RED.nodes.getNode(that.account);
      that.path = n.path;
      that.wholemsg = n.wholemsg;

      if (that.accountConfig) {
        that.listenerConfig = webSocketListeners.get(that);
        that.listenerConfig.registerOutputNode(that);
        that.on('opened', () => { that.status({fill:'green',shape:'dot',text:'candy-egg-ws.status.connected'}); });
        that.on('erro',  () => { that.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.error'}); });
        that.on('closed',  () => { that.status({fill:'red',shape:'ring',text:'candy-egg-ws.status.disconnected'}); });
      } else {
        that.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

      that.on('close', () => {
        that.listenerConfig.removeOutputNode(that);
      });

      that.on('input', msg => {
        let payload;
        if (that.wholemsg) {
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
          that.listenerConfig.broadcast(payload);
        }
      });
    }
  }
  RED.nodes.registerType('CANDY EGG websocket out',WebSocketOutNode);
}
