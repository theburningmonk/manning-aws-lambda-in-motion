'use strict';

const co     = require('co');
const notify = require('../lib/notify');
const retry  = require('../lib/retry');
const log    = require('../lib/log');
const wrapper = require('../middleware/wrapper');

const flushMetrics  = require('../middleware/flush-metrics');

const handler = co.wrap(function* (event, context, cb) {
  let events = context.parsedKinesisEvents;
  let orderAccepted = events.filter(r => r.eventType === 'order_accepted');
  log.debug(`found ${orderAccepted.length} 'order_accepted' events`);

  for (let order of orderAccepted) {
    order.scopeToThis();

    try {
      yield notify.userOfOrderAccepted(order);
    } catch (err) {
      yield retry.userNotification(order);

      let logContext = {
        orderId: order.orderId,
        restaurantName: order.restaurantName,
        userEmail: order.userEmail
      };
      log.warn('failed to notify user of accepted order', logContext, err);
    }

    order.unscope();
  }
  
  cb(null, "all done");
});

module.exports.handler = wrapper(handler)
  .use(flushMetrics);