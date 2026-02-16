/**
 * Request Timeout Middleware
 * Configurable timeouts for different endpoint types
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const UPLOAD_TIMEOUT = 300000; // 5 minutes
const ANALYTICS_TIMEOUT = 60000; // 1 minute for complex queries

function getTimeoutForPath(path) {
  if (path.includes('/upload')) {
    return UPLOAD_TIMEOUT;
  }
  if (path.includes('/analytics') || path.includes('/dashboard')) {
    return ANALYTICS_TIMEOUT;
  }
  return DEFAULT_TIMEOUT;
}

function timeoutMiddleware(req, res, next) {
  const timeout = getTimeoutForPath(req.path);
  
  // Set request timeout
  req.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: `Request timeout after ${timeout}ms`,
          timeout: timeout,
          path: req.path
        }
      });
    }
  });
  
  // Set response timeout
  res.setTimeout(timeout, () => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: {
          code: 'RESPONSE_TIMEOUT',
          message: `Response timeout after ${timeout}ms`,
          timeout: timeout,
          path: req.path
        }
      });
    }
  });
  
  next();
}

module.exports = timeoutMiddleware;
