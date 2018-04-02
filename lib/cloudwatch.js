'use strict';

const co         = require('co');
const AWS        = require('aws-sdk');
const log        = require('./log');
const cloudwatch = new AWS.CloudWatch();

const namespace = 'big-mouth';

// the Lambda execution environment defines a number of env variables:
//    https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
// and the serverless framework also defines a STAGE env variable too
const dimensions = 
  [
    { Name: 'Function', Value: process.env.AWS_LAMBDA_FUNCTION_NAME	},
    { Name: 'Version', Value: process.env.AWS_LAMBDA_FUNCTION_VERSION	},
    { Name: 'Stage', Value: process.env.STAGE	}
  ]
  .filter(dim => dim.Value);

let countMetrics = {};
let timeMetrics  = {};

function getCountMetricData(name, value) {
  return {
    MetricName : name,
    Dimensions : dimensions,
    Unit       : 'Count',
    Value      : value
  };
}

function getTimeMetricData(name, statsValues) {
  return {
    MetricName      : name,
    Dimensions      : dimensions,
    Unit            : 'Milliseconds',
    StatisticValues : statsValues
  };
}

function getCountMetricDatum() {
  let keys = Object.keys(countMetrics);
  if (keys.length === 0) {
    return [];
  }

  let metricDatum = keys.map(key => getCountMetricData(key, countMetrics[key]));
  countMetrics = {}; // zero out the recorded count metrics
  return metricDatum;
}

function getTimeMetricDatum() {
  let keys = Object.keys(timeMetrics);
  if (keys.length === 0) {
    return [];
  }

  let metricDatum = keys.map(key => getTimeMetricData(key, timeMetrics[key]));
  timeMetrics = {}; // zero out the recorded time metrics
  return metricDatum;
}

let flush = co.wrap(function* () {
  let countDatum = getCountMetricDatum();
  let timeDatum  = getTimeMetricDatum();
  let allDatum   = countDatum.concat(timeDatum);

  if (allDatum.length == 0) { return; }

  let metricNames = allDatum.map(x => x.MetricName).join(',');
  log.debug(`flushing [${allDatum.length}] metrics to CloudWatch: ${metricNames}`);

  var params = {
    MetricData: allDatum,
    Namespace: namespace
  };

  try {
    yield cloudwatch.putMetricData(params).promise();
    log.debug(`flushed [${allDatum.length}] metrics to CloudWatch: ${metricNames}`);
  } catch (err) {
    log.warn(`cloudn't flush [${allDatum.length}] CloudWatch metrics`, null, err);
  }  
});

function clear() {
  countMetrics = {};
  timeMetrics = {};
}

function incrCount(metricName, count) {
  count = count || 1;

  if (countMetrics[metricName]) {
    countMetrics[metricName] += count;
  } else {
    countMetrics[metricName] = count;
  }
}

function recordTimeInMillis(metricName, ms) {
  if (!ms) {
    return;
  }

  log.debug(`new execution time for [${metricName}] : ${ms} milliseconds`);

  if (timeMetrics[metricName]) {
    let metric = timeMetrics[metricName];
    metric.Sum         += ms;
    metric.Maximum     = Math.max(metric.Maximum, ms);
    metric.Minimum     = Math.min(metric.Minimum, ms);
    metric.SampleCount += 1;
  } else {
    let statsValues = {
      Maximum     : ms,
      Minimum     : ms,
      SampleCount : 1,
      Sum         : ms
    };
    timeMetrics[metricName] = statsValues;
  }
}

function trackExecTime(metricName, f) {
  if (!f || typeof f !== "function") {
    throw new Error('cloudWatch.trackExecTime requires a function, eg. () => 42');
  }

  if (!metricName) {
    throw new Error('cloudWatch.trackExecTime requires a metric name, eg. "CloudSearch-latency"');
  }

  let start = new Date().getTime(), end;
  let res = f();
  
  // anything with a 'then' function can be considered a Promise...
  // http://stackoverflow.com/a/27746324/55074
  if (!res.hasOwnProperty('then')) {
    end = new Date().getTime();
    recordTimeInMillis(metricName, end-start);
    return res;
  } else {
    return res.then(x => {
      end = new Date().getTime();
      recordTimeInMillis(metricName, end-start);
      return x;
    });
  }
}

module.exports = {
  flush,
  clear,
  incrCount,
  trackExecTime,
  recordTimeInMillis
};