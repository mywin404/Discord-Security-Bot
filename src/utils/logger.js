const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOGS_DIR, 'bot.log');


if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function writeToFile(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

const colors = {
  reset: '\x1b[0m',
  info: '\x1b[36m', 
  warn: '\x1b[33m', 
  error: '\x1b[31m', 
  debug: '\x1b[90m'  
};

module.exports = {
  info(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.info}[${timestamp}] [INFO]${colors.reset} ${message}`);
    writeToFile('info', message);
  },
  warn(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.warn(`${colors.warn}[${timestamp}] [WARN]${colors.reset} ${message}`);
    writeToFile('warn', message);
  },
  error(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.error(`${colors.error}[${timestamp}] [ERROR]${colors.reset} ${message}`);
    writeToFile('error', message);
  },
  debug(message) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`${colors.debug}[${timestamp}] [DEBUG]${colors.reset} ${message}`);
    writeToFile('debug', message);
  }
};
