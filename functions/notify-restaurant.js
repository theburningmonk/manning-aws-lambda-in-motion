'use strict';

const co         = require('co');
const getRecords = require('../lib/kinesis').getRecords;
const notify     = require('../lib/notify');
const retry      = require('../lib/retry');
const log        = require('../lib/log');

const middy         = require('middy');
const sampleLogging = require('../middleware/sample-logging');

const handler = co.wrap(function* (event, context, cb) {
  let records = getRecords(event);
  let orderPlaced = records.filter(r => r.eventType === 'order_placed');
  log.debug(`found ${orderPlaced.length} 'order_placed' events`);

  for (let order of orderPlaced) {
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
  }
  
  cb(null, "all done");
});

module.exports.handler = middy(handler)
  .use(sampleLogging({ sampleRate: 0.01 }));