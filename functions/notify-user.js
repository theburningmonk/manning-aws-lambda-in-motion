const notify = require('../lib/notify')
const retry = require('../lib/retry')
const log = require('../lib/log')
const wrapper = require('../middleware/wrapper')

const flushMetrics = require('../middleware/flush-metrics')

const handler = async (event, context, cb) => {
  let events = context.parsedKinesisEvents
  let orderAccepted = events.filter(r => r.eventType === 'order_accepted')
  log.debug(`found ${orderAccepted.length} 'order_accepted' events`)

  for (let order of orderAccepted) {
    order.scopeToThis()

    try {
      await notify.userOfOrderAccepted(order)
    } catch (err) {
      await retry.userNotification(order)

      let logContext = {
        orderId: order.orderId,
        restaurantName: order.restaurantName,
        userEmail: order.userEmail
      }
      log.warn('failed to notify user of accepted order', logContext, err)
    }

    order.unscope()
  }

  return 'all done'
}

module.exports.handler = wrapper(handler)
  .use(flushMetrics)
