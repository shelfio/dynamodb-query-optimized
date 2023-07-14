import {isEqual, uniqBy} from 'lodash';
import type {AttributeValue, QueryCommandInput, QueryCommandOutput} from '@aws-sdk/client-dynamodb';
import type {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import type {QueryCommand} from '@aws-sdk/client-dynamodb';

type QueryOptimizedParams = {
  client: DynamoDBClient;
  QueryCommand: typeof QueryCommand;
  queryParams: Omit<QueryCommandInput, 'ScanIndexForward' | 'ExclusiveStartKey'>;
};

//
// This method is optimized to query indices where a query might scan 2+ MB of data.
// It works by launching 2 parallel queries that iterate from both ends of the index
// until the meet in the middle
//
export async function queryOptimized<T>({
  queryParams,
  QueryCommand,
  client,
}: QueryOptimizedParams): Promise<T[]> {
  let allItems: T[] = [];
  let allItemsFromLeftQuery: T[] = [];
  let allItemsFromRightQuery: T[] = [];

  let isMiddleReached = false;
  let queryLeftLastEvaluatedKey;
  let queryRightLastEvaluatedKey;
  let areBothQueriesExhausted = false;

  do {
    const responses = await Promise.all([
      executeLeftQuery({client, queryParams, QueryCommand}, queryLeftLastEvaluatedKey),
      executeRightQuery({client, queryParams, QueryCommand}, queryRightLastEvaluatedKey),
    ]);

    const [respLeft, respRight] = responses as any;

    if (respLeft.LastEvaluatedKey) {
      queryLeftLastEvaluatedKey = respLeft.LastEvaluatedKey;
    }

    if (respRight.LastEvaluatedKey) {
      queryRightLastEvaluatedKey = respRight.LastEvaluatedKey;
    }

    // If both queries don't have a cursor to fetch the next item - stop iterating
    areBothQueriesExhausted = !queryLeftLastEvaluatedKey && !queryRightLastEvaluatedKey;

    if (!isMiddleReached) {
      isMiddleReached = checkIfMiddleReached(allItemsFromLeftQuery, allItemsFromRightQuery);
    }

    allItemsFromLeftQuery = allItemsFromLeftQuery.concat(respLeft.Items!);
    allItemsFromRightQuery = allItemsFromRightQuery.concat(respRight.Items!);

    allItems = allItems.concat(respLeft.Items!);
    allItems = allItems.concat(respRight.Items!);
  } while (!isMiddleReached && !areBothQueriesExhausted);

  return uniqBy(allItems, item => JSON.stringify(item));
}

export async function queryRegular<T extends Record<string, AttributeValue>>({
  client,
  queryParams,
  QueryCommand,
}: QueryOptimizedParams): Promise<T[]> {
  let allItems: T[] = [];
  let lastEvaluatedKey;

  do {
    const resp: QueryCommandOutput = await executeLeftQuery(
      {
        client,
        queryParams,
        QueryCommand,
      },
      lastEvaluatedKey
    );

    if (resp.Items && resp.Items.length) {
      allItems = allItems.concat(resp.Items! as T[]);
    }

    lastEvaluatedKey = resp.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

function executeLeftQuery(
  {client, queryParams, QueryCommand}: QueryOptimizedParams,
  key?: any
): Promise<QueryCommandOutput> {
  return client.send(
    new QueryCommand({
      ...queryParams,
      ...(key ? {ExclusiveStartKey: key} : {}),
      ScanIndexForward: true,
    })
  );
}

function executeRightQuery(
  {client, queryParams, QueryCommand}: QueryOptimizedParams,
  key?: any
): Promise<QueryCommandOutput> {
  return client.send(
    new QueryCommand({
      ...queryParams,
      ...(key ? {ExclusiveStartKey: key} : {}),
      ScanIndexForward: false,
    })
  );
}

function checkIfMiddleReached<T>(allItemsFromLeftQuery: T[], allItemsFromRightQuery: T[]): boolean {
  return allItemsFromLeftQuery.some(leftItem =>
    allItemsFromRightQuery.some(rightItem => isEqual(rightItem, leftItem))
  );
}
