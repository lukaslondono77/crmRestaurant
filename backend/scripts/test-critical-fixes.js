/**
 * Test Critical Fixes
 * Run this after implementing fixes to verify they work
 */

const http = require('http');

const tests = [
  {
    name: 'Environment Variables Validation',
    test: () => {
      try {
        require('../src/config/env');
        return { passed: true, message: 'Environment validation passed' };
      } catch (error) {
        return { passed: false, message: error.message };
      }
    }
  },
  {
    name: 'JWT Secret Validation',
    test: () => {
      require('dotenv').config();
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      
      if (!secret) {
        return { passed: false, message: 'JWT_SECRET not set' };
      }
      
      if (secret === 'your-secret-key-change-in-production') {
        return { passed: false, message: 'JWT_SECRET is still default value' };
      }
      
      if (secret.length < 32) {
        return { passed: false, message: 'JWT_SECRET is too short' };
      }
      
      return { passed: true, message: 'JWT_SECRET is properly configured' };
    }
  },
  {
    name: 'CORS Configuration',
    test: () => {
      require('dotenv').config();
      const allowedOrigins = process.env.ALLOWED_ORIGINS;
      if (!allowedOrigins && process.env.NODE_ENV === 'production') {
        return { passed: false, message: 'ALLOWED_ORIGINS not set for production' };
      }
      return { passed: true, message: 'CORS configuration exists' };
    }
  },
  {
    name: 'Server Health Check',
    test: (callback) => {
      require('dotenv').config();
      const options = {
        hostname: 'localhost',
        port: process.env.PORT || 8000,
        path: '/api/healthz',
        method: 'GET'
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          callback({ passed: true, message: 'Server is running' });
        } else {
          callback({ passed: false, message: `Server returned ${res.statusCode}` });
        }
      });
      
      req.on('error', (error) => {
        callback({ passed: false, message: `Server not running: ${error.message}` });
      });
      
      req.setTimeout(5000, () => {
        req.destroy();
        callback({ passed: false, message: 'Server health check timeout' });
      });
      
      req.end();
    }
  }
];

console.log('🧪 Testing Critical Fixes...\n');

let passed = 0;
let failed = 0;
let asyncTests = 0;
let asyncCompleted = 0;

tests.forEach((test, index) => {
  if (test.test.length === 0) {
    // Synchronous test
    const result = test.test();
    if (result.passed) {
      console.log(`✅ ${test.name}: ${result.message}`);
      passed++;
    } else {
      console.log(`❌ ${test.name}: ${result.message}`);
      failed++;
    }
  } else {
    // Asynchronous test
    asyncTests++;
    test.test((result) => {
      asyncCompleted++;
      if (result.passed) {
        console.log(`✅ ${test.name}: ${result.message}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: ${result.message}`);
        failed++;
      }
      
      if (asyncCompleted === asyncTests) {
        console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
        process.exit(failed > 0 ? 1 : 0);
      }
    });
  }
});

// For synchronous-only tests
if (asyncTests === 0) {
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}
