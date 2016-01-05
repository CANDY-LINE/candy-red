'use strict';

import WebSocket from 'ws';
import { inspect } from 'util';

export default function(RED) {
  
  class CANDYEggAccountNode {
    constructor(n) {
      RED.nodes.createNode(this,n);
      this.accountFqn = n.accountFqn;
      this.loginUser = n.loginUser;
      this.loginPassword = n.loginPassword;
      this.secure = n.secure;
    }
  }
  RED.nodes.registerType('CANDY-Egg Account', CANDYEggAccountNode);

  class WebSocketListener {
    constructor(accountConfig, account, path, webSocketListeners) {
      this.accountConfig = accountConfig;
      this.account = account;
      this.path = path;
      this.webSocketListeners = webSocketListeners;

      this._inputNodes = [];  // collection of thats that want to receive events
      this._clients = {};
      this.closing = false;
      this.startconn(); // start outbound connection
    }

    startconn() {  // Connect to remote endpoint
      let conf = this.accountConfig;
      let url = 'ws' + (conf.secure ? 's' : '') + '://';
      url += conf.loginUser + ':' + conf.loginPassword + '@';
      let accountId = conf.accountFqn.split('@');
      url += accountId[1] + '/' + accountId[0] + '/api';
      if (this.path && this.path.length > 0 && this.path.charAt(0) !== '/') {
        url += '/';
      }
      url += this.path;
      let socket = new WebSocket(url);
      this.server = socket; // keep for closing
      this.handleConnection(socket);
    }

    handleConnection(/*socket*/socket) {
      let that = this;
      let id = (1+Math.random()*4294967295).toString(16);
      socket.on('open', () => {
        that.emit2all('opened');
      });
      socket.on('close', () => {
        that.emit2all('closed');
        if (!that.closing) {
          that.tout = setTimeout(() => { that.startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
        }
      });
      socket.on('message', (data,flags) => {
        node.handleEvent(id,socket,'message',data,flags);
      });
      socket.on('error',  () => {
        that.emit2all('erro');
        if (!that.closing) {
          that.tout = setTimeout(() => { that.startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
        }
      });
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
      if (this._inputNodes.length === 0) {
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

    emit2all(event) {
      for (let i = 0; i < this._inputNodes.length; i++) {
        this._inputNodes[i].emit(event);
      }
    }

    close() {
      this.closing = true;
      this.server.close();
      if (this.tout) { clearTimeout(this.tout); }
      this.webSocketListeners.remove(this);
    }

    broadcast(data) {
      let i;
      try {
        this.server.send(data);
      }
      catch(e) { // swallow any errors
        RED.log.warn('ws:'+i+' : '+e);
      }
    }

    reply(id,data) {
      let session = this._clients[id];
      if (session) {
        try {
          session.send(data);
        }
        catch(e) { // swallow any errors
        }
      }
    }
  }

  class WebSocketListeners {
    constructor() {
      this.store = {};
    }

    get(node) {
      if (!node.accountConfig) {
        throw new Error(RED._('candy-egg-ws.errors.missing-conf'));
      }
      let key = node.path + ':' + node.account;
      let listener = this.store[key];
      if (!listener) {
        listener = new WebSocketListener(node.accountConfig, node.account, node.path, this);
        this.store[key] = listener;
      }
      return listener;
    }

    remove(listener) {
      let key = listener.path + ':' + listener.account;
      delete this.store[key];
    }
  }
  let webSocketListeners = new WebSocketListeners();
  
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
        that.on('opened', () => { that.status({fill:'green',shape:'dot',text:'connected'}); });
        that.on('erro',  () => { that.status({fill:'red',shape:'ring',text:'error'}); });
        that.on('closed',  () => { that.status({fill:'red',shape:'ring',text:'disconnected'}); });
      } else {
        that.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

      that.on('close', () => {
        that.listenerConfig.removeInputNode(that);
      });
    }
  }
  RED.nodes.registerType('CANDY-Egg WS endpoint in', WebSocketInNode);

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
        that.listenerConfig.registerInputNode(that);
        that.on('opened', () => { that.status({fill:'green',shape:'dot',text:'connected'}); });
        that.on('erro',  () => { that.status({fill:'red',shape:'ring',text:'error'}); });
        that.on('closed',  () => { that.status({fill:'red',shape:'ring',text:'disconnected'}); });
      } else {
        that.error(RED._('candy-egg-ws.errors.missing-conf'));
      }

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
          if (msg._session && msg._session.type === 'candy-egg-ws') {
            that.listenerConfig.reply(msg._session.id,payload);
          } else {
            that.listenerConfig.broadcast(payload, error => {
              if (!!error) {
                that.warn(RED._('candy-egg-ws.errors.send-error')+inspect(error));
              }
            });
          }
        }
      });
    }
  }
  RED.nodes.registerType('CANDY-Egg WS endpoint out',WebSocketOutNode);
}
