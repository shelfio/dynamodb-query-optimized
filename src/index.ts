import type {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import {isEqual, uniqBy} from 'lodash';

type QueryOptimizedParams = {
  queryFunction: DocumentClient['query'];
  queryParams: Omit<DocumentClient.QueryInput, 'ScanIndexForward' | 'ExclusiveStartKey'>;
};

/*
 This method is optimized to query indices where a query might scan 2+ MB of data.
 It works by launching 2 parallel queries that iterate from both ends of the index
 until the meet in the middle
 */
export async function queryOptimized<T>(params: QueryOptimizedParams): Promise<T[]> {
  const {queryParams, queryFunction} = params;

  let allItems: T[] = [];
  let allItemsFromLeftQuery: T[] = [];
  let allItemsFromRightQuery: T[] = [];

  let isMiddleReached = false;
  let queryLeftLastEvaluatedKey;
  let queryRightLastEvaluatedKey;
  let areBothQueriesExhausted = false;

  do {
    const responses = await Promise.all([
      executeLeftQuery(queryFunction, queryParams, queryLeftLastEvaluatedKey),
      executeRightQuery(queryFunction, queryParams, queryRightLastEvaluatedKey),
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

export async function queryRegular<T>(params: QueryOptimizedParams): Promise<T[]> {
  const {queryParams, queryFunction} = params;

  let allItems: T[] = [];
  let lastEvaluatedKey;

  do {
    const resp: DocumentClient.QueryOutput = await executeLeftQuery(
      queryFunction,
      queryParams,
      lastEvaluatedKey
    );

    if (resp.Items && resp.Items.length) {
      allItems = allItems.concat(resp.Items! as T[]);
    }

    if (resp.LastEvaluatedKey) {
      lastEvaluatedKey = resp.LastEvaluatedKey;
    }
  } while (lastEvaluatedKey);

  return allItems;
}

async function executeLeftQuery(
  queryFunction: QueryOptimizedParams['queryFunction'],
  queryParams: QueryOptimizedParams['queryParams'],
  key?: any
): Promise<DocumentClient.QueryOutput> {
  return queryFunction({
    ...queryParams,
    ...(key ? {ExclusiveStartKey: key} : {}),
    ScanIndexForward: true,
  }).promise();
}

async function executeRightQuery(
  queryFunction: QueryOptimizedParams['queryFunction'],
  queryParams: QueryOptimizedParams['queryParams'],
  key?: any
): Promise<DocumentClient.QueryOutput> {
  return queryFunction({
    ...queryParams,
    ...(key ? {ExclusiveStartKey: key} : {}),
    ScanIndexForward: false,
  }).promise();
}

function checkIfMiddleReached<T>(allItemsFromLeftQuery: T[], allItemsFromRightQuery: T[]): boolean {
  return allItemsFromLeftQuery.some(leftItem =>
    allItemsFromRightQuery.some(rightItem => isEqual(rightItem, leftItem))
  );
}
