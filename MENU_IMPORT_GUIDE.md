# Tequila's Town Menu Import Guide

## 📋 Overview

This guide explains how to import the complete Tequila's Town restaurant menu to Square Sandbox. The menu includes:

- **12 Categories**: Appetizers, So Mexican, Soups & Salads, Tex Mex/Bowls, Street Tacos, House Specials, Seafoo, Parrillada, Little Amigos, Desserts, Sides, Drinks
- **25+ Menu Items**: With variations, prices, SKUs, and descriptions
- **Complete Structure**: Ready for Square Catalog API

## 🚀 Quick Start

### Option 1: Using the API Endpoint (Recommended)

```bash
# Start your backend server first
cd backend
npm run dev

# In another terminal, import the menu
curl -X POST http://localhost:8000/api/square/import-menu \
  -H "Content-Type: application/json"
```

### Option 2: Using the Script Directly

```bash
cd backend
node scripts/import-menu.js
```

## 📁 File Structure

```
backend/
├── data/
│   └── tequilas_town_menu.json    # Complete menu data
├── scripts/
│   └── import-menu.js              # Import script
└── src/
    └── services/
        └── squareService.js        # Import method
```

## ⚙️ Configuration

### Required Environment Variables

Make sure your `.env` file has:

```env
SQUARE_ACCESS_TOKEN=your_sandbox_access_token
SQUARE_ENVIRONMENT=sandbox
SQUARE_LOCATION_ID=your_location_id
```

### Required Permissions

Your Square Access Token needs:
- **ITEMS_WRITE** - To create/update catalog items
- **ITEMS_READ** - To verify import success

## 📊 Menu Structure

### Categories Included

1. **APPETIZERS** - Empanadas, Plátano Macho, Nachos Macho Supremo, Table-side Guacamole
2. **SO MEXICAN** - Tortas, Sopes
3. **SOUPS & SALADS** - Sopa Azteca, Mexican César Salad
4. **TEX MEX / BOWLS** - Quesadillas, California Burrito
5. **STREET STYLE TACOS** - Tacos de Camarón, Tacos al Pastor, Tacos de la Casa
6. **HOUSE SPECIALS** - Mole Poblano, Chile Relleno
7. **SEAFOOD** - Camarónes a la Diabla
8. **PARRILLADA** - Fajitas (with multiple variations)
9. **LITTLE AMIGOS** - Kids Taco
10. **DESSERTS** - Flan, Churros con Chocolate
11. **SIDES** - Guac Dip Salad, Rice & Beans
12. **DRINKS** - Horchata, Mexican Coca-Cola

### Item Features

- ✅ **Pricing**: All prices in cents (USD)
- ✅ **SKUs**: Unique SKU codes for inventory tracking
- ✅ **Variations**: Size options, protein choices, etc.
- ✅ **Descriptions**: Menu item descriptions
- ✅ **Categories**: Properly categorized for organization

## 🔄 How the Import Works

1. **Reads JSON File**: Loads `tequilas_town_menu.json` from `backend/data/`
2. **Processes in Batches**: Square API requires batches (we have multiple batches)
3. **Uses Batch Upsert**: Creates or updates items (idempotent operation)
4. **Maps IDs**: Square returns permanent IDs mapped to our temporary IDs
5. **Error Handling**: Continues with next batch even if one fails

## 📝 Import Response

The import returns a summary:

```json
{
  "success": true,
  "message": "Menu imported to Square successfully",
  "data": {
    "totalBatches": 12,
    "totalObjects": 50,
    "successfulObjects": 48,
    "failedObjects": 2,
    "results": [
      {
        "batch": 1,
        "success": true,
        "objectsProcessed": 12,
        "idMappings": 12
      },
      ...
    ]
  }
}
```

## ✅ Verification Steps

After importing:

1. **Check Square Dashboard**:
   - Go to https://squareupsandbox.com/dashboard
   - Navigate to **Items** section
   - Verify all categories and items are present

2. **Test in Your App**:
   - Sync from Square in the application
   - Check that menu items appear in inventory
   - Verify prices and SKUs are correct

3. **Create Test Orders**:
   - Use Square POS or API to create test orders
   - Verify sales data syncs correctly

## 🔧 Troubleshooting

### Error: "ITEMS_WRITE permission required"

**Solution**: 
1. Go to Square Developer Portal
2. Find your application
3. Ensure `ITEMS_WRITE` permission is enabled
4. Regenerate access token if needed

### Error: "Invalid JSON format"

**Solution**: 
- Check that `backend/data/tequilas_town_menu.json` is valid JSON
- Run: `node -e "JSON.parse(require('fs').readFileSync('data/tequilas_town_menu.json'))"`

### Error: "Rate limit exceeded"

**Solution**:
- The script includes a 500ms delay between batches
- If you hit rate limits, increase the delay in `squareService.js`

### No items appear after import

**Possible Causes**:
- Items were created but not visible in dashboard (refresh)
- Location ID mismatch (items created for different location)
- Check Square Dashboard → Items → All Items

## 📚 API Reference

### Endpoint: `POST /api/square/import-menu`

**Headers**:
```
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "message": "Menu imported to Square successfully",
  "data": {
    "totalBatches": 12,
    "totalObjects": 50,
    "successfulObjects": 48,
    "failedObjects": 2,
    "results": [...]
  }
}
```

## 🎯 Next Steps

After successful import:

1. **Sync Sales Data**: Use "Sync from Square" in the app to load the menu
2. **Set Initial Inventory**: Use Square Dashboard or API to set stock quantities
3. **Create Test Orders**: Generate test orders to populate sales data
4. **Configure Modifiers**: Add modifier lists if needed (spicy level, add-ons, etc.)

## 📞 Support

If you encounter issues:

1. Check Square Developer Logs: https://developer.squareup.com/apps → Logs
2. Verify API permissions in Square Developer Portal
3. Review backend logs for detailed error messages
4. Test with Square API Explorer: https://developer.squareup.com/explorer

---

**Note**: This import is designed for Square Sandbox. For production, ensure you:
- Use production access tokens
- Test thoroughly in sandbox first
- Have proper error handling and rollback procedures
- Back up existing catalog before import
