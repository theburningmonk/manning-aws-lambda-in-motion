'use strict';

const co         = require('co');
const notify     = require('../lib/notify');
const log        = require('../lib/log');
const cloudwatch = require('../lib/cloudwatch');

const middy         = require('middy');
const sampleLogging = require('../middleware/sample-logging');
const flushMetrics  = require('../middleware/flush-metrics');
const captureCorrelationIds = require('../middleware/capture-correlation-ids');

const handler = co.wrap(function* (event, context, cb) {
  let order = JSON.parse(event.Records[0].Sns.Message);
  order.retried = true;

  let logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail,
    retry: true
  };

  try {
    yield notify.restaurantOfOrder(order);
    cb(null, "all done");
  } catch (err) {
    log.warn('failed to notify restaurant of new order', logContext, err);
    
    cb(err);
  } finally {
    cloudwatch.incrCount("NotifyRestaurantRetried");
  }
});

module.exports.handler = middy(handler)
  .use(captureCorrelationIds({ sampleDebugLogRate: 0.01 }))
  .use(sampleLogging({ sampleRate: 0.01 }))
  .use(flushMetrics);