'use strict';

import { assert } from 'chai';
import { ERP2Parser, ESP3RadioERP2Parser } from '../../../../dist/nodes/local-node-enocean/lib/esp3_erp2_parser';

describe('ERP2Parser', () => {
  let parser = new ERP2Parser();
  describe('#parse()', () => {
    it('should return a valid context from a raw ERP2 packet (1)', done => {
      parser.parse('20002bcaa98861').then(ctx => {
        assert.equal('002bcaa9', ctx.originatorId);
        assert.equal('', ctx.destinationId);
        assert.equal('RPS', ctx.telegramType);
        assert.equal(0xf6, ctx.rorg);
        assert.equal('88', new Buffer(ctx.dataDl).toString('hex'));
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should return a valid context from a raw ERP2 packet (2)', done => {
      parser.parse('20002bcaa900d0').then(ctx => {
        assert.equal('002bcaa9', ctx.originatorId);
        assert.equal('', ctx.destinationId);
        assert.equal('RPS', ctx.telegramType);
        assert.equal(0xf6, ctx.rorg);
        assert.equal('00', new Buffer(ctx.dataDl).toString('hex'));
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should return a valid context from a raw data passed from ESP3RadioERP2Parser class', done => {
      new ESP3RadioERP2Parser().parse('550007020a0a20002bcaa900d001328b').then(ctx => {
        return parser.parse(ctx.payload);
      }).then(ctx => {
          assert.equal('002bcaa9', ctx.originatorId);
          assert.equal('', ctx.destinationId);
          assert.equal('RPS', ctx.telegramType);
          assert.equal(0xf6, ctx.rorg);
          assert.equal('00', new Buffer(ctx.dataDl).toString('hex'));
          assert.isUndefined(ctx.container);
          done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should return a valid context from a parsing result object passed from ESP3RadioERP2Parser class', done => {
      new ESP3RadioERP2Parser().parse('550007020a0a20002bcaa900d001328b').then(ctx => {
        return parser.parse(ctx);
      }).then(ctx => {
          assert.equal('002bcaa9', ctx.originatorId);
          assert.equal('', ctx.destinationId);
          assert.equal('RPS', ctx.telegramType);
          assert.equal(0xf6, ctx.rorg);
          assert.equal('00', new Buffer(ctx.dataDl).toString('hex'));
          assert.equal(0x32, ctx.container.dBm);
          done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
  });
});

describe('ESP3RadioERP2Parser', () => {
  let parser = new ESP3RadioERP2Parser();
  describe('#parse()', () => {
    it('should return a valid context from a raw data passed from node-enocean', done => {
      parser.parse('550007020a0a20002bcaa9886101328b').then(ctx => {
        assert.equal(0x01, ctx.subTelNum);
        assert.equal(0x32, ctx.dBm);
        assert.equal('20002bcaa98861', new Buffer(ctx.payload).toString('hex'));
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should return a valid context from another raw data passed from node-enocean', done => {
      parser.parse('550007020a0a20002bcaa900d001328b').then(ctx => {
        assert.equal(0x01, ctx.subTelNum);
        assert.equal(0x32, ctx.dBm);
        assert.equal('20002bcaa900d0', new Buffer(ctx.payload).toString('hex'));
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
  });
});