/**
 * Script to set initial inventory counts in Square
 * 
 * Usage:
 *   node scripts/set-initial-inventory.js
 */

require('dotenv').config();
const squareService = require('../src/services/squareService');

async function setInventory() {
  console.log('📦 Setting Initial Inventory Counts in Square...\n');
  
  // Check if access token is configured
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    console.error('❌ Error: SQUARE_ACCESS_TOKEN not found in .env file');
    process.exit(1);
  }
  
  if (!process.env.SQUARE_LOCATION_ID) {
    console.error('❌ Error: SQUARE_LOCATION_ID not found in .env file');
    console.error('   Please add SQUARE_LOCATION_ID to your .env file');
    process.exit(1);
  }
  
  console.log(`📍 Environment: ${process.env.SQUARE_ENVIRONMENT || 'sandbox'}`);
  console.log(`🏪 Location ID: ${process.env.SQUARE_LOCATION_ID.substring(0, 10)}...\n`);
  
  try {
    const result = await squareService.setInitialInventoryCounts();
    
    console.log('\n✅ Inventory counts set successfully!');
    console.log('\n📋 Summary:');
    console.log(`   Total items: ${result.totalItems}`);
    console.log(`   Successful: ${result.successfulItems}`);
    if (result.failedItems > 0) {
      console.log(`   Failed: ${result.failedItems}`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Verify inventory in Square Dashboard: https://squareupsandbox.com/dashboard → Items → Inventory');
    console.log('   2. Check low stock alerts are working');
    console.log('   3. Test recipes API to see cost calculations\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Failed to set inventory counts:', error.message);
    
    if (error.message.includes('permission') || error.message.includes('INVENTORY_WRITE')) {
      console.error('\n💡 Tip: Make sure your Square Access Token has INVENTORY_WRITE permission.');
      console.error('   Check your permissions in Square Developer Portal:\n');
      console.error('   https://developer.squareup.com/apps\n');
    }
    
    if (error.message.includes('LOCATION_ID')) {
      console.error('\n💡 Tip: Add SQUARE_LOCATION_ID to your .env file.');
      console.error('   You can find your location ID in Square Dashboard → Settings → Locations\n');
    }
    
    process.exit(1);
  }
}

// Run the script
setInventory();
