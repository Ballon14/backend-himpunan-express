/**
 * Standard API response helpers — mirrors the Laravel ApiResponse trait.
 * Format: { success: boolean, message: string, data: any }
 */

function successResponse(res, data = null, message = 'Success', code = 200) {
    return res.status(code).json({
        success: true,
        message,
        data,
    });
}

function errorResponse(res, message = 'Error', code = 400, data = null) {
    return res.status(code).json({
        success: false,
        message,
        data,
    });
}

/**
 * Parse and clamp pagination parameters to safe values.
 * Prevents abuse via per_page=999999 which could dump entire tables.
 * @param {object} query - req.query object
 * @param {number} defaultPerPage - default items per page (default: 15)
 * @param {number} maxPerPage - maximum allowed per_page (default: 100)
 * @returns {{ limit: number, offset: number, page: number }}
 */
function parsePagination(query, defaultPerPage = 15, maxPerPage = 100) {
    const page = Math.max(parseInt(query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(query.per_page) || defaultPerPage, 1), maxPerPage);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
}

module.exports = { successResponse, errorResponse, parsePagination };
