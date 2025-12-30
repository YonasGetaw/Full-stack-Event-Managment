const config = require('./env');
const logger = require('../utils/logger');

const getEmailConfig = () => {
  if (config.nodeEnv === 'development') {
    logger.info('Running in development mode - emails will be logged instead of sent');
    return {
      enabled: false,
      mode: 'development'
    };
  }

  return {
    enabled: true,
    mode: 'production',
    smtp: config.smtp
  };
};

module.exports = getEmailConfig;
