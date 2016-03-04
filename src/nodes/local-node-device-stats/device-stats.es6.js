'use strict';

import { StatsCollector } from './lib/stats';

export default function(RED) {

  class DeviceStatsNode {
    constructor(n) {
      RED.nodes.createNode(this, n);
      this.name = n.name;
      this.mem = n.mem;
      this.nw = n.nw;
      this.load = n.load;
      this.hostname = n.hostname;
      this.useString = n.useString;
      this.collector = new StatsCollector(this);
      this.status({});

      this.on('input', msg => {
        clearTimeout(this.timeout);
        delete this.timeout;
        this.status({ fill: 'red', shape: 'dot', text: 'device-stats.status.heartbeat' });
        let opts = msg ? msg.payload : null;
        this.collector.collect(opts).then(stats => {
          if (this.useString || opts && opts.useString) {
            stats = JSON.stringify(stats);
          }
          this.send({ payload: stats });
          this.timeout = setTimeout(() => {
            if (this.timeout) {
              this.status({});
            }
          }, 750);
        }).catch(err => {
          RED.log.warn(RED._('device-stats.errors.unknown', { error: err }));
          this.status({});
        });
      });
    }
  }
  RED.nodes.registerType('DeviceStats', DeviceStatsNode);
}
