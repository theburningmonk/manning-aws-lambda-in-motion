'use strict';

const co         = require('co');
const sns        = require('./sns');
const log        = require('./log');
const cloudwatch = require('./cloudwatch');

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic;
const userRetryTopicArn       = process.env.user_notification_retry_topic;

let retryRestaurantNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
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
  log.debug('queued restaurant notification for retry', logContext);

  cloudwatch.incrCount("NotifyRestaurantQueued");
});

let retryUserNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: userRetryTopicArn
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
  log.debug('queued user notification for retry', logContext);

  cloudwatch.incrCount("NotifyUserQueued");
});

module.exports = {
  restaurantNotification: retryRestaurantNotification,
  userNotification: retryUserNotification
};