#!/usr/bin/env node
'use strict';

import http from 'http';

http.createServer((request, response) => {
  response.end('It Works!! Path Hit: ' + request.url);
}).listen(8080, () => {
  console.log('started!');
});
