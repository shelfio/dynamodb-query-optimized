function getTableConfig(tableName, {withSortKey = true} = {}) {
  const KeySchema = [{AttributeName: 'hash_key', KeyType: 'HASH'}];
  const AttributeDefinitions = [{AttributeName: 'hash_key', AttributeType: 'S'}];

  if (withSortKey) {
    KeySchema.push({AttributeName: 'range_key', KeyType: 'RANGE'});
    AttributeDefinitions.push({AttributeName: 'range_key', AttributeType: 'S'});
  }

  return {
    TableName: tableName,
    KeySchema,
    AttributeDefinitions,
    ProvisionedThroughput: {ReadCapacityUnits: 1, WriteCapacityUnits: 1},
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'NEW_AND_OLD_IMAGES',
    },
  };
}

module.exports = {
  tables: [
    getTableConfig('example_table'),
    getTableConfig('hash_only_table', {withSortKey: false}),
  ],
};
