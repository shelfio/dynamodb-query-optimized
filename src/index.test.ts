import {marshall} from '@aws-sdk/util-dynamodb';
import {QueryCommand} from '@aws-sdk/client-dynamodb';
import {insertMany} from './helpers/insert-many';
import {deleteAll} from './helpers/delete-all';
import {ddb} from './helpers/ddb';
import {queryOptimized, queryRegular} from './';

const hash_key = 'some-hash-key';
const range_key = 'some-range-key';
const getRangeKey = (range: number) => `${range_key}-${range}`;
jest.setTimeout(120000);

beforeAll(async () => {
  const listToInsert = [];

  // Each item is approx. 3.6 KB
  // We insert approx. 10.5 MB of data with hash_key: 'some-hash-key'
  // and ~0.9 Mb of data with hash_key: 'some-hash-key-1mb'
  for (let i = 0; i < 3250; i++) {
    listToInsert.push({
      hash_key: i >= 3000 ? 'some-hash-key-1mb' : hash_key,
      range_key: getRangeKey(i),
      name: 'hello',
      description: 'hello world',
      foo: 'hello world '.repeat(100),
      bar: 'hello world '.repeat(100),
      baz: 'hello world '.repeat(100),
    });
  }

  await insertMany({
    TableName: 'example_table',
    Items: listToInsert,
  });
});

it(`should return all elements using optimized find query for 10 MB table`, async () => {
  const result = await testQueryOptimized('some-hash-key');

  expect(result).toHaveLength(3000);
});

it(`should return all elements using regular find query for 10 MB table`, async () => {
  const result = await testQueryRegular('some-hash-key');

  expect(result).toHaveLength(3000);
});

it(`should return all elements using optimized find query for 1 MB table`, async () => {
  const result = await testQueryOptimized('some-hash-key-1mb');

  expect(result).toHaveLength(250);
});

it(`should return all elements using regular find query for 1 MB table`, async () => {
  const result = await testQueryRegular('some-hash-key-1mb');

  expect(result).toHaveLength(250);
});

afterAll(async () => {
  await deleteAll({
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
  });
});

function testQueryRegular(hash_key: string) {
  return queryRegular({
    QueryCommand: QueryCommand,
    client: ddb,
    queryParams: {
      TableName: 'example_table',
      ProjectionExpression: 'hash_key, range_key',
      KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
      ExpressionAttributeNames: {
        '#hash_key': 'hash_key',
        '#range_key': 'range_key',
      },
      ExpressionAttributeValues: marshall({
        ':hash_key': hash_key,
        ':range_key': range_key,
      }),
    },
  });
}

function testQueryOptimized(hash_key: string) {
  return queryOptimized({
    QueryCommand: QueryCommand,
    client: ddb,
    queryParams: {
      TableName: 'example_table',
      ProjectionExpression: 'hash_key, range_key',
      KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range_key)',
      ExpressionAttributeNames: {
        '#hash_key': 'hash_key',
        '#range_key': 'range_key',
      },
      ExpressionAttributeValues: marshall({
        ':hash_key': hash_key,
        ':range_key': range_key,
      }),
    },
  });
}
