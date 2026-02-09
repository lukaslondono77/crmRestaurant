/**
 * Script to check what items exist in Square
 * This helps debug why items might not be visible in dashboard
 */

require('dotenv').config();
const squareService = require('../src/services/squareService');

async function checkItems() {
  console.log('🔍 Checking items in Square...\n');
  
  try {
    // Get catalog items
    const catalogItems = await squareService.getCatalogItems();
    console.log(`\n📦 Catalog Items from getCatalogItems(): ${catalogItems.length}`);
    
    if (catalogItems.length > 0) {
      console.log('\nSample items:');
      catalogItems.slice(0, 10).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name || 'Unknown'} (ID: ${item.id?.substring(0, 20) || 'N/A'}...)`);
      });
    }
    
    // Get detailed catalog
    const detailedCatalog = await squareService.getDetailedCatalog();
    const items = detailedCatalog.items || [];
    
    console.log(`\n📋 Detailed Catalog Items: ${items.length}`);
    
    if (items.length > 0) {
      console.log('\nItems with details:');
      items.slice(0, 10).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item.name || 'Unknown'}`);
        console.log(`     ID: ${item.id?.substring(0, 30) || 'N/A'}...`);
        console.log(`     Variations: ${item.variations?.length || 0}`);
      });
    }
    
    console.log('\n💡 Si ves items aquí pero no en Square Dashboard:');
    console.log('   1. Refresca la página de Square Dashboard');
    console.log('   2. Verifica que estés en la vista correcta (Items, no Services)');
    console.log('   3. Limpia filtros de búsqueda');
    console.log('   4. Verifica que no estés en una vista de "Draft" o "Archived"');
    console.log('   5. Los items pueden tardar unos minutos en aparecer en el UI\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkItems();
