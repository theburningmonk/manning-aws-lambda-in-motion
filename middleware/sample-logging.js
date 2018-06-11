'use strict';

const correlationIds = require('../lib/correlation-ids');
const log = require('../lib/log');

// config should be { sampleRate: double } where sampleRate is between 0.0-1.0
module.exports = (config) => {
  let rollback = undefined;

  const isDebugEnabled = () => {
    const context = correlationIds.get();
    if (context['Debug-Log-Enabled'] === 'true') {
      return true;
    }

    return config.sampleRate && Math.random() <= config.sampleRate;
  }

  return {
    before: (handler, next) => {
      if (isDebugEnabled()) {
        rollback = log.enableDebug();
      }

      next();
    },
    after: (handler, next) => {
      if (rollback) {
        rollback();
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