# dynamodb-query-optimized [![CircleCI](https://circleci.com/gh/shelfio/dynamodb-query-optimized/tree/master.svg?style=svg)](https://circleci.com/gh/shelfio/dynamodb-query-optimized/tree/master)![](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)

> 2x faster DynamoDB queries when you need to query 2+ MB of data

Read the blog post article explaining how it works: https://vladholubiev.medium.com/how-to-speed-up-long-dynamodb-queries-by-2x-c66a2987d53a

## Install

```
$ yarn add @shelf/dynamodb-query-optimized
```

## Benchmark

```
Regular query: <1 MB of items: 650ms
Optimized query: <1 MB of items: 704ms

Regular query: ~21 MB of items: 9.023s
Optimized query: ~21 MB of items: 4.988s # almost 2x faster
```

## Usage

The library targets the modular `@aws-sdk/client-dynamodb` v3 package. `queryOptimized` is the recommended entry point; the original implementation now ships as `queryOptimizedV1` for backwards compatibility.

### queryOptimized (recommended for 2+ MB of data)

Launches two parallel `QueryCommand` calls (forward and reverse) and stops when both sides meet in the middle, deduplicating items on the fly. Specify `uniqueIdentifierAttributes` if your table uses primary and sort key names different from the defaults `hash_key` and `range_key`.

```js
import {queryOptimized} from '@shelf/dynamodb-query-optimized';
import {DynamoDBClient, QueryCommand} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({region: 'us-east-1'});

const results = await queryOptimized({
  client,
  QueryCommand,
  queryParams: {
    TableName: 'example_table',
    KeyConditionExpression: '#pk = :pk AND begins_with(#sk, :sk)',
    ExpressionAttributeNames: {
      '#pk': 'pk',
      '#sk': 'sk',
    },
    ExpressionAttributeValues: {
      ':pk': {S: 'foo'},
      ':sk': {S: 'bar'},
    },
  },
  uniqueIdentifierAttributes: {
    primaryKey: 'pk',
    sortKey: 'sk',
  },
});

console.log(results);
/*
  [{pk: 'foo', sk: 'bar'}, {pk: 'foo', sk: 'baz'}]
 */
```

### queryOptimizedV1 (legacy signature)

Queries DDB from both ends of the query in parallel. Stops and returns results when the middle is reached.

```js
import {queryOptimizedV1} from '@shelf/dynamodb-query-optimized';
import {DynamoDBClient, QueryCommand} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({region: 'us-east-1'});

const results = await queryOptimizedV1({
  client,
  QueryCommand,
  queryParams: {
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
    KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
    ExpressionAttributeNames: {
      '#hash_key': 'hash_key',
      '#range_key': 'range_key',
    },
    ExpressionAttributeValues: {
      ':hash_key': {S: 'foo'},
      ':range_key': {S: 'bar'},
    },
  },
});

console.log(results);
/*
  [{hash_key: 'foo', range_key: 'bar'}, {hash_key: 'foo', range_key: 'baz'}]
 */
```

### Regular query for <2 MB of data

Queries DDB and continues to paginate through all results until query is exhausted.

```js
import {queryRegular} from '@shelf/dynamodb-query-optimized';
import {DynamoDBClient, QueryCommand} from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({region: 'us-east-1'});

const results = await queryRegular({
  client,
  QueryCommand,
  queryParams: {
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
    KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
    ExpressionAttributeNames: {
      '#hash_key': 'hash_key',
      '#range_key': 'range_key',
    },
    ExpressionAttributeValues: {
      ':hash_key': {S: 'foo'},
      ':range_key': {S: 'bar'},
    },
  },
});

console.log(results);
/*
  [{hash_key: 'foo', range_key: 'bar'}, {hash_key: 'foo', range_key: 'baz'}]
 */
```

## Publish

```sh
$ git checkout master
$ yarn version
$ yarn publish
$ git push origin master --tags
```

## License

MIT © [Shelf](https://shelf.io)
