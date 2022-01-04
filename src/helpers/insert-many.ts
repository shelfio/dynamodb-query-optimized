import type {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import {chunk} from 'lodash';
import pMap from 'p-map';
import {ddb} from './ddb';

type InsertManyParams = {
  TableName: string;
  Items: any[];
};

export function insertMany(
  params: InsertManyParams,
  retryCount = 3
): Promise<DocumentClient.BatchWriteItemOutput[]> {
  const {TableName, Items} = params;
  const itemsChunks = chunk(Items, 25);

  const paramsChunks = itemsChunks.map(
    (itemsChunk): DocumentClient.BatchWriteItemInput =>
      makePutRequestItems({TableName, Items: itemsChunk})
  );

  return pMap(
    paramsChunks,
    (params): Promise<DocumentClient.BatchWriteItemOutput> => batchWrite(params, retryCount),
    {concurrency: 100, stopOnError: false}
  );
}

export async function batchWrite(
  params: DocumentClient.BatchWriteItemInput,
  retryCounter = 0
): Promise<DocumentClient.BatchWriteItemOutput> {
  if (retryCounter > 10) {
    retryCounter = 10;
  }

  const results = await ddb.batchWrite(params).promise();

  const isAnyOpFailed = Boolean(Object.keys(results?.UnprocessedItems || {}).length);

  if (retryCounter > 0 && isAnyOpFailed) {
    return batchWrite(
      {
        RequestItems:
          results.UnprocessedItems as DocumentClient.BatchWriteItemInput['RequestItems'],
      },
      retryCounter - 1
    );
  }

  return results;
}

type PutRequestItem = Omit<DocumentClient.WriteRequest, 'DeleteRequest'>;

function makePutRequestItems(params: InsertManyParams): DocumentClient.BatchWriteItemInput {
  const {TableName, Items} = params;

  return {
    RequestItems: {
      [TableName]: Items.map((item): PutRequestItem => makePutRequestItem(item)),
    },
  };
}

function makePutRequestItem(item: Record<string, unknown>): PutRequestItem {
  return {
    PutRequest: {
      Item: item,
    },
  };
}
