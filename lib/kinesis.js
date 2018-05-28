'use strict';

const _              = require('lodash');
const AWSXRay        = require('aws-xray-sdk');
const AWS            = AWSXRay.captureAWS(require('aws-sdk'));
const Kinesis        = new AWS.Kinesis();
const log            = require('./log');
const correlationIds = require('./correlation-ids');

function tryJsonParse(data) {
  if (!_.isString(data)) {
    return null;
  }

  try {
    return JSON.parse(data);
  } catch (err) {
    log.warn('only JSON string data can be modified to insert correlation IDs');
    return null;
  }
}

function addCorrelationIds(data) {
  // only do with with JSON string data
  const payload = tryJsonParse(data);
  if (!payload) {
    return data;
  }

  const context = correlationIds.get();  
  const newData = Object.assign({ __context__: context }, payload);
  return JSON.stringify(newData);
}

function putRecord(params, cb) {
  const newData = addCorrelationIds(params.Data);
  params = Object.assign({}, params, { Data: newData });

  return Kinesis.putRecord(params, cb);
};

const client = Object.assign({}, Kinesis, { putRecord });

module.exports = client;