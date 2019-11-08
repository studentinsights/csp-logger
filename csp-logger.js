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
  if (shouldWriteToDatabase(reportObject)) {
    store.save(reportObject);
  }

  if (isRollbarEnabled && shouldReportToRollbar(reportObject)) {
    console.log('Sent to Rollbar.');
    reportToRollbar(reportObject, req);
  }
});


// Don't write to database
function shouldWriteToDatabase(reportObject) {
  if (isProbablyAnExtension(reportObject)) return false;
  if (isProbablyFirefoxContainer(reportObject)) return false;

  return true;
}

// Don't report to Rollbar
function shouldReportToRollbar(reportObject) {
  if (isProbablyAnExtension(reportObject)) return false;
  if (isProbablyFirefoxContainer(reportObject)) return false;

  return true;
}

// Our CSP disallows chrome-extensions.
// See https://stackoverflow.com/questions/32336860/why-would-i-get-a-csp-violation-for-the-blocked-uri-about#35559407
// or chrome: https://bugs.chromium.org/p/chromium/issues/detail?id=749236
function isProbablyAnExtension(reportObject) {
  if (reportObject.data.blockedURI === 'chrome-extension') return true;
  if (reportObject.data.blockedURI === 'about') return true;
  if (isProbablyFirefoxExtension(reportObject)) return true;

  return false;
}


// Firefox specifically (eg, privacy badger, react devtools)
// firefox: https://bugzilla.mozilla.org/show_bug.cgi?id=1267027
// related: https://github.com/EFForg/privacybadger/issues/1793
function isProbablyFirefoxExtension(reportObject) {
  return (
    (reportObject.data.blockedURI === 'inline') &&
    (reportObject.data.sourceFile.indexOf('moz-extension://') === 0) &&
    (reportObject.data.userAgent.indexOf('Mozilla/5.0') !== -1) &&
    (reportObject.data.userAgent.indexOf('Gecko') !== -1) && 
    (reportObject.data.userAgent.indexOf('Firefox') !== -1)
  );
}

// Firefox containers also report false positives, so if the
// injection is on column 1 on line 1 in Firefox, ignore it.
function isProbablyFirefoxContainer(reportObject) {
  return (
    (reportObject.data.userAgent.indexOf('Mozilla/5.0') !== -1) &&
    (reportObject.data.userAgent.indexOf('Gecko') !== -1) && 
    (reportObject.data.userAgent.indexOf('Firefox') !== -1) &&
    (reportObject.data.violatedDirective === 'script-src') &&
    (reportObject.data.blockedURI === 'inline') &&
    (reportObject.data.lineNumber === 1) &&
    (reportObject.data.columnNumber === 1)
  );
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