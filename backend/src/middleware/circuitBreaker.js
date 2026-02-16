/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures in external dependencies
 */

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 1 minute
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn, fallback = null) {
    // Check if circuit should transition
    this._checkState();
    
    if (this.state === 'OPEN') {
      // Circuit is open, return fallback or throw error
      if (fallback) {
        return await fallback();
      }
      throw new Error(`Circuit breaker ${this.name} is OPEN. Service unavailable.`);
    }
    
    try {
      // Execute the function
      const result = await fn();
      
      // Success - reset failure count if in HALF_OPEN
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 2) {
          this._reset();
        }
      } else {
        // In CLOSED state, reset failure count on success
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      // Failure - increment counter
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      // Check if threshold exceeded
      if (this.failureCount >= this.failureThreshold) {
        this._open();
      }
      
      // If fallback provided, use it
      if (fallback) {
        return await fallback();
      }
      
      throw error;
    }
  }

  /**
   * Open the circuit
   */
  _open() {
    this.state = 'OPEN';
    this.nextAttemptTime = Date.now() + this.resetTimeout;
    console.warn(`⚠️  Circuit breaker ${this.name} opened. Next attempt: ${new Date(this.nextAttemptTime).toISOString()}`);
  }

  /**
   * Close the circuit
   */
  _reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
    console.log(`✅ Circuit breaker ${this.name} closed (reset)`);
  }

  /**
   * Check and update circuit state
   */
  _checkState() {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() >= this.nextAttemptTime) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        console.log(`🔄 Circuit breaker ${this.name} half-open (testing)`);
      }
    }
  }

  /**
   * Get circuit breaker status
   */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      isHealthy: this.state === 'CLOSED'
    };
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    this._reset();
  }
}

// Circuit breaker instances for different services
const circuitBreakers = {
  squareAPI: new CircuitBreaker('SquareAPI', {
    failureThreshold: 5,
    resetTimeout: 60000
  }),
  
  fileProcessing: new CircuitBreaker('FileProcessing', {
    failureThreshold: 3,
    resetTimeout: 30000
  }),
  
  database: new CircuitBreaker('Database', {
    failureThreshold: 10,
    resetTimeout: 30000
  })
};

/**
 * Middleware to wrap route handlers with circuit breaker
 */
function circuitBreakerMiddleware(breakerName) {
  return async (req, res, next) => {
    const breaker = circuitBreakers[breakerName];
    
    if (!breaker) {
      return next();
    }
    
    try {
      // Store original send function
      const originalSend = res.send.bind(res);
      
      // Wrap response to track success/failure
      res.send = function(data) {
        if (res.statusCode >= 400) {
          breaker.failureCount++;
        } else {
          breaker.failureCount = 0;
        }
        return originalSend(data);
      };
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Get all circuit breaker statuses
 */
function getCircuitBreakerStatuses() {
  return Object.keys(circuitBreakers).reduce((acc, key) => {
    acc[key] = circuitBreakers[key].getStatus();
    return acc;
  }, {});
}

module.exports = {
  CircuitBreaker,
  circuitBreakers,
  circuitBreakerMiddleware,
  getCircuitBreakerStatuses
};
