const AWSXRay = require('aws-xray-sdk')
const AWS = AWSXRay.captureAWS(require('aws-sdk'))
const dynamodb = new AWS.DynamoDB.DocumentClient()
const log = require('../lib/log')
const cloudwatch = require('../lib/cloudwatch')
const wrapper = require('../middleware/wrapper')

const defaultResults = process.env.defaultResults || 8
const tableName = process.env.restaurants_table

async function getRestaurants(count) {
  const params = {
    TableName: tableName,
    Limit: count
  }

  let resp = await cloudwatch.trackExecTime(
    'DynamoDBScanLatency',
    () => dynamodb.scan(params).promise()
  )
  return resp.Items
}

const handler = async (event, context, cb) => {
  let restaurants = await getRestaurants(defaultResults)
  log.debug(`loaded ${restaurants.length} restaurants`)

  cloudwatch.incrCount('RestaurantsReturned', restaurants.length)

  let response = {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  }

  return response
}

module.exports.handler = wrapper(handler)
