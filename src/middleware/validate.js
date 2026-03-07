const { validationResult } = require('express-validator');
const { errorResponse } = require('../helpers/response');

/**
 * Validation middleware — runs after express-validator checks.
 * Returns first error in consistent format.
 */
function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formatted = {};
        errors.array().forEach((err) => {
            if (!formatted[err.path]) {
                formatted[err.path] = err.msg;
            }
        });
        return errorResponse(res, 'Validasi gagal.', 422, formatted);
    }
    next();
}

module.exports = validate;
