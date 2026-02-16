/**
 * Environment Configuration Validation
 * Ensures all required environment variables are set
 */

const path = require('path');
// Load .env from backend/ (server.js loads first; this ensures env.js works when required standalone)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const requiredEnvVars = {
  JWT_SECRET: {
    required: true,
    description: 'Secret key for JWT token signing',
    minLength: 32,
    generateCommand: 'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  },
  PORT: {
    required: false,
    default: 8000,
    description: 'Server port number'
  },
  NODE_ENV: {
    required: false,
    default: 'development',
    description: 'Environment (development, production, test)'
  }
};

const optionalEnvVars = {
  ALLOWED_ORIGINS: {
    description: 'Comma-separated list of allowed CORS origins',
    example: 'http://localhost:3000,https://app.example.com'
  },
  DATABASE_PATH: {
    description: 'Path to SQLite database file',
    default: './database/restaurant_cost.db'
  }
};

function validateEnvironment() {
  const errors = [];
  const warnings = [];
  
  // Check required variables
  Object.entries(requiredEnvVars).forEach(([key, config]) => {
    const value = process.env[key];
    
    if (config.required && !value) {
      errors.push({
        variable: key,
        message: `${key} is required but not set`,
        description: config.description,
        ...(config.generateCommand && { generateCommand: config.generateCommand })
      });
    } else if (value && config.minLength && value.length < config.minLength) {
      warnings.push({
        variable: key,
        message: `${key} is too short (minimum ${config.minLength} characters)`,
        description: config.description
      });
    }
  });
  
  // Set defaults for optional variables
  Object.entries(requiredEnvVars).forEach(([key, config]) => {
    if (!config.required && !process.env[key] && config.default !== undefined) {
      process.env[key] = config.default;
    }
  });
  
  // Display errors
  if (errors.length > 0) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED\n');
    errors.forEach(err => {
      console.error(`   ${err.variable}: ${err.message}`);
      console.error(`   Description: ${err.description}`);
      if (err.generateCommand) {
        console.error(`   Generate with: ${err.generateCommand}`);
      }
      console.error('');
    });
    console.error('   Create a .env file in the backend/ directory with these variables.\n');
    process.exit(1);
  }
  
  // Display warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  ENVIRONMENT WARNINGS\n');
    warnings.forEach(warn => {
      console.warn(`   ${warn.variable}: ${warn.message}`);
      console.warn(`   Description: ${warn.description}\n`);
    });
  }
  
  if (errors.length === 0) {
    console.log('✅ Environment variables validated\n');
  }
}

// Run validation on module load
validateEnvironment();

module.exports = {
  validateEnvironment,
  requiredEnvVars,
  optionalEnvVars
};
