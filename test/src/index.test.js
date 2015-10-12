import { assert } from 'chai';
import { spawn } from 'child_process';

describe('index.js executable script', () => {
  it('should not accept missing URL argument', done => {
    let stdout = '';
    let stderr = '';
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`]);
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(1, code);
      assert.equal('Invalid url', stderr.trim());
      done();
    });
  });
  it('should not accept a wrong scheme URL', done => {
    let stdout = '';
    let stderr = '';
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`, 'http://localhost']);
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(1, code);
      assert.equal('Invalid url', stderr.trim());
      done();
    });
  });
  it('should not accept an invalid URL', done => {
    let stdout = '';
    let stderr = '';
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`, 'http_//_localhost']);
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(1, code);
      assert.equal('Invalid url', stderr.trim());
      done();
    });
  });
});