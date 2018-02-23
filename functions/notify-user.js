'use strict';

const co         = require('co');
const getRecords = require('../lib/kinesis').getRecords;
const notify     = require('../lib/notify');
const retry      = require('../lib/retry');

module.exports.handler = co.wrap(function* (event, context, cb) {
  let records = getRecords(event);
  let orderAccepted = records.filter(r => r.eventType === 'order_accepted');

  for (let order of orderAccepted) {
    try {
      yield notify.userOfOrderAccepted(order);
    } catch (err) {
      yield retry.userNotification(order);
    }
  }
  
  cb(null, "all done");
});