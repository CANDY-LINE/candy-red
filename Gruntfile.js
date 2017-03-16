'use strict';

module.exports = function (grunt) {

  require('time-grunt')(grunt);

  var config = {

    babel: {
      options: {
        sourceMaps: true,
        minified: true,
        compact: true,
        presets: ['es2015'],
        plugins: ['add-module-exports']
      },
      dist: {
        files: [{
          expand: true,
          cwd: './src',
          src: '**/*.es6.js',
          dest: './dist',
          ext: '.js'
        },{
          expand: true,
          cwd: './tests',
          src: '**/*.es6.js',
          dest: './tests',
          ext: '.js'
        }]
      }
    },

    copy: {
      main: {
        files: [
          {
            expand: true,
            cwd: 'src/',
            src: ['**/*.json', '**/*.html', '**/*.png', '**/*.css', '**/*.ico'],
            dest: 'dist/'
          }
        ],
      },
    },

    run: {
      npmLocalInstall: {
        cmd: 'npm',
        args: [ 'install' ]
      }
    },

    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            './dist/*',
            './dist',
            './tests/**/*.map',
            './tests/**/*.js',
            '!./tests/**/*.es6.js',
            './*.tgz',
            './node_modules/local-node-*',
            './services/environment',
            './services/start_systemd.sh',
            './services/systemd/candy-red.service',
            './services/systemd/environment',
            './services/start_sysvinit.sh',
            './services/sysvinit/environment',
            './services/sysvinit/wrapper.sh'
          ]
        }]
      }
    },

    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        './tests/**/*.es6.js',
        './src/**/*.es6.js'
      ]
    },
    mochaTest: {
      all: {
        src: ['./tests/**/*.js', '!./tests/**/*.es6.js']
      }
    },
  };

  grunt.initConfig(config);

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-run');

  grunt.registerTask('pre-run', function() {
    var fs = require('fs');
    fs.readdirSync('./dist/nodes/').forEach(function(f) {
      if (f.indexOf('local-node-') === 0) {
        config.run.npmLocalInstall.args.push('./dist/nodes/' + f);
      }
    });
  });

  grunt.registerTask('test', [
    'babel',
    'jshint',
    'copy',
    'mochaTest'
  ]);

  grunt.registerTask('build', [
    'clean',
    'babel',
    'copy',
    'pre-run',
    'run',
  ]);

  grunt.registerTask('default', [
    'test',
    'build'
  ]);
};
