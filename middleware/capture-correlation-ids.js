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

function parsePayload (record) {
  let json = new Buffer(record.kinesis.data, 'base64').toString('utf8');
  return JSON.parse(json);  
}

function captureKinesis(event, context, sampleDebugLogRate) {
  const awsRequestId = context.awsRequestId;
  const events = event
    .Records
    .map(parsePayload)
    .map(record => {
      // the wrapped kinesis client would put the correlation IDs as part of 
      // the payload as a special __context__ property
      let recordContext = record.__context__ || {};
      recordContext.awsRequestId = awsRequestId;

      delete record.__context__;

      if (!recordContext['x-correlation-id']) {
        recordContext['x-correlation-id'] = awsRequestId;
      }

      if (!recordContext['Debug-Log-Enabled']) {
        recordContext['Debug-Log-Enabled'] = Math.random() < sampleDebugLogRate ? 'true' : 'false';
      }

      let oldContext = undefined;

      // lets you add more correlation IDs for just this record
      record.addToScope = (key, value) => {
        if (!key.startsWith("x-correlation-")) {
          key = "x-correlation-" + key;
        }

        recordContext[key] = value;
        correlationIds.set(key, value);
      }

      record.scopeToThis = () => {
        if (!oldContext) {
          oldContext = correlationIds.get();
          correlationIds.replaceAllWith(recordContext);
        }
      };

      record.unscope = () => {
        if (oldContext) {
          correlationIds.replaceAllWith(oldContext);
        }
      }

      return record;
    });

  context.parsedKinesisEvents = events;

  correlationIds.replaceAllWith({ awsRequestId });
}

function isApiGatewayEvent(event) {
  return event.hasOwnProperty('httpMethod')
}

function isKinesisEvent(event) {
  if (!event.hasOwnProperty('Records')) {
    return false;
  }
  
  if (!Array.isArray(event.Records)) {
    return false;
  }

  return event.Records[0].eventSource === 'aws:kinesis';
}

module.exports = (config) => {
  const sampleDebugLogRate = config.sampleDebugLogRate || 0.01;

  return {
    before: (handler, next) => {      
      correlationIds.clearAll();

      if (isApiGatewayEvent(handler.event)) {
        captureHttp(handler.event.headers, handler.context.awsRequestId, sampleDebugLogRate);
      } else if (isKinesisEvent(handler.event)) {
        captureKinesis(handler.event, handler.context, sampleDebugLogRate);
      }

      next()
    }
  };
};