const gulp = require('gulp');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify-es').default;
const clean = require('gulp-clean');
const eslint = require('gulp-eslint');
const gulpIf = require('gulp-if');
const mocha = require('gulp-mocha');
const sourcemaps = require('gulp-sourcemaps');
const livereload = require('gulp-livereload');
const symlink = require('gulp-symlink');
const fs = require('fs');
const path = require('path');
const rmdir = require('rmdir');
const yaml = require('gulp-yaml');

gulp.task('lintSrcs', () => {
  return gulp
    .src(['./src/**/*.js'])
    .pipe(
      eslint({
        useEslintrc: true,
        fix: true
      })
    )
    .pipe(eslint.format())
    .pipe(
      gulpIf(file => {
        return file.eslint != null && file.eslint.fixed;
      }, gulp.dest('./src'))
    )
    .pipe(eslint.failAfterError());
});

gulp.task('lintTests', () => {
  return gulp
    .src(['./tests/**/*.js'])
    .pipe(
      eslint({
        emitWarning: true,
        useEslintrc: true,
        fix: true
      })
    )
    .pipe(eslint.format())
    .pipe(
      gulpIf(file => {
        return file.eslint != null && file.eslint.fixed;
      }, gulp.dest('./tests'))
    )
    .pipe(eslint.failAfterError());
});

gulp.task('lint', gulp.series('lintSrcs', 'lintTests'));

gulp.task('clean', () => {
  return gulp
    .src(
      [
        './dist/*',
        './dist/*.*',
        './dist',
        './*.tgz',
        './services/environment',
        './services/start_systemd.sh',
        './services/systemd/candy-red.service',
        './services/systemd/environment'
      ],
      { allowEmpty: true }
    )
    .pipe(clean({ force: true }));
});

gulp.task('nodes', () => {
  return Promise.all(
    fs
      .readdirSync('node_modules/')
      .filter(f => f.indexOf('local-node-') === 0)
      .filter(f => {
        try {
          return fs.statSync(`node_modules/${f}`).isDirectory();
        } catch (_) {
          return false;
        }
      })
      .map(f => {
        return new Promise((resolve, reject) =>
          rmdir(`node_modules/${f}`, err => {
            if (err) {
              return reject(err);
            }
            return resolve();
          })
        );
      })
  ).then(() => {
    return gulp.src('./dist/nodes/local-*').pipe(
      symlink(f => {
        return path.join(`node_modules/${f.relative}`);
      })
    );
  });
});

gulp.task('copyResources', () => {
  return gulp
    .src([
      './src/**/*.{css,ico,png,html,json,yaml,yml}',
      '!./src/device-manager/mo/**/*.{yaml,yml}'
    ])
    .pipe(gulp.dest('./dist'));
});

gulp.task('favicons', () => {
  return gulp
    .src('./src/public/images/icon*.png')
    .pipe(gulp.dest('./node_modules/node-red-dashboard/dist'));
});

gulp.task('mo', () => {
  return gulp
    .src(['./src/device-manager/mo/**/*.{yaml,yml}'])
    .pipe(yaml({ safe: true }))
    .pipe(gulp.dest('./dist/device-manager/mo'));
});

gulp.task(
  'buildSrcs',
  gulp.series('copyResources', 'mo', 'favicons', () => {
    return gulp
      .src('./src/**/*.js')
      .pipe(sourcemaps.init())
      .pipe(
        babel({
          minified: true,
          compact: true,
          configFile: './.babelrc'
        })
      )
      .on('error', console.error.bind(console))
      .pipe(
        uglify({
          mangle: {},
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
          }
        })
      )
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('./dist'))
      .pipe(livereload());
  })
);

gulp.task('build', gulp.series('buildSrcs', 'nodes'));

gulp.task('copyTestResources', () => {
  return gulp
    .src('./tests/**/*.{css,ico,png,html,json,yaml,yml}')
    .pipe(gulp.dest('./dist'));
});

gulp.task(
  'buildTests',
  gulp.series('buildSrcs', 'copyTestResources', () => {
    return gulp
      .src('./tests/**/*.js')
      .pipe(sourcemaps.init())
      .pipe(babel({ configFile: './.babelrc' }))
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('./dist'));
  })
);

gulp.task(
  'watch',
  gulp.series('build', () => {
    livereload.listen();
    gulp.watch('./src/*.js', ['build']);
  })
);

gulp.task('runTests', done => {
  return gulp
    .src(['./dist/**/*.test.js'], { read: false })
    .pipe(
      mocha({
        require: ['source-map-support/register'],
        reporter: 'spec'
      })
    )
    .once('error', () => {
      done();
      process.exit(1);
    })
    .once('end', () => {
      done();
      process.exit();
    });
});

gulp.task('test', gulp.series('lint', 'buildTests', 'runTests'));

gulp.task('default', gulp.series('build'));
