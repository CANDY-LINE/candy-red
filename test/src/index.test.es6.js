import { assert } from 'chai';
import { spawn } from 'child_process';

describe('index.js executable script', () => {
  it('should start Node-RED properly', done => {
    let stdout = '';
    let env = Object.create(process.env);
    let candyred = spawn('node', [`${__dirname}/../../dist/index.js`], { env: env });
    candyred.stdout.on('data', data => {
      let line = data.toString();
      stdout += line;
      if (line.indexOf('[info] Started flows') >= 0) {
        candyred.kill('SIGKILL');
      }
    });
    candyred.on('exit', code => {
      console.log(`Exit Code => ${code}`);
      assert.isNull(code);
      console.log(stdout);
      done();
    });
  });
});
