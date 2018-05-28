'use strict';

const correlationIds = require('../lib/correlation-ids');
const log = require('../lib/log');

function captureHttp(headers, awsRequestId, sampleDebugLogRate) {
  if (!headers) {
   log.warn(`Request ${awsRequestId} is missing headers`);
   return;
  }

  let context = { awsRequestId };
  for (const header in headers) {
    if (header.toLowerCase().startsWith('x-correlation-')) {
      context[header] = headers[header];
    }
  }
 
  if (!context['x-correlation-id']) {
    context['x-correlation-id'] = awsRequestId;
  }

  // forward the original User-Agent on
  if (headers['User-Agent']) {
    context['User-Agent'] = headers['User-Agent'];
  }

  if (headers['Debug-Log-Enabled']) {
    context['Debug-Log-Enabled'] = headers['Debug-Log-Enabled'];
  } else {
    context['Debug-Log-Enabled'] = Math.random() < sampleDebugLogRate ? 'true' : 'false';
  }

  correlationIds.replaceAllWith(context);
}

function isApiGatewayEvent(event) {
  return event.hasOwnProperty('httpMethod')
}

module.exports = (config) => {
  const sampleDebugLogRate = config.sampleDebugLogRate || 0.01;

  return {
    before: (handler, next) => {      
      correlationIds.clearAll();

      if (isApiGatewayEvent(handler.event)) {
        captureHttp(handler.event.headers, handler.context.awsRequestId, sampleDebugLogRate);
      }
      
      next()
    }
  };
};