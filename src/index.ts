/* eslint-disable complexity */
import {isEqual, uniqBy} from 'lodash';
import {unmarshall} from '@aws-sdk/util-dynamodb';
import type {NativeAttributeValue} from '@aws-sdk/util-dynamodb';
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
// @deprecated, use queryOptimizedV2 instead
export async function queryOptimized<T extends Record<string, any>>({
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

  return uniqBy(allItems, item => JSON.stringify(item)).map(item => unmarshall(item) as T);
}

type UniqueIdentifierAttributes<T> = {
  primaryKey: keyof T;
  sortKey?: keyof T;
};

function uniqueIdentifierFn<T extends Record<string, NativeAttributeValue>>(
  item: T,
  {primaryKey, sortKey}: UniqueIdentifierAttributes<T>,
  {
    primaryKeyStr,
    sortKeyStr,
  }: {
    primaryKeyStr: string;
    sortKeyStr?: string;
  }
) {
  const primaryIdentifier = `${primaryKeyStr}:${item[primaryKey]}`;

  if (!sortKey || !sortKeyStr) {
    return primaryIdentifier;
  }

  return `${primaryIdentifier}|${sortKeyStr}:${item[sortKey]}`;
}

type QueryOptimizedParamsV2<T> = {
  client: DynamoDBClient;
  QueryCommand: typeof QueryCommand;
  queryParams: Omit<QueryCommandInput, 'ScanIndexForward' | 'ExclusiveStartKey'>;
  uniqueIdentifierAttributes?: UniqueIdentifierAttributes<T>; // preferred attribute names for the default identifier
};

export async function queryOptimizedV2<T extends Record<string, NativeAttributeValue>>({
  queryParams,
  QueryCommand,
  uniqueIdentifierAttributes,
  client,
}: QueryOptimizedParamsV2<T>): Promise<T[]> {
  const defaultAttributes: UniqueIdentifierAttributes<T> = {
    primaryKey: 'hash_key',
    sortKey: 'range_key',
  };
  const identifierAttributes = uniqueIdentifierAttributes ?? defaultAttributes;
  const stringifiedAttributes = {
    primaryKeyStr: String(identifierAttributes.primaryKey),
    sortKeyStr: identifierAttributes.sortKey ? String(identifierAttributes.sortKey) : undefined,
  };

  const map = new Map<string, T>();

  const addItemToMap = (item: Record<string, AttributeValue>) => {
    const unmarshalledItem = unmarshall(item) as T;

    const key = uniqueIdentifierFn(unmarshalledItem, identifierAttributes, stringifiedAttributes);

    if (!map.has(key)) {
      map.set(key, unmarshalledItem);
    } else {
      isMiddleReached = true;
    }
  };

  let isMiddleReached = false;
  let queryLeftLastEvaluatedKey;
  let queryRightLastEvaluatedKey;
  let isSomeQueryExhausted = false;

  const queryParamsWithProjection = queryParams;

  if (queryParams.ProjectionExpression) {
    const projectionAttributes = queryParams.ProjectionExpression.split(',').map(attribute =>
      attribute.trim()
    );
    const projectionSet = new Set(projectionAttributes.filter(Boolean));

    projectionSet.add(identifierAttributes.primaryKey.toString());

    if (identifierAttributes.sortKey) {
      projectionSet.add(identifierAttributes.sortKey.toString());
    }

    queryParamsWithProjection.ProjectionExpression = Array.from(projectionSet).join(', ');
  }

  do {
    const responses = await Promise.all([
      executeLeftQuery(
        {client, queryParams: queryParamsWithProjection, QueryCommand},
        queryLeftLastEvaluatedKey
      ),
      executeRightQuery(
        {client, queryParams: queryParamsWithProjection, QueryCommand},
        queryRightLastEvaluatedKey
      ),
    ]);

    const [respLeft, respRight] = responses as any;

    queryLeftLastEvaluatedKey = respLeft.LastEvaluatedKey;
    queryRightLastEvaluatedKey = respRight.LastEvaluatedKey;

    for (const item of respLeft.Items ?? []) {
      addItemToMap(item);
    }

    for (const item of respRight.Items ?? []) {
      addItemToMap(item);
    }

    // If any query don't have a cursor to fetch the next item - stop iterating (means at least that query processed all items)
    isSomeQueryExhausted = !queryLeftLastEvaluatedKey || !queryRightLastEvaluatedKey;
  } while (!isMiddleReached && !isSomeQueryExhausted);

  return Array.from(map.values());
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
