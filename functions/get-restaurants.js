'use strict';

const co         = require('co');
const AWSXRay    = require('aws-xray-sdk');
const AWS        = AWSXRay.captureAWS(require('aws-sdk'));
const dynamodb   = new AWS.DynamoDB.DocumentClient();
const log        = require('../lib/log');
const cloudwatch = require('../lib/cloudwatch');

const middy         = require('middy');
const sampleLogging = require('../middleware/sample-logging');

const defaultResults = process.env.defaultResults || 8;
const tableName      = process.env.restaurants_table;

function* getRestaurants(count) {
  let req = {
    TableName: tableName,
    Limit: count
  };

  let resp = yield cloudwatch.trackExecTime(
    "DynamoDBScanLatency",
    () => dynamodb.scan(req).promise()
  );
  return resp.Items;
}

const handler = co.wrap(function* (event, context, cb) {
  let restaurants = yield getRestaurants(defaultResults);
  log.debug(`loaded ${restaurants.length} restaurants`);

  cloudwatch.incrCount("RestaurantsReturned", restaurants.length);

  let response = {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  }

  cb(null, response);
});

module.exports.handler = middy(handler)
  .use(sampleLogging({ sampleRate: 0.01 }));