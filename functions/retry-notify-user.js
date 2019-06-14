const notify = require('../lib/notify')
const log = require('../lib/log')
const cloudwatch = require('../lib/cloudwatch')
const wrapper = require('../middleware/wrapper')

const flushMetrics = require('../middleware/flush-metrics')

const handler = async (event, context, cb) => {
  let order = JSON.parse(event.Records[0].Sns.Message)
  order.retried = true

  let logContext = {
    orderId: order.orderId,
    restaurantName: order.restaurantName,
    userEmail: order.userEmail,
    retry: true
  }

  let error
  try {
    await notify.userOfOrderAccepted(order)
  } catch (err) {
    log.warn('failed to notify user of accepted order', logContext, err)
    error = err
  } finally {
    cloudwatch.incrCount('NotifyUserRetried')
  }
  if (error) return error
  return 'all done'
}

module.exports.handler = wrapper(handler)
  .use(flushMetrics)
