'use strict';

const AWSXRay        = require('aws-xray-sdk');
const AWS            = AWSXRay.captureAWS(require('aws-sdk'));
const SNS            = new AWS.SNS();
const correlationIds = require('./correlation-ids');

function addCorrelationIds(messageAttributes) {
  let attributes = {};
  let context = correlationIds.get();
  for (let key in context) {
    attributes[key] = {
      DataType: 'String',
      StringValue: context[key]
    };
  }

  // use `attribtues` as base so if the user's message attributes would override
  // our correlation IDs
  return Object.assign(attributes, messageAttributes || {});
}

function publish(params, cb) {
  const newMessageAttributes = addCorrelationIds(params.MessageAttributes);
  params = Object.assign(params, { MessageAttributes: newMessageAttributes });

  return SNS.publish(params, cb);
};

const client = Object.assign({}, SNS, { publish });

module.exports = client;