'use strict';

const _          = require('lodash');
const co         = require('co');
const sns        = require('./sns');
const kinesis    = require('./kinesis');
const chance     = require('chance').Chance();
const log        = require('./log');
const cloudwatch = require('./cloudwatch');

const streamName         = process.env.order_events_stream;
const restaurantTopicArn = process.env.restaurant_notification_topic;
const userTopicArn       = process.env.user_notification_topic;

let notifyRestaurantOfOrder = co.wrap(function* (order) {
  try {
    if (chance.bool({likelihood: 75})) { // 75% chance of failure
      throw new Error("boom");
    }

    let snsReq = {
      Message: JSON.stringify(order),
      TopicArn: restaurantTopicArn
    };
    yield cloudwatch.trackExecTime(
      "SnsPublishLatency",
      () => sns.publish(snsReq).promise()
    );

    let logContext = {
      orderId: order.orderId,
      restaurantName: order.restaurantName,
      userEmail: order.userEmail
    };
    log.debug('notified restaurant of new order', logContext);

    let data = _.clone(order);
    data.eventType = 'restaurant_notified';

    let kinesisReq = {
      Data: JSON.stringify(data), // the SDK would base64 encode this for us
      PartitionKey: order.orderId,
      StreamName: streamName
    };
    yield cloudwatch.trackExecTime(
      "KinesisPutRecordLatency",
      () => kinesis.putRecord(kinesisReq).promise()
    );
    log.debug('published event into Kinesis', { eventName: 'restaurant_notified' });

    cloudwatch.incrCount('NotifyRestaurantSuccess');
  } catch (err) {
    cloudwatch.incrCount('NotifyRestaurantFailed');
    throw err;
  }
});

let notifyUserOfOrderAccepted = co.wrap(function* (order) {
  try {
    if (chance.bool({likelihood: 75})) { // 75% chance of failure
      throw new Error("boom");
    }
  
    let snsReq = {
      Message: JSON.stringify(order),
      TopicArn: userTopicArn
    };
    yield cloudwatch.trackExecTime(
      "SnsPublishLatency", 
      () => sns.publish(snsReq).promise()
    );
  
    let logContext = {
      orderId: order.orderId,
      restaurantName: order.restaurantName,
      userEmail: order.userEmail
    };
    log.debug('notified user of accepted order', logContext);
  
    let data = _.clone(order);
    data.eventType = 'user_notified';
  
    let kinesisReq = {
      Data: JSON.stringify(data), // the SDK would base64 encode this for us
      PartitionKey: order.orderId,
      StreamName: streamName
    };
    yield cloudwatch.trackExecTime(
      "KinesisPutRecordLatency",
      () => kinesis.putRecord(kinesisReq).promise()
    );
    log.debug(`published event into Kinesis`, { eventName: 'user_notified' });
  
    cloudwatch.incrCount('NotifyUserSuccess');
  } catch (err) {
    cloudwatch.incrCount('NotifyUserFailed');
    throw err;
  }
});

module.exports = {
  restaurantOfOrder: notifyRestaurantOfOrder,
  userOfOrderAccepted: notifyUserOfOrderAccepted
};