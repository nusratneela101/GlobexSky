module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'services/commission.service.js',
    'services/pricing.service.js',
    'services/flashSale.service.js',
    'services/loyalty.service.js',
    'services/cod.service.js',
    'services/email.service.js',
    'services/sms.service.js',
    'services/featureToggle.service.js',
    'services/currency.service.js',
  ],
  coverageThreshold: { global: { lines: 60 } },
  transform: { '^.+\\.js$': 'babel-jest' },
  setupFilesAfterEnv: ['./tests/helpers/setup.js'],
  testTimeout: 10000,
};
