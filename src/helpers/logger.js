const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../../logs');
const logFile = path.join(logDir, 'app.log');
const auditFile = path.join(logDir, 'audit.jsonl'); // structured audit trail

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Fields that must never appear in audit detail snapshots
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'old_password', 'new_password', 'confirm_password'];

/**
 * Strip sensitive fields from a body object and truncate long values
 * so the audit log stays readable and safe.
 */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return null;
    const clean = {};
    for (const [key, value] of Object.entries(body)) {
        if (SENSITIVE_FIELDS.includes(key)) continue;
        if (value === undefined || value === null || value === '') continue;
        // Truncate very long strings (e.g. base64 images, HTML content)
        if (typeof value === 'string' && value.length > 200) {
            clean[key] = value.substring(0, 200) + '…';
        } else {
            clean[key] = value;
        }
    }
    return Object.keys(clean).length > 0 ? clean : null;
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

/**
 * Write a structured audit entry to the JSONL audit file AND the plain log.
 * @param {string} action  - e.g. 'membuat', 'memperbarui', 'menghapus', 'login', 'logout'
 * @param {string} resource - e.g. 'anggota', 'berita', 'auth'
 * @param {object} req     - Express request (used for actor, ip, method, path)
 * @param {object|null} meta - extra info: { resourceId, changes }
 */
function audit(action, resource, req, meta = null) {
    const actor = meta?.actor || req.user?.name || req.user?.email || 'Unknown user';
    const resourceLabel = resource || 'data';
    const resourceId = meta?.resourceId || null;

    // Build structured audit record
    const record = {
        timestamp: new Date().toISOString(),
        actor,
        action,
        resource: resourceLabel,
        resourceId,
        ip: req.ip,
        method: req.method,
        path: req.originalUrl || req.url,
        changes: sanitizeBody(meta?.changes || req.body) || undefined,
    };

    // Write JSON line to audit file
    try {
        fs.appendFileSync(auditFile, JSON.stringify(record) + '\n');
    } catch (err) {
        console.error('CRITICAL: Failed to write audit log:', err);
    }

    // Also write a human-readable line to the main log
    const idLabel = resourceId ? ` (id: ${resourceId})` : '';
    const context = {
        actor,
        method: record.method,
        path: record.path,
        ip: record.ip,
    };
    if (resourceId) context.resourceId = resourceId;
    log('info', `${actor} ${action} ${resourceLabel}${idLabel}`, context);
}

/**
 * Read the audit JSONL file and return an array of parsed objects,
 * most-recent first. Supports optional limit.
 */
function readAuditLogs(limit = 200) {
    try {
        if (!fs.existsSync(auditFile)) return [];
        const data = fs.readFileSync(auditFile, 'utf8').trim();
        if (!data) return [];
        const lines = data.split('\n').filter(Boolean);
        const parsed = lines
            .map(line => {
                try { return JSON.parse(line); } catch { return null; }
            })
            .filter(Boolean);
        return parsed.slice(-limit).reverse();
    } catch (err) {
        console.error('Failed to read audit logs:', err);
        return [];
    }
}

module.exports = {
    info: (message, meta = null) => log('info', message, meta),
    warn: (message, meta = null) => log('warn', message, meta),
    error: (message, meta = null) => log('error', message, meta),
    audit,
    readAuditLogs,
    getLogFile: () => logFile,
    getAuditFile: () => auditFile,
};
