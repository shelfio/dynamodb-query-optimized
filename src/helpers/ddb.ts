import {getDocumentClient} from '@shelf/aws-ddb-with-xray';

export const ddb = getDocumentClient({
  documentClientConfig: {
    marshallOptions: {convertEmptyValues: true},
    ...(process.env.DDB_DEBUG_LOGS && {logger: console}),
  },
  credentials: {
    accessKeyId: 'fakeMyKeyId',
    secretAccessKey: 'fakeSecretAccessKey',
    sessionToken: 'fakeSessionToken',
  },
  clientConfig: {
    endpoint: 'http://localhost:8000',
    tls: false,
    region: 'local-env',
    ...(process.env.DDB_DEBUG_LOGS && {logger: console}),
  },
});
