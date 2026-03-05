/**
 * Centralized response formatter.
 * Ensures consistent API response structure across all endpoints.
 */

/**
 * Send success response.
 * @param {import('express').Response} res
 * @param {*} data - Response payload
 * @param {Object} [options]
 * @param {number} [options.status=200]
 * @param {Object} [options.metadata] - Optional metadata (e.g. pagination, timing)
 */
export function success(res, data, options = {}) {
  const { status = 200, metadata } = options;
  const payload = {
    success: true,
    ...(metadata && { metadata }),
    data,
  };
  res.status(status).json(payload);
}

/**
 * Send error response.
 * @param {import('express').Response} res
 * @param {string} message - Error message
 * @param {Object} [options]
 * @param {number} [options.status=500]
 * @param {string} [options.requestId]
 * @param {*} [options.details] - Additional error details
 */
export function error(res, message, options = {}) {
  const { status = 500, requestId, details } = options;
  const payload = {
    success: false,
    error: {
      message,
      ...(requestId && { requestId }),
      ...(details && { details }),
    },
  };
  res.status(status).json(payload);
}

/**
 * Send paginated success response.
 * @param {import('express').Response} res
 * @param {Array} items - Array of items
 * @param {Object} pagination
 * @param {number} pagination.page - Current page (1-based)
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total items
 */
export function paginated(res, items, { page, limit, total }) {
  const totalPages = Math.ceil(total / limit) || 1;
  success(res, items, {
    metadata: {
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    },
  });
}
