require('dotenv').config();

const config = {
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || '',
    to: process.env.EMAIL_TO || '',
  },
  paths: {
    data: process.env.DATA_DIR || './data',
    output: process.env.OUTPUT_DIR || './output',
    logs: process.env.LOGS_DIR || './logs',
  },
};

module.exports = config;
