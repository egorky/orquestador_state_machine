const getTimestamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

const log = (level, message, context = {}) => {
    const { sessionId, callerId } = context;
    const timestamp = getTimestamp();

    let logPrefix = `[${timestamp}]`;
    if (sessionId) {
        logPrefix += ` [SID: ${sessionId}]`;
    }
    if (callerId) {
        logPrefix += ` [CID: ${callerId}]`;
    }

    const logMessage = `${logPrefix} [${level.toUpperCase()}] ${message}`;

    if (level === 'error' || level === 'warn') {
        console.error(logMessage);
    } else {
        console.log(logMessage);
    }
};

const logger = {
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),
    debug: (message, context) => {
        if (process.env.LOG_LEVEL === 'debug') {
            log('debug', message, context);
        }
    },
};

module.exports = logger;
