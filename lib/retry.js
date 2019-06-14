const sns = require('./sns')
const log = require('./log')
const cloudwatch = require('./cloudwatch')

const restaurantRetryTopicArn = process.env.restaurant_notification_retry_topic
const userRetryTopicArn = process.env.user_notification_retry_topic

async function retryRestaurantNotification(order) {
  const snsReq = {
    Message: JSON.stringify(order),
    TopicArn: restaurantRetryTopicArn
  }
  await cloudwatch.trackExecTime(
    'SnsPublishLatency',
    () => sns.publish(snsReq).promise()
  )

  const logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail
  }
  log.debug('queued restaurant notification for retry', logContext)

  cloudwatch.incrCount('NotifyRestaurantQueued')
}

async function retryUserNotification(order) {
  const snsReq = {
    Message: JSON.stringify(order),
    TopicArn: userRetryTopicArn
  }
  await cloudwatch.trackExecTime(
    'SnsPublishLatency',
    () => sns.publish(snsReq).promise()
  )

  const logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail
  }
  log.debug('queued user notification for retry', logContext)

  cloudwatch.incrCount('NotifyUserQueued')
}

module.exports = {
  restaurantNotification: retryRestaurantNotification,
  userNotification: retryUserNotification
}
