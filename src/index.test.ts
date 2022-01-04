import {insertMany} from './helpers/insert-many';
import {deleteAll} from './helpers/delete-all';
import {ddb} from './helpers/ddb';
import {queryOptimized} from './';

const hash_key = 'some-hash-key';
const range_key = 'some-range-key';
const getRangeKey = (range: number) => `${range_key}-${range}`;
jest.setTimeout(120000);

beforeEach(async () => {
  const listToInsert = [];

  for (let i = 0; i < 3000; i++) {
    listToInsert.push({
      hash_key,
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

it(`should return all elements using optimized find query`, async () => {
  const result = await queryOptimized({
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

  expect(result).toHaveLength(3000);
});

// normally, I'd write a test comparing performance of regular vs optimized find
// but local ddb works different than the real one. findOptimized is slower locally, but ~50% faster when querying the real DB

afterEach(async () => {
  await deleteAll({
    TableName: 'example_table',
    ProjectionExpression: 'hash_key, range_key',
  });
});
