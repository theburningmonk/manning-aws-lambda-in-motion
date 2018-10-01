'use strict';

const middy = require('middy');
const sampleLogging = require('./sample-logging');
const captureCorrelationIds = require('./capture-correlation-ids');
const functionShield = require('./function-shield');

module.exports = f => {
  return middy(f)
    .use(captureCorrelationIds({ sampleDebugLogRate: 0.01 }))
    .use(sampleLogging({ sampleRate: 0.01 }))
    .use(functionShield());
};