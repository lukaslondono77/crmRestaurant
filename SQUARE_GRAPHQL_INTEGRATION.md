# Square GraphQL Integration

## Overview

The system now uses **Square GraphQL API** as the primary method for fetching catalog data, with REST API as a fallback. GraphQL is more efficient because it allows fetching items with prices, categories, and variations in a single query.

## Benefits of GraphQL vs REST

1. **Single Query**: Get items + prices + categories + variations in one request
2. **Less Over-fetching**: Request only the fields you need
3. **Better Performance**: Fewer round trips to Square servers
4. **Type Safety**: GraphQL schema ensures correct data structure

## How It Works

### Method Priority

The `getCatalogItems()` method tries methods in this order:

1. **GraphQL API** (`/public/graphql`)
   - Gets merchant ID from `currentMerchant` query if not provided
   - Queries catalog with inline fragments for `CatalogItem` type
   - Retrieves items with variations and prices in one query

2. **REST API** (`/v2/catalog/list`) - Fallback
   - Traditional REST endpoint
   - Gets items and variations separately
   - Used if GraphQL fails or isn't available

3. **Simulated Data** - Final fallback
   - If both API methods fail
   - Uses predefined restaurant menu items for demonstration

## GraphQL Query Structure

```graphql
query GetCatalogItems($merchantId: ID!) {
  catalog(
    filter: {
      merchantId: { equalToAnyOf: [$merchantId] }
      type: { equalToAnyOf: [ITEM] }
    }
  ) {
    nodes {
      id
      ... on CatalogItem {
        name
        description
        category {
          name
        }
        variations {
          id
          name
          price {
            amount
            currency
          }
        }
      }
    }
  }
}
```

## Implementation Details

### File: `backend/src/services/squareService.js`

#### `getCatalogItems()`
- Tries GraphQL first
- Falls back to REST if GraphQL fails
- Returns empty array if both fail (triggers simulated data)

#### `getCatalogItemsRest(baseUrl, token, resolveCallback)`
- Fallback method using REST API
- Maintains backward compatibility
- Same error handling as before

## Environment Variables

Required in `.env`:
- `SQUARE_ACCESS_TOKEN` - Your Square access token
- `SQUARE_ENVIRONMENT` - `sandbox` or `production`
- `SQUARE_MERCHANT_ID` - Optional (will be fetched from `currentMerchant` if not provided)

## Required Permissions

Your Square Access Token needs:
- **ITEMS_READ** - To read catalog items
- **MERCHANT_PROFILE_READ** - To get merchant ID from `currentMerchant`

## Error Handling

The implementation gracefully handles errors:
- GraphQL errors → Falls back to REST
- REST errors → Returns empty array → Uses simulated data
- Network errors → Same fallback chain
- Permission errors → Logs helpful messages about required permissions

## Testing

To test if GraphQL is working:

1. Check backend logs when syncing from Square
2. Look for: `✅ Found X catalog items from Square (using GraphQL API)`
3. If you see REST API message, GraphQL failed and REST was used
4. If you see simulated data, both APIs failed (likely permission issue)

## Adding Items to Square Catalog

1. Go to Square Dashboard:
   - Sandbox: https://squareupsandbox.com/dashboard
   - Production: https://squareup.com/dashboard

2. Navigate to **Items** section

3. Add your restaurant menu items:
   - Name
   - Price
   - Category (optional)
   - Description (optional)
   - Variations (sizes, options, etc.)

4. The system will automatically use these items when syncing

## GraphQL Explorer

Square provides a GraphQL Explorer for testing queries:

- **Sandbox**: https://developer.squareup.com/explorer/square/graphql-explorer
- Requires authentication
- Useful for testing queries before implementing

## References

- [Square GraphQL Basics](https://developer.squareup.com/docs/devtools/graphql/graphql-basics)
- [Square GraphQL Schema](https://developer.squareup.com/docs/devtools/graphql)
- [GraphQL Query Examples](https://developer.squareup.com/docs/devtools/graphql/query-examples)

## Future Improvements

Possible enhancements:
- Use GraphQL for other operations (inventory, orders, payments)
- Implement GraphQL subscriptions for real-time updates
- Cache GraphQL responses for better performance
- Add pagination support for large catalogs
