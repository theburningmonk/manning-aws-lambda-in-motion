'use strict';

const FuncShield = require('@puresec/function-shield');

module.exports = () => {
  return {
    before: (handler, next) => {
      FuncShield.configure({
        policy: {
          outbound_connectivity: "block",
          read_write_tmp: "block", 
          create_child_process: "block"
        },
        token: process.env.FUNCTION_SHIELD_TOKEN
      });

      next();
    }
  };
};