/**
 * Pagination Utility Functions
 * Provides consistent pagination across all list endpoints
 */

/**
 * Parse pagination parameters from query string or filters object.
 * Accepts either req (uses req.query) or a plain object with page/limit.
 */
function parsePaginationParams(reqOrParams, defaultLimit = 50, maxLimit = 100) {
  const q = (reqOrParams && typeof reqOrParams.query === 'object' && reqOrParams.query !== null)
    ? reqOrParams.query
    : (reqOrParams || {});
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(q.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/**
 * Calculate pagination metadata
 */
function calculatePagination(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1
  };
}

/**
 * Format paginated response
 */
function formatPaginatedResponse(items, total, pagination, additionalData = {}) {
  return {
    items,
    pagination: calculatePagination(total, pagination.page, pagination.limit),
    ...additionalData
  };
}

/**
 * Build count query from select query
 */
function buildCountQuery(selectQuery) {
  // Extract the FROM clause and WHERE clause from the SELECT query
  const fromMatch = selectQuery.match(/FROM\s+[\w]+\s*(?:AS\s+[\w]+\s*)?(?:WHERE\s+.*)?$/i);
  if (fromMatch) {
    return `SELECT COUNT(*) as total ${fromMatch[0]}`;
  }
  // Fallback: replace SELECT ... with SELECT COUNT(*)
  return selectQuery.replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) as total FROM');
}

module.exports = {
  parsePaginationParams,
  calculatePagination,
  formatPaginatedResponse,
  buildCountQuery
};
