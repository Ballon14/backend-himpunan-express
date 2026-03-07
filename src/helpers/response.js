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

module.exports = { successResponse, errorResponse };
