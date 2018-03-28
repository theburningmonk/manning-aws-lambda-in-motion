'use strict';

const co         = require('co');
const AWS        = require('aws-sdk');
const kinesis    = new AWS.Kinesis();
const log        = require('../lib/log');

const streamName = process.env.order_events_stream;

module.exports.handler = co.wrap(function* (event, context, cb) {
  let req = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  let restaurantName = req.restaurantName;
  let orderId = req.orderId;
  let userEmail = req.userEmail;

  log.debug('restaurant accepted order', { orderId, restaurantName, userEmail });

  let data = {
    orderId,
    userEmail,
    restaurantName,
    eventType: 'order_accepted'
  }

  let kinesisReq = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: streamName
  };

  yield kinesis.putRecord(kinesisReq).promise();

  log.debug(`published event into Kinesis`, { eventName: 'order_accepted' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  }

  cb(null, response);
});