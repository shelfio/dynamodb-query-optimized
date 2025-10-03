import {performance} from 'node:perf_hooks';
import {marshall} from '@aws-sdk/util-dynamodb';
import {QueryCommand} from '@aws-sdk/client-dynamodb';
import type {QueryCommandInput} from '@aws-sdk/client-dynamodb';
import {insertMany} from './helpers/insert-many';
import {deleteMany} from './helpers/delete-all';
import {ddb} from './helpers/ddb';
import {queryOptimizedV2, queryRegular} from '.';

const TABLE_NAME = 'example_table';
const LARGE_DATA_HASH_KEY = 'perf-hash-large';
const SMALL_DATA_HASH_KEY = 'perf-hash-small';
const RANGE_PREFIX = 'perf-range';

const largeItems = createItems(LARGE_DATA_HASH_KEY, 10000);
const smallItems = createItems(SMALL_DATA_HASH_KEY, 20);
const insertedKeys = [...largeItems, ...smallItems].map(toKey);

jest.setTimeout(1 * 60 * 1000); // 1 minute

beforeAll(async () => {
  await insertMany({TableName: TABLE_NAME, Items: largeItems});
  await insertMany({TableName: TABLE_NAME, Items: smallItems});
});

afterAll(async () => {
  await deleteMany({TableName: TABLE_NAME, Keys: insertedKeys});
});

describe('query performance', () => {
  it('queryOptimizedV2 resolves 2x faster for multi-page workloads', async () => {
    const queryParams = makeQueryParams(LARGE_DATA_HASH_KEY);

    const regular = await measure(() => queryRegular({client: ddb, QueryCommand, queryParams}));

    const optimized = await measure(() =>
      queryOptimizedV2({client: ddb, QueryCommand, queryParams})
    );

    expect(regular.result).toHaveLength(10000);
    expect(optimized.result).toHaveLength(10000);

    console.log({regular: regular.duration, optimized: optimized.duration});

    expect(optimized.duration).toBeLessThanOrEqual(regular.duration / 2);
  });

  it('queryOptimizedV2 ~2x faster for single-page workloads', async () => {
    const queryParams = makeQueryParams(SMALL_DATA_HASH_KEY);

    const regular = await measure(() => queryRegular({client: ddb, QueryCommand, queryParams}));

    const optimized = await measure(() =>
      queryOptimizedV2({client: ddb, QueryCommand, queryParams})
    );

    expect(regular.result).toHaveLength(20);
    expect(optimized.result).toHaveLength(20);

    console.log({regular: regular.duration, optimized: optimized.duration});

    expect(optimized.duration).toBeLessThanOrEqual(regular.duration / 1.5);
  });
});

type FakeItem = {
  hash_key: string;
  range_key: string;
  payload: string;
};

type FakeKey = Pick<FakeItem, 'hash_key' | 'range_key'>;

function createItems(hashKey: string, count: number): FakeItem[] {
  return Array.from({length: count}, (_, idx) => {
    return {
      hash_key: hashKey,
      range_key: `${RANGE_PREFIX}-${idx.toString().padStart(6, '0')}`,
      payload: 'x'.repeat(128),
    };
  });
}

function toKey(item: FakeItem): FakeKey {
  return {hash_key: item.hash_key, range_key: item.range_key};
}

function makeQueryParams(hashKey: string): Omit<QueryCommandInput, 'ExclusiveStartKey'> {
  return {
    TableName: TABLE_NAME,
    ProjectionExpression: 'hash_key, range_key',
    KeyConditionExpression: '#hash_key = :hash_key AND begins_with(#range_key, :range)',
    ExpressionAttributeNames: {
      '#hash_key': 'hash_key',
      '#range_key': 'range_key',
    },
    ExpressionAttributeValues: marshall({
      ':hash_key': hashKey,
      ':range': RANGE_PREFIX,
    }),
  };
}

async function measure<T>(fn: () => Promise<T>): Promise<{duration: number; result: T}> {
  const start = performance.now();
  const result = await fn();

  return {duration: performance.now() - start, result};
}
