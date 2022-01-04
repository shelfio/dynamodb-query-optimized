function getTableConfig(tableName) {
  return {
    TableName: tableName,
    KeySchema: [
      {AttributeName: 'hash_key', KeyType: 'HASH'},
      {AttributeName: 'range_key', KeyType: 'RANGE'},
    ],
    AttributeDefinitions: [
      {AttributeName: 'hash_key', AttributeType: 'S'},
      {AttributeName: 'range_key', AttributeType: 'S'},
    ],
    ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1},
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  };
}

module.exports = {
  tables: [getTableConfig('example_table')],
};
