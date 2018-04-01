'use strict';

const co         = require('co');
const AWS        = require('aws-sdk');
const kinesis    = new AWS.Kinesis();
const log        = require('../lib/log');

const middy         = require('middy');
const sampleLogging = require('../middleware/sample-logging');

const streamName = process.env.order_events_stream;

const handler = co.wrap(function* (event, context, cb) {
  let body = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  let restaurantName = body.restaurantName;
  let orderId = body.orderId;
  let userEmail = body.userEmail;

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

  yield kinesis.putRecord(kinesisReq).promise();

  log.debug(`published event into Kinesis`, { eventName: 'order_fulfilled' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  }

  cb(null, response);
});

module.exports.handler = middy(handler)
  .use(sampleLogging({ sampleRate: 0.01 }));