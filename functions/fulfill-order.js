'use strict';

const co         = require('co');
const kinesis    = require('../lib/kinesis');
const log        = require('../lib/log');
const cloudwatch = require('../lib/cloudwatch');
const wrapper    = require('../middleware/wrapper');

const streamName = process.env.order_events_stream;

const handler = co.wrap(function* (event, context, cb) {
  let body = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  let restaurantName = body.restaurantName;
  let orderId = body.orderId;
  let userEmail = body.userEmail;

  correlationIds.set('order-id', orderId);
  correlationIds.set('restaurant-name', restaurantName);
  correlationIds.set('user-email', userEmail);

  log.debug('restaurant has fulfilled order', { orderId, restaurantName, userEmail });

  let data = {
    orderId,
    userEmail,
    restaurantName,
    eventType: 'order_fulfilled'
  }

  let kinesisReq = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: streamName
  };

  yield cloudwatch.trackExecTime(
    "KinesisPutRecordLatency", 
    () => kinesis.putRecord(kinesisReq).promise()
  );

  log.debug(`published event into Kinesis`, { eventName: 'order_fulfilled' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  }

  cb(null, response);
});

module.exports.handler = wrapper(handler);