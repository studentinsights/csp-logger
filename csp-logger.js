#!/usr/bin/env node

var argv = require('optimist')
  .usage('Usage: $0')
  .describe('test', 'Enables testing mode')
  .describe('example', 'Writes example config to given file instead of reading it and exits')
  .argv;

if (argv.example) {
  var config = require('./lib/config').dropExample('example.json');
  process.exit(0);
}

var config = require('./lib/config').loadFromEnv();
var server = require('./lib/server').init(config);

if (argv.test) {
  console.log('Testing page enabled');
  require('./lib/test')(server);
}

var store = require('./lib/store').init(config);

server.listen(config.port, function (reportObject, req) {
  store.save(reportObject);
});
