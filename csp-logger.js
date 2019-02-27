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
    console.log('Sent to Rollbar.');
    reportToRollbar(reportObject, req);
  }
});


// Log these exceptions to the database, but don't send them
// to Rollbar since they're likely just noise.
function shouldReportToRollbar(reportObject) {
  // Our CSP disallows chrome-extensions.
  // See https://stackoverflow.com/questions/32336860/why-would-i-get-a-csp-violation-for-the-blocked-uri-about#35559407
  if (reportObject.data.blockedURI === 'chrome-extension') return false;
  if (reportObject.data.blockedURI === 'about') return false;

  // Firefox containers also report false positives, so if the
  // injection is on column 1 on line 1 in Firefox, ignore it.
  var isMaybeFirefoxContainer = (
    (reportObject.data.userAgent.indexOf('Mozilla/5.0') !== -1) &&
    (reportObject.data.userAgent.indexOf('Gecko') !== -1) && 
    (reportObject.data.userAgent.indexOf('Firefox') !== -1) &&
    (reportObject.data.violatedDirective === 'script-src') &&
    (reportObject.data.blockedURI === 'inline') &&
    (reportObject.data.lineNumber === 1) &&
    (reportObject.data.columnNumber === 1)
  );
  if (isMaybeFirefoxContainer) return false;

  return true;
}

function reportToRollbar(reportObject, req) {
  var reportingDomain = url.parse(reportObject.data.documentURI).host;
  rollbar.warning('CSP violation from ' + reportingDomain, {
    reportingDomain: reportingDomain,
    deploymentKey: 'csp-logger',
    districtKey: 'csp-logger',
    violatedDirective: reportObject.data.violatedDirective,
    blockedURI: reportObject.data.blockedURI,
    documentURI: reportObject.data.documentURI,
    scriptSample: reportObject.data.scriptSample,
    userAgent: reportObject.data.userAgent
  });
}