'use strict';

const co         = require('co');
const notify     = require('../lib/notify');

module.exports.handler = co.wrap(function* (event, context, cb) {
  let order = JSON.parse(event.Records[0].Sns.Message);
  order.retried = true;

  try {
    yield notify.userOfOrderAccepted(order);
    cb(null, "all done");
  } catch (err) {
    cb(err);
  }
});