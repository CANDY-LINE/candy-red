import * as sinon from 'sinon';
import { assert } from 'chai';
import { spawn } from 'child_process';
import os from 'os';
import { CandyRed } from '../dist';

describe('index.js executable script', () => {
  let candyred = null;
  afterEach(() => {
    if (candyred) {
      candyred.kill('SIGKILL');
    }
  });
  it('should start Node-RED properly', done => {
    let stdout = '';
    let env = Object.create(process.env);
    env.HOME = __dirname;
    candyred = spawn('node', [`${__dirname}/../dist/index.js`], { env: env });
    candyred.stdout.on('data', data => {
      let line = data.toString();
      stdout += line;
      if (line.indexOf('[info] Started flows') >= 0) {
        candyred.kill('SIGKILL');
      } else {
        console.log(line.trim());
      }
    });
    candyred.on('exit', code => {
      console.log(`Exit Code => ${code}`);
      assert.isNull(code);
      done();
    });
  });
});

describe('CandyRed', () => {
  let sandbox;
  let cr = new CandyRed();
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('#_createCandyRedEditorTheme()', () => {
    it('should return titles containing hostname', () => {
      let theme = cr._createCandyRedEditorTheme();
      assert.equal('CANDY RED@' + os.hostname(), theme.page.title);
      assert.equal(' ** ' + os.hostname() + ' **', theme.header.title);
    });
    it('should return titles containing deviceId as well as hostname', () => {
      let theme = cr._createCandyRedEditorTheme('my:deviceId');
      assert.equal('CANDY RED@my:deviceId', theme.page.title);
      assert.equal(' ** ' + os.hostname() + ' (my:deviceId) **', theme.header.title);
    });
  });
  describe('#_createCandyBoxEditorTheme()', () => {
    it('should return titles containing hostname', () => {
      let theme = cr._createCandyBoxEditorTheme();
      assert.equal('CANDY BOX@' + os.hostname(), theme.page.title);
      assert.equal(' ** ' + os.hostname() + ' **', theme.header.title);
    });
    it('should return titles containing deviceId as well as hostname', () => {
      let theme = cr._createCandyBoxEditorTheme('my:deviceId');
      assert.equal('CANDY BOX@my:deviceId', theme.page.title);
      assert.equal(' ** ' + os.hostname() + ' (my:deviceId) **', theme.header.title);
    });
  });
});
