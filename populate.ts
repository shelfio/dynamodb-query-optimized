import {insertMany} from './src/helpers/insert-many';

(async () => {
  const listToInsert = [];

  // Each item is approx. 21.5 KB
  // We insert approx. 21.5 MB of data with hash_key: 'hk5'
  // and ~0.8 Mb of data with hash_key: 'hk6'
  for (let i = 0; i < 1040; i++) {
    listToInsert.push({
      hash_key: i >= 1000 ? 'hk5' : 'hk6',
      range_key: `rk-${i}`,
      foo: 'hello world '.repeat(100),
      bar: 'hello world '.repeat(100),
      baz: 'hello world '.repeat(100),
      items: new Array(1000).fill(Math.random()),
      number: Math.random(),
    });
  }

  await insertMany({
    TableName: 'ddb-query-optimized',
    Items: listToInsert,
  });
})();
