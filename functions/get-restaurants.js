'use strict';

const co         = require('co');
const AWS        = require('aws-sdk');
const dynamodb   = new AWS.DynamoDB.DocumentClient();
const apiHandler = require('../lib/apiHandler');

const defaultResults = process.env.defaultResults || 8;
const tableName      = process.env.restaurants_table;

function* getRestaurants(count) {
  let req = {
    TableName : tableName,
    Limit : count
  };

  console.log(req);
  let resp = yield dynamodb.scan(req).promise();
  return resp.Items;
}

module.exports.handler = apiHandler(co.wrap(function* (event, context) {
  let restaurants = yield getRestaurants(defaultResults);
  
  return {
    statusCode: 200,
    body: JSON.stringify(restaurants)
  };
}));