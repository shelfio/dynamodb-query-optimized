import type {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import {chunk} from 'lodash';
import {ddb} from './ddb';
import {batchWrite} from './insert-many';

export async function deleteAll(
  params: DocumentClient.ScanInput
): Promise<DocumentClient.BatchWriteItemOutput[]> {
  let LastEvaluatedKey;
  let resp;

  do {
    resp = await ddb
      .scan({
        ...params,
        ...(LastEvaluatedKey ? {ExclusiveStartKey: LastEvaluatedKey} : {}),
      })
      .promise();

    // eslint-disable-next-line prefer-destructuring
    LastEvaluatedKey = resp.LastEvaluatedKey;
  } while (LastEvaluatedKey);

  return deleteMany({TableName: params.TableName, Keys: resp.Items as Record<string, unknown>[]});
}

type DeleteRequestItem = Omit<DocumentClient.WriteRequest, 'PutRequest'>;

type DeleteManyParams = {
  TableName: string;
  Keys: Record<string, unknown>[];
};

export function deleteMany(
  params: DeleteManyParams,
  retryCount = 0
): Promise<DocumentClient.BatchWriteItemOutput[]> {
  const {TableName, Keys} = params;
  const keysChunks = chunk(Keys, 25);

  const paramsChunks = keysChunks.map(
    (keysChunk): DocumentClient.BatchWriteItemInput =>
      makeDeleteRequestItems({TableName, Keys: keysChunk})
  );

  return Promise.all(
    paramsChunks.map(
      (params): Promise<DocumentClient.BatchWriteItemOutput> => batchWrite(params, retryCount)
    )
  );
}

function makeDeleteRequestItems(params: DeleteManyParams): DocumentClient.BatchWriteItemInput {
  const {TableName, Keys} = params;

  return {
    RequestItems: {
      [TableName]: Keys.map((key): DeleteRequestItem => makeDeleteRequestItem(key)),
    },
  };
}

function makeDeleteRequestItem(key: Record<string, unknown>): DeleteRequestItem {
  return {
    DeleteRequest: {
      Key: key,
    },
  };
}
