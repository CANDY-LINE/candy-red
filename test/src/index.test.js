import { assert } from 'chai';
import { spawn } from 'child_process';

describe('index.js executable script', () => {
  it('should not accept missing URL argument', done => {
    let stdout = '';
    let stderr = '';
    let env = Object.create(process.env);
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`], { env: env });
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(1, code);
      assert.equal('WS_URL is missing', stderr.trim());
      done();
    });
  });
  it('should not accept a wrong scheme URL', done => {
    let stdout = '';
    let stderr = '';
    let env = Object.create(process.env);
    env.WS_URL = 'http://localhost';
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`], { env: env });
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(2, code);
      assert.equal('Invalid WS_URL', stderr.trim());
      done();
    });
  });
  it('should not accept an invalid URL', done => {
    let stdout = '';
    let stderr = '';
    let env = Object.create(process.env);
    env.WS_URL = 'http_//_localhost';
    let gwd = spawn('node', [`${__dirname}/../../dist/index.js`], { env: env });
    gwd.stdout.on('data', data => {
      stdout += data.toString();
    });
    gwd.stderr.on('data', data => {
      stderr += data.toString();
    });
    gwd.on('exit', code => {
      assert.equal(2, code);
      assert.equal('Invalid WS_URL', stderr.trim());
      done();
    });
  });
});