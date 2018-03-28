'use strict';

const co         = require('co');
const getRecords = require('../lib/kinesis').getRecords;
const notify     = require('../lib/notify');
const retry      = require('../lib/retry');
const log        = require('../lib/log');

module.exports.handler = co.wrap(function* (event, context, cb) {
  let records = getRecords(event);
  let orderAccepted = records.filter(r => r.eventType === 'order_accepted');
  log.debug(`found ${orderAccepted.length} 'order_accepted' events`);

  for (let order of orderAccepted) {
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
  }
  
  cb(null, "all done");
});