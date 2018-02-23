'use strict';

const _       = require('lodash');
const co      = require('co');
const AWS     = require('aws-sdk');
const sns     = new AWS.SNS();
const kinesis = new AWS.Kinesis();
const chance  = require('chance').Chance();

const streamName         = process.env.order_events_stream;
const restaurantTopicArn = process.env.restaurant_notification_topic;
const userTopicArn       = process.env.user_notification_topic;

let notifyRestaurantOfOrder = co.wrap(function* (order) {
  if (chance.bool({likelihood: 75})) { // 75% chance of failure
    throw new Error("boom");
  }

  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantTopicArn
  };
  yield sns.publish(snsReq).promise();
  console.log(`notified restaurant [${order.restaurantName}] of order [${order.orderId}]`);

  let data = _.clone(order);
  data.eventType = 'restaurant_notified';

  let kinesisReq = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: order.orderId,
    StreamName: streamName
  };
  yield kinesis.putRecord(kinesisReq).promise();
  console.log(`published 'restaurant_notified' event to Kinesis`);
});

let notifyUserOfOrderAccepted = co.wrap(function* (order) {
  if (chance.bool({likelihood: 75})) { // 75% chance of failure
    throw new Error("boom");
  }

  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: userTopicArn
  };
  yield sns.publish(snsReq).promise();
  console.log(`notified user [${order.userEmail}] of order [${order.orderId}] being accepted`);

  let data = _.clone(order);
  data.eventType = 'user_notified';

  let kinesisReq = {
    Data: JSON.stringify(data), // the SDK would base64 encode this for us
    PartitionKey: order.orderId,
    StreamName: streamName
  };
  yield kinesis.putRecord(kinesisReq).promise();
  console.log(`published 'user_notified' event to Kinesis`);
});

module.exports = {
  restaurantOfOrder: notifyRestaurantOfOrder,
  userOfOrderAccepted: notifyUserOfOrderAccepted
};