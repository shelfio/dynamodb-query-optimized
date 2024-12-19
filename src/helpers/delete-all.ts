import {ScanCommand} from '@aws-sdk/lib-dynamodb';
import {chunk} from 'lodash';
import type {
  BatchWriteCommandInput,
  BatchWriteCommandOutput,
  ScanCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type {AttributeValue, WriteRequest} from '@aws-sdk/client-dynamodb';
import {ddb} from './ddb';
import {batchWrite} from './insert-many';

export async function deleteAll(params: ScanCommandInput): Promise<BatchWriteCommandOutput[]> {
  let LastEvaluatedKey;
  let resp;

  do {
    const scanCommand: ScanCommand = new ScanCommand({
      ...params,
      ...(LastEvaluatedKey ? {ExclusiveStartKey: LastEvaluatedKey} : {}),
    });

    resp = await ddb.send(scanCommand);

    // eslint-disable-next-line prefer-destructuring
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);

  return deleteMany({
    TableName: params.TableName!,
    Keys: resp.Items as Record<string, AttributeValue>[],
  });
}

type DeleteRequestItem = Omit<WriteRequest, 'PutRequest'>;

type DeleteManyParams = {
  TableName: string;
  Keys: Record<string, AttributeValue>[];
};

export function deleteMany(
  params: DeleteManyParams,
  retryCount = 0
): Promise<BatchWriteCommandOutput[]> {
  const {TableName, Keys} = params;
  const keysChunks = chunk(Keys, 25);

  const paramsChunks = keysChunks.map(
    (keysChunk): BatchWriteCommandInput => makeDeleteRequestItems({TableName, Keys: keysChunk})
  );

  return Promise.all(
    paramsChunks.map((params): Promise<BatchWriteCommandOutput> => batchWrite(params, retryCount))
  );
}

function makeDeleteRequestItems(params: DeleteManyParams): BatchWriteCommandInput {
  const {TableName, Keys} = params;

  return {
    RequestItems: {
      [TableName]: Keys.map((key): DeleteRequestItem => makeDeleteRequestItem(key)),
    },
  };
}

function makeDeleteRequestItem(key: Record<string, AttributeValue>): DeleteRequestItem {
  return {
    DeleteRequest: {
      Key: key,
    },
  };
}
