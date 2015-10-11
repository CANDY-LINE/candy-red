edison-gw
===

## Install on Edison

`npm install -g` is performed by the user `nobody`(https://github.com/npm/npm/issues/5596), which makes any provileged operations fail.

Please run the `postinstall.sh` manually AFTER `npm install`.

```
$ npm install -g edison-gw-[version].tgz --production
$ /usr/lib/node_modules/edison-gw/services/ssytemd/postinstall.sh
```

## Stop/Start/Status Service

The edison-gw service name is `gwd`.

```
$ systemctl stop gwd
$ systemctl start gwd
$ systemctl status gwd
```

## Uninstall from Edison

Please run the `preuninstall.sh` manually BEFORE `npm uninstall`.

```
$ /usr/lib/node_modules/edison-gw/services/ssytemd/preuninstall.sh
$ npm uninstall -g edison-gw
```

## Setup

```
$ npm install
```

## Build

```
$ npm run build
```

Please remember to insert `run` between `npm` and `build`.

## Test

```
$ npm test
```
or
```
$ npm run test
```

## Package

```
$ npm pack
```
