'use strict';

const co  = require('co');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();
const log = require('./log');

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic;
const userRetryTopicArn       = process.env.user_notification_retry_topic;

let retryRestaurantNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
  };
  yield sns.publish(snsReq).promise();

  let logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail
  };
  log.debug('queued restaurant notification for retry', logContext);
});

let retryUserNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: userRetryTopicArn
  };
  yield sns.publish(snsReq).promise();

  let logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail
  };
  log.debug('queued user notification for retry', logContext);
});

module.exports = {
  restaurantNotification: retryRestaurantNotification,
  userNotification: retryUserNotification
};