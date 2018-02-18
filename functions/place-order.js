'use strict';

const _          = require('lodash');
const co         = require('co');
const AWS        = require('aws-sdk');
const kinesis    = new AWS.Kinesis();
const chance     = require('chance').Chance();
const streamName = process.env.order_events_stream;

const UNAUTHORIZED = {
  statusCode: 401,
  body: "unauthorized"
}

module.exports.handler = co.wrap(function* (event, context, cb) {
  let restaurantName = JSON.parse(event.body).restaurantName;

  let userEmail = _.get(event, 'requestContext.authorizer.claims.email');
  if (!userEmail) {
    cb(null, UNAUTHORIZED);
    return;
  }

  let orderId = chance.guid();
  console.log(`placing order ID [${orderId}] to [${restaurantName}] for user [${userEmail}]`);

  let data = {
    orderId,
    userEmail,
    restaurantName,
    eventType: 'order_placed'
  }

  let req = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: orderId,
    StreamName: streamName
  };

  yield kinesis.putRecord(req).promise();

  console.log(`published 'order_placed' event into Kinesis`);

  let response = {
    statusCode: 200,
    body: JSON.stringify({ orderId })
  }

  cb(null, response);
});