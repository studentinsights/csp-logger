#!/usr/bin/env node
var url = require('url');

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

// Rollbar
var isRollbarEnabled = process.env.ROLLBAR_ACCESS_TOKEN !== undefined;
if (isRollbarEnabled) {
  var Rollbar = require('rollbar');
  var rollbar = new Rollbar({
    accessToken: process.env.ROLLBAR_ACCESS_TOKEN,
    captureUncaught: true,
    captureUnhandledRejections: true
  });
}

server.listen(config.port, function (reportObject, req) {
  store.save(reportObject);

  if (isRollbarEnabled && shouldReportToRollbar(reportObject)) {
    reportToRollbar(reportObject, req);
  }
});

function shouldReportToRollbar(reportObject) {
  // Our CSP disallows chrome-extensions.  Log this but don't send to Rollbar.
  // See https://stackoverflow.com/questions/32336860/why-would-i-get-a-csp-violation-for-the-blocked-uri-about#35559407
  if (reportObject.data.blockedURI === 'chrome-extension') return false;
  if (reportObject.data.blockedURI === 'about') return false;
  return true;
}

function reportToRollbar(reportObject, req) {
  var reportingDomain = url.parse(reportObject.data.documentURI).host;
  rollbar.warning('CSP violation from ' + reportingDomain, {
    reportingDomain: reportingDomain,
    deploymentKey: 'csp-logger',
    districtKey: 'csp-logger'
  });
}