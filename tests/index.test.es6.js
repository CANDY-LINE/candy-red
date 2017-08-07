'use strict';

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
  it('should start Node-RED properly', function(done) {
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
    this.timeout(30000);
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

  describe('#_inspectBoardStatus()', () => {
    it('should not return any undefined values', done => {
      cr._inspectBoardStatus(__dirname + '/../package.json').then(versions => {
        assert.equal('N/A', versions.candyBsv);
        assert.isDefined(versions.candyRedv);
        done();
      }).catch(err => {
        done(err);
      });
    });
  });
});
