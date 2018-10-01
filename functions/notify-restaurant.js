'use strict';

const co     = require('co');
const notify = require('../lib/notify');
const retry  = require('../lib/retry');
const log    = require('../lib/log');
const wrapper = require('../middleware/wrapper');
const flushMetrics  = require('../middleware/flush-metrics');

const handler = co.wrap(function* (event, context, cb) {
  let events = context.parsedKinesisEvents;
  let orderPlaced = events.filter(r => r.eventType === 'order_placed');
  log.debug(`found ${orderPlaced.length} 'order_placed' events`);

  for (let order of orderPlaced) {
    order.scopeToThis();

    try {
      yield notify.restaurantOfOrder(order);
    } catch (err) {
      yield retry.restaurantNotification(order);

      let logContext = {
        orderId: order.orderId,
        restaurantName: order.restaurantName,
        userEmail: order.userEmail
      };
      log.warn('failed to notify restaurant of new order', logContext, err);
    }

    order.unscope();
  }
  
  cb(null, "all done");
});

module.exports.handler = wrapper(handler)
  .use(flushMetrics);