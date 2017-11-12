'use strict';

const co = require('co');

function createApiHandler(f) {
  return co.wrap(function* (event, context, cb) {
    console.log(JSON.stringify(event));

    try {
      let response = yield Promise.resolve(f(event, context));
      console.log('SUCCESS', response);
      cb(null, response);
    } catch (err) {
      console.log("Failed to process request", err);
      cb(err);
    }
  });
}

module.exports = createApiHandler;