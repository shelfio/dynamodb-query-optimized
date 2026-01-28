const ES_PACKAGES_TO_TRANSFORM = ['@shelf/.+', 'lodash-es'];

/** @type {import('jest').Config} */
const config = {
  preset: '@shelf/jest-dynamodb',
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: {
            syntax: 'typescript',
          },
        },
      },
    ],
  },
  transformIgnorePatterns: [
    `node_modules/(?!(${ES_PACKAGES_TO_TRANSFORM.join('|')}))/node_modules/.+\\.js`,
  ],
};
process.env.ENVIRONMENT = 'local';
process.env.JEST_DYNAMODB_CONFIG = `${process.cwd()}/jest-dynamodb-config.cjs`;

export default config;
