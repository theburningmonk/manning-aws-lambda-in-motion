'use strict';

const co = require('co');
const Promise = require('bluebird');
const aws4 = require('../../lib/aws4');

let initialized = false;

let init = co.wrap(function* () {
  if (initialized) {
    return;
  }

  process.env.STAGE = 'dev';
  process.env.restaurants_table = "restaurants";
  process.env.AWS_REGION = "us-east-1";
  process.env.cognito_server_client_id = "niv7esuaibla0tj5q36b6mvnr";
  process.env.AWS_XRAY_CONTEXT_MISSING = "LOG_ERROR";

  yield aws4.init();

  initialized = true;
});

module.exports.init = init;