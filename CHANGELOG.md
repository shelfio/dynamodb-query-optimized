# Breaking Changes

## 4.1.0
- Switch to lodash-es
- Setup ESM build

## 4.0.0

- Rebuilt `queryOptimized` for the modular `@aws-sdk/client-dynamodb` v3 API; supply a `DynamoDBClient`, `QueryCommand`, and `uniqueIdentifierAttributes` so results dedupe on your table's primary/sort keys.
- Exported the previous DocumentClient version as `queryOptimizedV1` (deprecated) for teams that still rely on the legacy signature.
- Extended the optimized query path to tables without a sort key and added performance coverage to guard the ~2x speedup claim.

## 3.0.0

- Switched `node` version `18`->`22`
