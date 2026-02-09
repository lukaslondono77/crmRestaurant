/**
 * Test script to verify profile endpoint is working
 */

const axios = require('axios');
require('dotenv').config({ path: './.env' });

const API_BASE_URL = `http://localhost:${process.env.PORT || 8000}/api`;

async function testProfileEndpoint() {
  console.log('🧪 Testing Profile Endpoint...\n');
  
  // Test 1: Health check
  console.log('1. Testing health check...');
  try {
    const healthResponse = await axios.get(`${API_BASE_URL}/healthz`);
    console.log('   ✅ Health check OK:', healthResponse.data);
  } catch (error) {
    console.error('   ❌ Health check failed:', error.message);
    console.error('   Make sure the backend server is running: cd backend && npm start');
    process.exit(1);
  }
  
  // Test 2: Check if endpoint exists (without auth - should get 401, not 404)
  console.log('\n2. Testing /api/users/profile without auth...');
  try {
    await axios.get(`${API_BASE_URL}/users/profile`);
    console.log('   ⚠️  Unexpected: Got response without auth');
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const contentType = error.response.headers['content-type'] || '';
      
      if (status === 401) {
        console.log('   ✅ Endpoint exists! Got 401 Unauthorized (expected)');
      } else if (status === 404) {
        console.error('   ❌ Endpoint NOT FOUND (404)');
        console.error('   The route /api/users/profile is not registered.');
        console.error('   Make sure:');
        console.error('     1. The server has been restarted after route changes');
        console.error('     2. userRoutes.js is correctly loaded in server.js');
        console.error('     3. The route /profile exists in userRoutes.js');
      } else {
        console.log(`   ⚠️  Got status ${status} (expected 401)`);
      }
      
      if (contentType.includes('text/html')) {
        console.error('   ❌ Server returned HTML instead of JSON');
        console.error('   This means the route is not registered correctly.');
      }
    } else {
      console.error('   ❌ Network error:', error.message);
    }
  }
  
  // Test 3: List all registered routes (if possible)
  console.log('\n3. Route registration check...');
  console.log('   Route should be: GET /api/users/profile');
  console.log('   Defined in: backend/src/routes/userRoutes.js (line 9)');
  console.log('   Mounted in: backend/src/server.js (line 97: app.use(\'/api/users\', userRoutes))');
  
  console.log('\n✅ Test completed. If endpoint returns 404, restart the server.');
}

testProfileEndpoint().catch(console.error);
