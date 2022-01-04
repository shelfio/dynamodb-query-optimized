import {getDocumentClient} from '@shelf/aws-ddb-with-xray';

const isTest = process.env.JEST_WORKER_ID;
const shouldIgnoreLocalDDB = Boolean(process.env.SHOULD_IGNORE_LOCAL_DDB); // Used when needed to connect to real DDB even from inside Jest

// eslint-disable-next-line multiline-ternary
const ddbEndpoint = shouldIgnoreLocalDDB
  ? // eslint-disable-next-line multiline-ternary
    {}
  : {endpoint: 'localhost:8000', sslEnabled: false, region: 'local-env'};

export const ddb = getDocumentClient({
  ddbClientParams: {
    convertEmptyValues: true,
    ...(isTest && ddbEndpoint),
    ...(process.env.DDB_DEBUG_LOGS && {logger: console}),
  },
  ddbParams: {
    ...(isTest && ddbEndpoint),
  },
});
