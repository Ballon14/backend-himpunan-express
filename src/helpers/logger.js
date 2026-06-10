const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'app.log');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Standard log formatter and writer
 * @param {string} level - 'info' | 'warn' | 'error'
 * @param {string} message - Description of the log event
 * @param {object|null} meta - Additional context metadata
 */
function log(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaString}\n`;
    
    // Output to the terminal output console
    if (level === 'error') {
        console.error(logLine.trim());
    } else {
        console.log(logLine.trim());
    }

    try {
        fs.appendFileSync(logFile, logLine);
    } catch (err) {
        console.error('CRITICAL: Failed to write to log file:', err);
    }
}

module.exports = {
    info: (message, meta = null) => log('info', message, meta),
    warn: (message, meta = null) => log('warn', message, meta),
    error: (message, meta = null) => log('error', message, meta),
    getLogFile: () => logFile
};
