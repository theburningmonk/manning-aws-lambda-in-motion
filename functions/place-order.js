'use strict';

const _          = require('lodash');
const co         = require('co');
const AWS        = require('aws-sdk');
const kinesis    = new AWS.Kinesis();
const chance     = require('chance').Chance();
const log        = require('../lib/log');

const middy         = require('middy');
const sampleLogging = require('../middleware/sample-logging');

const streamName = process.env.order_events_stream;

const UNAUTHORIZED = {
  statusCode: 401,
  body: "unauthorized"
}

const handler = co.wrap(function* (event, context, cb) {
  let req = JSON.parse(event.body);
  log.debug(`request body is valid JSON`, { requestBody: event.body });

  let userEmail = _.get(event, 'requestContext.authorizer.claims.email');
  if (!userEmail) {
    cb(null, UNAUTHORIZED);
    log.error('unauthorized request, user email is not provided');

    return;
  }

  let restaurantName = req.restaurantName;
  let orderId = chance.guid();
  log.debug(`placing order...`, { orderId, restaurantName, userEmail });

  let data = {
    orderId,
    userEmail,
    restaurantName,
    eventType: 'order_placed'
  }

  let kinesisReq = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: streamName
  };

  yield kinesis.putRecord(kinesisReq).promise();

  log.debug(`published event into Kinesis`, { eventName: 'order_placed' });

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  }

  cb(null, response);
});

module.exports.handler = middy(handler)
  .use(sampleLogging({ sampleRate: 0.01 }));