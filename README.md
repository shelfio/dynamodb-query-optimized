# dynamodb-query-optimized [![CircleCI](https://circleci.com/gh/shelfio/dynamodb-query-optimized/tree/master.svg?style=svg)](https://circleci.com/gh/shelfio/dynamodb-query-optimized/tree/master)![](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)

> 2x faster DynamoDB queries when you need to query 2+ MB of data

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

For now, it supports `aws-sdk` v2. Feel free to submit a PR to support `aws-sdk` v3!

### Optimized query for 2+ MB of data

Queries DDB from both ends of the query in parallel. Stops and returns results when the middle is reached.

```js
import {queryOptimized} from '@shelf/dynamodb-query-optimized';
import DynamoDB from 'aws-sdk/clients/dynamodb';

const ddb = new DynamoDB.DocumentClient({region: 'us-east-1'});

const results = await queryOptimized({
  queryFunction: ddb.query.bind(ddb),
  queryParams: {
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
    KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
    ExpressionAttributeNames: {
      '#hash_key': 'hash_key',
      '#range_key': 'range_key',
    },
    ExpressionAttributeValues: {
      ':hash_key': hash_key,
      ':range_key': range_key,
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
import DynamoDB from 'aws-sdk/clients/dynamodb';

const ddb = new DynamoDB.DocumentClient({region: 'us-east-1'});

const results = await queryRegular({
  queryFunction: ddb.query.bind(ddb),
  queryParams: {
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
    KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
    ExpressionAttributeNames: {
      '#hash_key': 'hash_key',
      '#range_key': 'range_key',
    },
    ExpressionAttributeValues: {
      ':hash_key': hash_key,
      ':range_key': range_key,
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
