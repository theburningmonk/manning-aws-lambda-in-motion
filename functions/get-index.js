'use strict';

const co         = require("co");
const Promise    = require("bluebird");
const fs         = Promise.promisifyAll(require("fs"));
const Mustache   = require('mustache');
const http       = require('../lib/http');
const URL        = require('url');
const aws4       = require('../lib/aws4');
const log        = require('../lib/log');
const cloudwatch = require('../lib/cloudwatch');
const AWSXRay    = require('aws-xray-sdk');

const middy         = require('middy');
const { ssm }       = require('middy/middlewares');
const sampleLogging = require('../middleware/sample-logging');
const captureCorrelationIds = require('../middleware/capture-correlation-ids');

const STAGE     = process.env.STAGE;
const awsRegion = process.env.AWS_REGION;

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

var html;

function* loadHtml() {
  if (!html) {
    html = yield fs.readFileAsync('static/index.html', 'utf-8');
  }

  return html;
}

function* getRestaurants() {
  let url = URL.parse(process.env.restaurants_api);
  let opts = {
    host: url.hostname,
    path: url.pathname
  };

  aws4.sign(opts);

  let httpReq = http({
    uri: process.env.restaurants_api,
    headers: opts.headers
  });
  
  return new Promise((resolve, reject) => {
    let f = co.wrap(function* (subsegment) {
      if (subsegment) {
        subsegment.addMetadata('url', process.env.restaurants_api);  
      }

      try {
        let body = (yield httpReq).body;
        if (subsegment) {
          subsegment.close();
        }
        resolve(body);
      } catch (err) {
        if (subsegment) {
          subsegment.close(err);
        }
        reject(err);
      }
    });

    // the current sub/segment
    let segment = AWSXRay.getSegment();

    AWSXRay.captureAsyncFunc("getting restaurants", f, segment);
  });
}

const handler = co.wrap(function* (event, context, callback) {
  yield aws4.init();

  let template = yield loadHtml();
  log.debug("loaded HTML template");

  let restaurants = yield cloudwatch.trackExecTime(
    "GetRestaurantsLatency",
    () => getRestaurants()
  );
  log.debug(`loaded ${restaurants.length} restaurants`);

  let dayOfWeek = days[new Date().getDay()];
  let view = {
    dayOfWeek, 
    restaurants,
    awsRegion,
    cognitoUserPoolId: process.env.cognito_user_pool_id,
    cognitoClientId: process.env.cognito_client_id,
    searchUrl: `${process.env.restaurants_api}/search`,
    placeOrderUrl: `${process.env.orders_api}`
  };
  let html = Mustache.render(template, view);
  log.debug(`rendered HTML [${html.length} bytes]`);

  cloudwatch.incrCount('RestaurantsReturned', restaurants.length);

  const response = {
    statusCode: 200,
    body: html,
    headers: {
      'content-type': 'text/html; charset=UTF-8'
    }
  };

  callback(null, response);
});

module.exports.handler = middy(handler)
  .use(captureCorrelationIds({ sampleDebugLogRate: 0.01 }))
  .use(sampleLogging({ sampleRate: 0.01 }))
  .use(ssm({
    cache: true,
    names: {
      restaurants_api: `/bigmouth/${STAGE}/restaurants_api`,
      orders_api: `/bigmouth/${STAGE}/orders_api`,
      cognito_user_pool_id: `/bigmouth/${STAGE}/cognito_user_pool_id`,
      cognito_client_id: `/bigmouth/${STAGE}/cognito_client_id`
    }
  }));