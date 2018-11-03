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
const wrapper    = require('../middleware/wrapper');
const { ssm, secretsManager } = require('middy/middlewares');

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

function* getRestaurants(restaurantsApiUrl) {
  let url = URL.parse(restaurantsApiUrl);
  let opts = {
    host: url.hostname,
    path: url.pathname
  };

  aws4.sign(opts);

  let httpReq = http({
    uri: restaurantsApiUrl,
    headers: opts.headers
  });
  
  return new Promise((resolve, reject) => {
    let f = co.wrap(function* (subsegment) {
      if (subsegment) {
        subsegment.addMetadata('url', restaurantsApiUrl);
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
    () => getRestaurants(context.restaurants_api)
  );
  log.debug(`loaded ${restaurants.length} restaurants`);

  let dayOfWeek = days[new Date().getDay()];
  let view = {
    dayOfWeek, 
    restaurants,
    awsRegion,
    cognitoUserPoolId: context.cognito.user_pool_id,
    cognitoClientId: context.cognito.client_id,
    searchUrl: `${context.restaurants_api}/search`,
    placeOrderUrl: `${context.orders_api}`
  };
  let html = Mustache.render(template, view);
  log.debug(`rendered HTML [${html.length} bytes]`);

  // uncomment this to cause function to err
  // yield http({ uri: 'https://theburningmonk.com' });

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

module.exports.handler = wrapper(handler)
  .use(ssm({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000, // 3 mins
    setToContext: true,
    names: {
      restaurants_api: `/bigmouth/${STAGE}/restaurants_api`,
      orders_api: `/bigmouth/${STAGE}/orders_api`
    }
  }))
  .use(secretsManager({
    cache: true,
    cacheExpiryInMillis: 3 * 60 * 1000, // 3 mins
    secrets: {
      cognito: `/bigmouth/${STAGE}/cognito`
    }
  }));