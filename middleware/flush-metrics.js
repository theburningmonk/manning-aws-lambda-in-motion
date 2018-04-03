'use strict';

const log        = require('../lib/log');
const cloudwatch = require('../lib/cloudwatch');

module.exports = {
  after: (handler, next) => {
    cloudwatch.flush().then(_ => next());
  },
  onError: (handler, next) => {
    cloudwatch.flush().then(_ => next(handler.error));
  }
};