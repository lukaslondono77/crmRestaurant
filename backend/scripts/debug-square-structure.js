/**
 * Script to debug Square API response structure
 * This helps identify why item names appear as "Unknown"
 */

require('dotenv').config();
const https = require('https');

const token = process.env.SQUARE_ACCESS_TOKEN;
const baseUrl = process.env.SQUARE_ENVIRONMENT === 'production' 
  ? 'https://connect.squareup.com' 
  : 'https://connect.squareupsandbox.com';

async function debugSquareStructure() {
  console.log('🔍 Fetching Square catalog to debug structure...\n');
  
  const url = new URL('/v2/catalog/list', baseUrl);
  url.searchParams.append('types', 'ITEM,ITEM_VARIATION');
  
  return new Promise((resolve) => {
    https.get(url.toString(), {
      headers: {
        'Square-Version': '2024-01-18',
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (result.objects && result.objects.length > 0) {
            console.log(`📦 Total objects: ${result.objects.length}\n`);
            
            // Find first ITEM
            const firstItem = result.objects.find(obj => obj.type === 'ITEM');
            if (firstItem) {
              console.log('📋 First ITEM structure:');
              console.log(JSON.stringify(firstItem, null, 2).substring(0, 1000));
              console.log('\n');
              
              console.log('🔑 Keys in firstItem:', Object.keys(firstItem));
              console.log('🔑 Keys in firstItem.itemData:', firstItem.itemData ? Object.keys(firstItem.itemData) : 'itemData is null/undefined');
              console.log('📝 firstItem.itemData?.name:', firstItem.itemData?.name);
              console.log('📝 firstItem.name:', firstItem.name);
            }
            
            // Find first ITEM_VARIATION
            const firstVariation = result.objects.find(obj => obj.type === 'ITEM_VARIATION');
            if (firstVariation) {
              console.log('\n📋 First ITEM_VARIATION structure:');
              console.log(JSON.stringify(firstVariation, null, 2).substring(0, 500));
            }
            
            // Count items with names
            const itemsWithNames = result.objects.filter(obj => 
              obj.type === 'ITEM' && 
              (obj.itemData?.name || obj.name)
            );
            
            console.log(`\n✅ Items with names: ${itemsWithNames.length}/${result.objects.filter(o => o.type === 'ITEM').length}`);
            
            if (itemsWithNames.length > 0) {
              console.log('\n📝 Sample items with names:');
              itemsWithNames.slice(0, 5).forEach(item => {
                console.log(`   - ${item.itemData?.name || item.name} (ID: ${item.id?.substring(0, 20)}...)`);
              });
            }
          } else {
            console.log('❌ No objects found in response');
          }
          
          resolve(result);
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          console.log('Raw response (first 500 chars):', data.substring(0, 500));
          resolve(null);
        }
      });
    }).on('error', (error) => {
      console.error('❌ Request error:', error.message);
      resolve(null);
    });
  });
}

debugSquareStructure();
