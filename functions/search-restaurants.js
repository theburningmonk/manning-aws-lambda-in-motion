const AWSXRay = require('aws-xray-sdk')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
const dynamodb = new AWS.DynamoDB.DocumentClient()
const log = require('../lib/log')
const cloudwatch = require('../lib/cloudwatch')
const wrapper = require('../middleware/wrapper')

const defaultResults = process.env.defaultResults || 8
const tableName = process.env.restaurants_table

async function findRestaurantsByTheme(theme, count) {
  let req = {
    TableName: tableName,
    Limit: count,
    FilterExpression: 'contains(themes, :theme)',
    ExpressionAttributeValues: { ':theme': theme }
  }

  let resp = await cloudwatch.trackExecTime(
    'DynamoDBScanLatency',
    () => dynamodb.scan(req).promise()
  )
  return resp.Items
}

const handler = async (event, context, cb) => {
  let req = JSON.parse(event.body)
  log.debug(`request body is valid JSON`, { requestBody: event.body })

  let restaurants = await findRestaurantsByTheme(req.theme, defaultResults)
  log.debug(`found ${restaurants.length} restaurants`)

  cloudwatch.incrCount('RestaurantsFound', restaurants.length)

  const response = {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  }

  return response
}

module.exports.handler = wrapper(handler)
