import {BatchWriteCommand} from '@aws-sdk/lib-dynamodb';
import {chunk} from 'lodash-es';
import pMap from 'p-map';
import type {AttributeValue, WriteRequest} from '@aws-sdk/client-dynamodb';
import type {BatchWriteCommandInput, BatchWriteCommandOutput} from '@aws-sdk/lib-dynamodb';
import {ddb} from './ddb';

type InsertManyParams = {
  TableName: string;
  Items: any[];
};

export function insertMany(
  params: InsertManyParams,
  retryCount = 3
): Promise<BatchWriteCommandOutput[]> {
  const {TableName, Items} = params;
  const itemsChunks = chunk(Items, 25);

  const paramsChunks = itemsChunks.map(
    (itemsChunk): BatchWriteCommandInput => makePutRequestItems({TableName, Items: itemsChunk})
  );

  return pMap(
    paramsChunks,
    (params): Promise<BatchWriteCommandOutput> => batchWrite(params, retryCount),
    {concurrency: 100, stopOnError: false}
  );
}

export async function batchWrite(
  params: BatchWriteCommandInput,
  retryCounter = 0
): Promise<BatchWriteCommandOutput> {
  if (retryCounter > 10) {
    retryCounter = 10;
  }

  const results = await ddb.send(new BatchWriteCommand(params));

  const isAnyOpFailed = Boolean(Object.keys(results?.UnprocessedItems || {}).length);

  if (retryCounter > 0 && isAnyOpFailed) {
    return batchWrite(
      {
        RequestItems: results.UnprocessedItems as BatchWriteCommandInput['RequestItems'],
      },
      retryCounter - 1
    );
  }

  return results;
}

type PutRequestItem = Omit<WriteRequest, 'DeleteRequest'>;

function makePutRequestItems(params: InsertManyParams): BatchWriteCommandInput {
  const {TableName, Items} = params;

  return {
    RequestItems: {
      [TableName]: Items.map((item): PutRequestItem => makePutRequestItem(item)),
    },
  };
}

function makePutRequestItem(item: Record<string, AttributeValue>): PutRequestItem {
  return {
    PutRequest: {
      Item: item,
    },
  };
}
