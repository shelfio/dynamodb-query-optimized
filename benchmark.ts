import DynamoDB from 'aws-sdk/clients/dynamodb';
import {queryOptimized, queryRegular} from './src';

const ddb = new DynamoDB.DocumentClient({region: 'us-east-1'});

(async () => {
  // warm up TCP connection
  await testQueryRegular('hk5');

  console.time('Regular query: <1 MB of items');
  await testQueryRegular('hk5');
  console.timeEnd('Regular query: <1 MB of items');

  console.time('Optimized query: <1 MB of items');
  await testQueryOptimized('hk5');
  console.timeEnd('Optimized query: <1 MB of items');

  console.time('Regular query: ~21 MB of items');
  await testQueryRegular('hk6');
  console.timeEnd('Regular query: ~21 MB of items');

  console.time('Optimized query: ~21 MB of items');
  await testQueryOptimized('hk6');
  console.timeEnd('Optimized query: ~21 MB of items');
})();

async function testQueryRegular(hash_key: string) {
  return queryRegular({
    queryFunction: ddb.query.bind(ddb),
    queryParams: {
      TableName: 'ddb-query-optimized',
      ProjectionExpression: 'hash_key, range_key',
      KeyConditionExpression: '#hash_key = :hash_key',
      FilterExpression: '#number > :number',
      ExpressionAttributeNames: {
        '#hash_key': 'hash_key',
        '#number': 'number',
      },
      ExpressionAttributeValues: {
        ':hash_key': hash_key,
        ':number': 0.5,
      },
    },
  });
}

async function testQueryOptimized(hash_key: string) {
  return queryOptimized({
    queryFunction: ddb.query.bind(ddb),
    queryParams: {
      TableName: 'ddb-query-optimized',
      ProjectionExpression: 'hash_key, range_key',
      KeyConditionExpression: '#hash_key = :hash_key',
      FilterExpression: '#number > :number',
      ExpressionAttributeNames: {
        '#hash_key': 'hash_key',
        '#number': 'number',
      },
      ExpressionAttributeValues: {
        ':hash_key': hash_key,
        ':number': 0.5,
      },
    },
  });
}
