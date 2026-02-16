/**
 * Script to import Tequila's Town menu and inventory to Square Catalog
 * 
 * Usage:
 *   node scripts/import-menu.js [menu|inventory|all]
 * 
 * Options:
 *   menu      - Import only menu items (default)
 *   inventory - Import only inventory items (spices, ingredients)
 *   all       - Import both menu and inventory
 * 
 * Requirements:
 *   - SQUARE_ACCESS_TOKEN in .env file
 *   - ITEMS_WRITE permission on the access token
 *   - JSON files in backend/data/ directory
 */

require('dotenv').config();
const squareService = require('../src/services/squareService');

const importType = process.argv[2] || 'menu';

async function importMenu() {
  console.log('🚀 Starting Tequila\'s Town Menu Import to Square...\n');
  
  // Check if access token is configured
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    console.error('❌ Error: SQUARE_ACCESS_TOKEN not found in .env file');
    process.exit(1);
  }
  
  console.log(`📍 Environment: ${process.env.SQUARE_ENVIRONMENT || 'sandbox'}`);
  console.log(`🔑 Access Token: ${process.env.SQUARE_ACCESS_TOKEN.substring(0, 10)}...\n`);
  
  try {
    const result = await squareService.importMenuToSquare();
    
    console.log('\n✅ Menu import completed!');
    console.log('\n📋 Summary:');
    console.log(`   Batches processed: ${result.totalBatches}`);
    console.log(`   Objects imported: ${result.successfulObjects}/${result.totalObjects}`);
    
    if (result.failedObjects > 0) {
      console.log(`\n⚠️  Some objects failed to import: ${result.failedObjects}`);
      console.log('   Check the results array for details.');
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Verify items in Square Dashboard: https://squareupsandbox.com/dashboard → Items');
    console.log('   2. Sync from Square in the application to load the new menu items');
    console.log('   3. Create test orders in Square to see sales data\n');
    
    return result;
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    
    if (error.message.includes('permission') || error.message.includes('ITEMS_WRITE')) {
      console.error('\n💡 Tip: Make sure your Square Access Token has ITEMS_WRITE permission.');
      console.error('   Check your permissions in Square Developer Portal:');
      console.error('   https://developer.squareup.com/apps\n');
    }
    
    throw error;
  }
}

async function importInventory() {
  console.log('🧂 Starting Inventory Items Import to Square...\n');
  
  // Check if access token is configured
  if (!process.env.SQUARE_ACCESS_TOKEN) {
    console.error('❌ Error: SQUARE_ACCESS_TOKEN not found in .env file');
    process.exit(1);
  }
  
  console.log(`📍 Environment: ${process.env.SQUARE_ENVIRONMENT || 'sandbox'}`);
  console.log(`🔑 Access Token: ${process.env.SQUARE_ACCESS_TOKEN.substring(0, 10)}...\n`);
  
  try {
    const result = await squareService.importInventoryToSquare();
    
    console.log('\n✅ Inventory import completed!');
    console.log('\n📋 Summary:');
    console.log(`   Batches processed: ${result.totalBatches}`);
    console.log(`   Items imported: ${result.successfulObjects}/${result.totalObjects}`);
    
    if (result.failedObjects > 0) {
      console.log(`\n⚠️  Some items failed to import: ${result.failedObjects}`);
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Verify inventory items in Square Dashboard: https://squareupsandbox.com/dashboard → Items');
    console.log('   2. Set initial inventory quantities in Square');
    console.log('   3. Configure low stock alerts for critical items\n');
    
    return result;
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    throw error;
  }
}

async function importAll() {
  console.log('🚀 Starting Complete Import (Menu + Inventory) to Square...\n');
  
  try {
    // Import menu first
    console.log('📋 Step 1/2: Importing menu items...\n');
    const menuResult = await importMenu();
    
    console.log('\n⏳ Waiting 1 second before next import...\n');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then import inventory
    console.log('🧂 Step 2/2: Importing inventory items...\n');
    const inventoryResult = await importInventory();
    
    console.log('\n✅ Complete import finished!');
    console.log('\n📊 Overall Summary:');
    console.log(`   Menu items: ${menuResult.successfulObjects}/${menuResult.totalObjects}`);
    console.log(`   Inventory items: ${inventoryResult.successfulObjects}/${inventoryResult.totalObjects}`);
    console.log(`   Total imported: ${menuResult.successfulObjects + inventoryResult.successfulObjects} items\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Run the import based on argument
async function main() {
  try {
    switch (importType.toLowerCase()) {
      case 'menu':
        await importMenu();
        process.exit(0);
        break;
      case 'inventory':
        await importInventory();
        process.exit(0);
        break;
      case 'all':
        await importAll();
        break;
      default:
        console.error(`❌ Unknown import type: ${importType}`);
        console.error('Usage: node scripts/import-menu.js [menu|inventory|all]');
        process.exit(1);
    }
  } catch (error) {
    process.exit(1);
  }
}

main();
