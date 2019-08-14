# CSP Logger

A basic service for logging [content security policy](https://developer.mozilla.org/en-US/docs/Security/CSP) violations.  See [upstream](https://github.com/mozilla/csp-logger).

## Setup
This deploys to Heroku, and expects a Postgres instance along with these env variables:

    - `PORT` - Port for server
    - `DATABASE_URL` - Postgres connection string
    - `DOMAIN_WHITELIST_STRING` - A comma separated whitelist of domains that be sending CSP exceptions
    - `SOURCE_BLACKLIST_STRING` - A comma separated blacklists of sources to ignore
    
Then run `npm start`.

## Pointing your app to it
Configure your CSP to report to the `/csp` route of this service. Incoming reports will be logged to your designated storage.

## Looking in the database
### Everything
```
heroku pg:psql -c 'select id, substr("violatedDirective", 0, 12), "documentURI", "blockedURI", "sourceFile", "lineNumber", "columnNumber" from "cspViolations" ORDER BY id DESC;'
```

### Ignore exceptions
```
heroku pg:psql -c 'select id, substr("violatedDirective", 0, 12), "documentURI", "blockedURI", "sourceFile", "lineNumber", "columnNumber" from "cspViolations" WHERE "lineNumber" != 1 AND "columnNumber" != 1 ORDER BY id DESC;'
```

### Delete only most common exceptions
```
heroku pg:psql -c 'DELETE from "cspViolations" WHERE "lineNumber" = 1 AND "columnNumber" = 1';
```