'use strict';

const co  = require('co');
const AWS = require('aws-sdk');
const sns = new AWS.SNS();

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic;
const userRetryTopicArn       = process.env.user_notification_retry_topic;

let retryRestaurantNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
  };
  yield sns.publish(snsReq).promise();
  console.log(`order [${order.orderId}]: queued restaurant notification for retry`);
});

let retryUserNotification = co.wrap(function* (order) {
  let snsReq = {
    Message: JSON.stringify(order),
    TopicArn: userRetryTopicArn
  };
  yield sns.publish(snsReq).promise();
  console.log(`order [${order.orderId}]: queued user notification for retry`);
});

module.exports = {
  restaurantNotification: retryRestaurantNotification,
  userNotification: retryUserNotification
};