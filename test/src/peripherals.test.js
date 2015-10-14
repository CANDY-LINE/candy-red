import { assert } from 'chai';
import Promise from 'es6-promises';
import peripherals from '../../src/peripherals';

describe('Peripherals', () => {
  describe('#lookup()', () => {
    it('should return a Promise object', () => {
      assert.isTrue(peripherals.lookup('BLECAST_BL') instanceof Promise);
      assert.isTrue(peripherals.lookup('BLECAST_TM') instanceof Promise);
      assert.isTrue(peripherals.lookup('no-such-id') instanceof Promise);
    });
    it('should return a rejected Promise object', done => {
      peripherals.lookup('BLECAST_BL\u0000').catch(e => {
        done(e);
      }).then(() => {
        peripherals.lookup('BLECAST_BL\u0000\u0000').catch(e => {
          done(e);
        }).then(() => {
          peripherals.lookup('\u0000\u0000BLECAST_BL\u0000\u0000').catch(e => {
            done(e);
          }).then(() => {
            done();
          });
        });
      });
    });
    it('should return a Promise object with reject state when peripherals fails to look up an object', done => {
      peripherals.lookup('no-such-id').then(() => {
        assert.fail('Should not reach here!');
      }).catch(e => {
        assert.equal('Unknown peripheral: [no-such-id]', e);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
      peripherals.lookup(undefined).then(() => {
        assert.fail('Should not reach here!');
      }).catch(e => {
        assert.equal('Unknown peripheral: local name is empty', e);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
  });
});

describe('BleCastBl', () => {
  describe('#parse()', () => {
    it('should have illuminance type and unit', done => {
      peripherals.lookup('BLECAST_BL').then(p => {
        let obj = p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x00]));
        assert.equal('lx', obj.type);
        assert.equal('lx', obj.unit);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should parse illuminance values', done => {
      peripherals.lookup('BLECAST_BL').then(p => {
        assert.equal(0, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x00])).val);
        assert.equal(0, p.parse(new Buffer([0x99, 0x99, 0xff, 0xff, 0x00, 0x00])).val);
        assert.equal(1, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x01, 0x00])).val);
        assert.equal(256, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x01])).val);
        assert.equal(65535, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0xff, 0xff])).val);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
  });
});

describe('BleCastTm', () => {
  describe('#parse()', () => {
    it('should have temperature type and unit', done => {
      peripherals.lookup('BLECAST_TM').then(p => {
        let obj = p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x00]));
        assert.equal('te', obj.type);
        assert.equal('C', obj.unit);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
    it('should parse temperature values', done => {
      peripherals.lookup('BLECAST_TM').then(p => {
        assert.equal(0, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x00])).val);
        assert.equal(0, p.parse(new Buffer([0x99, 0x99, 0xff, 0xff, 0x00, 0x00])).val);
        assert.equal(1, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x01, 0x00])).val);
        assert.equal(0, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x01])).val);
        assert.equal(0.5, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x00, 0x80])).val);
        assert.equal(-0.5, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0xff, 0xff])).val);
        assert.equal(-0.5, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0xff, 0x80])).val);
        assert.equal(-128, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x80, 0x00])).val);
        assert.equal(127.5, p.parse(new Buffer([0x99, 0x99, 0x00, 0x00, 0x7f, 0x80])).val);
        done();
      }).catch(e => {
        done(e); // for showing assertion errors
      });
    });
  });
});
