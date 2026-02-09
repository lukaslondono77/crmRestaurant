/**
 * Standardized Error Handler Middleware
 * Provides consistent error responses across all endpoints
 */

class ApiError extends Error {
  constructor(code, message, details = null, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.message = message;
    this.details = details;
    this.statusCode = statusCode;
  }
}

// Standard error codes
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  SQUARE_API_ERROR: 'SQUARE_API_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
};

/**
 * Format error response
 */
function formatErrorResponse(error, req) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  let details = error.details && typeof error.details === 'object' ? { ...error.details } : undefined;
  const suggestion = details && details.suggestion;
  if (details && suggestion !== undefined) {
    const { suggestion: _, ...rest } = details;
    details = Object.keys(rest).length ? rest : undefined;
  }
  if (!details && isDevelopment && error.stack) details = { stack: error.stack };
  const err = {
    code: error.code || ErrorCodes.INTERNAL_ERROR,
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };
  if (details) err.details = details;
  if (suggestion) err.suggestion = suggestion;
  return { success: false, error: err };
}

/**
 * Error handler middleware
 */
function errorHandler(err, req, res, next) {
  console.error('API Error:', {
    code: err.code,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl
  });

  // If it's an ApiError, use its status code
  const statusCode = err instanceof ApiError ? err.statusCode : 500;
  
  res.status(statusCode).json(formatErrorResponse(err, req));
}

/**
 * Async error wrapper - wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Validation helper
 */
function validateRequiredFields(data, requiredFields) {
  const missing = [];
  
  requiredFields.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  });
  
  if (missing.length > 0) {
    throw new ApiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      `Missing required fields: ${missing.join(', ')}`,
      { missingFields: missing },
      400
    );
  }
}

/**
 * Validate date range
 */
function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ApiError(
      ErrorCodes.MISSING_REQUIRED_FIELD,
      'Both startDate and endDate are required',
      { field: 'startDate, endDate' },
      400
    );
  }
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid date format. Use YYYY-MM-DD format',
      { startDate, endDate },
      400
    );
  }
  
  if (start > end) {
    throw new ApiError(
      ErrorCodes.INVALID_DATE_RANGE,
      'startDate must be before or equal to endDate',
      { startDate, endDate },
      400
    );
  }
}

/**
 * Format success response with optional metadata
 */
function formatSuccessResponse(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      ...meta
    }
  };
}

module.exports = {
  ApiError,
  ErrorCodes,
  errorHandler,
  asyncHandler,
  validateRequiredFields,
  validateDateRange,
  formatSuccessResponse
};
