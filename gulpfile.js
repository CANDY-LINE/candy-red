const gulp        = require('gulp');
const babel       = require('gulp-babel');
const uglify      = require('gulp-uglify');
const rename      = require('gulp-rename');
const clean       = require('gulp-clean');
const jshint      = require('gulp-jshint');
const mocha       = require('gulp-mocha');
const sourcemaps  = require('gulp-sourcemaps');
const livereload  = require('gulp-livereload');
const exec        = require('gulp-exec');
const sequence    = require('run-sequence');
const symlink     = require('gulp-symlink');
const fs          = require('fs');
const path        = require('path');
const rmdir       = require('rmdir');

gulp.task('lint', () => {
  return gulp.src([
    './tests/**/*.es6.js',
    './src/**/*.es6.js'
  ])
  .pipe(jshint())
  .pipe(jshint.reporter('jshint-stylish'))
  .pipe(jshint.reporter('fail'));
});

gulp.task('clean', () => {
  gulp.src([
    './dist/*',
    './dist',
    './tests/**/*.map',
    './tests/**/*.js',
    '!./tests/**/*.es6.js',
    './*.tgz',
    './services/environment',
    './services/start_systemd.sh',
    './services/systemd/candy-red.service',
    './services/systemd/environment',
    './node_modules/node-red*/**/locales/!(en-US)',
    './node_modules/node-red/**/locales/!(en-US)',
  ])
  .pipe(clean({force: true}))
});

gulp.task('nodes', () => {
  return Promise.all(fs.readdirSync('node_modules/')
  .filter(f => f.indexOf('local-node-') === 0)
  .filter(f => {
    try {
      return fs.statSync(`node_modules/${f}`).isDirectory();
    } catch (_) {
      return false;
    }
  })
  .map(f => {
    return new Promise((resolve, reject) => rmdir(`node_modules/${f}`, (err) => {
      if (err) {
        return reject(err);
      }
      return resolve();
    }))
  })).then(() => {
    return gulp.src('./dist/nodes/local-*')
    .pipe(symlink((f) => {
      return path.join(`node_modules/${f.relative}`);
    }));
  });
});

gulp.task('copyResources', () => {
  gulp.src('./src/**/*.{css,ico,png,html,json,yaml,yml}')
  .pipe(gulp.dest('./dist'));
});

gulp.task('favicons', () => {
  return gulp.src('./src/public/images/icon*.png')
    .pipe(gulp.dest('./node_modules/node-red-dashboard/dist'));
});

gulp.task('buildSrcs', ['copyResources', 'favicons'], () => {
  return gulp.src('./src/**/*.es6.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      minified: true,
      compact: true,
      presets: ['es2015'],
      plugins: ['add-module-exports']
    }))
    .pipe(uglify({
      mangle: {
      },
      compress: {
        dead_code: true,
        drop_debugger: true,
        properties: true,
        unused: true,
        toplevel: true,
        if_return: true,
        drop_console: false,
        conditionals: true,
        unsafe_math: true,
        unsafe: true
      },
    }))
    .pipe(rename((path) => {
      // truncate .es6 from basename
      path.basename = path.basename.substring(0, path.basename.length - 4);
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('./dist'))
    .pipe(livereload());
});

gulp.task('build', (done) => {
  sequence('buildSrcs', 'nodes', done);
});

gulp.task('copyTestResources', () => {
  gulp.src('./tests/**/*.{css,ico,png,html,json,yaml,yml}')
  .pipe(gulp.dest('./dist'));
});

gulp.task('buldTests', ['buildSrcs','copyTestResources'], () => {
  return gulp.src('./tests/**/*.es6.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      presets: ['es2015'],
      plugins: ['add-module-exports']
    }))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('./dist'));
});

gulp.task('watch', ['build'], () => {
  livereload.listen();
  gulp.watch('./src/*.js', ['build']);
});

gulp.task('test', ['lint', 'buldTests'], () => {
  return gulp.src([
    './dist/**/*.test.es6.js',
  ], {read: false})
  .pipe(mocha({
    require: ['source-map-support/register'],
    reporter: 'spec'
  }))
  .once('error', () => process.exit(1))
  .once('end', () => process.exit())
});

gulp.task('default', ['build']);
