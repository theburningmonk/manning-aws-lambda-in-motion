'use strict';

const log = require('../lib/log');

// config should be { sampleRate: double } where sampleRate is between 0.0-1.0
module.exports = (config) => {
  let oldLogLevel = undefined;

  return {
    before: (handler, next) => {
      if (config.sampleRate && Math.random() <= config.sampleRate) {
        oldLogLevel = process.env.log_level;
        process.env.log_level = 'DEBUG';
      }

      next();
    },
    after: (handler, next) => {
      if (oldLogLevel) {
        process.env.log_level = oldLogLevel;
      }

      next();
    },
    onError: (handler, next) => {
      let awsRequestId = handler.context.awsRequestId;
      let invocationEvent = JSON.stringify(handler.event);
      log.error('invocation failed', { awsRequestId, invocationEvent }, handler.error);

      next(handler.error);
    }
  };
};