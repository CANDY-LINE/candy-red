'use strict';

module.exports = function (grunt) {

  require('time-grunt')(grunt);

  var config = {

    babel: {
      options: {
        plugins: ['uglify:after'],
        sourceMap: true
      },
      dist: {
        files: [{
          expand: true,
          cwd: './src',
          src: '**/*.js',
          dest: './dist',
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
            src: ['**/*.json', '**/*.html', '**/*.png'],
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
            './*.tgz',
            './node_modules/local-node-*'
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
        './*.js',
        './test/src/**/*.js',
        './src/**/*.js'
      ]
    },
    mochaTest: {
      all: {
        options: {
          require: 'babel/register'
        },
        src: ['./test/src/**/*.js']
      }
    },
  };
  
  var fs = require('fs');
  try {
    fs.readdirSync('./dist/nodes/').forEach(function(f) {
      if (f.indexOf('local-node-') === 0) {
        config.run.npmLocalInstall.args.push('./dist/nodes/' + f);
      }
    });
  } catch (e) { /* pass */ }
  
  grunt.initConfig(config);
  
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-babel');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-run');

  grunt.registerTask('test', [
    'babel',
    'copy',
    'run',
    'jshint',
    'mochaTest'
  ]);

  grunt.registerTask('build', [
    'clean',
    'babel',
    'copy',
    'run',
  ]);

  grunt.registerTask('default', [
    'test',
    'build'
  ]);
};
