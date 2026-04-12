/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  // Only run utils tests here — server tests live in server/ with their own deps
  testMatch: [
    '**/tests/unit/utils.test.js',
  ],
  collectCoverageFrom: [
    'js/utils.js',
  ],
  coverageThreshold: {
    global: {
      lines:     90,
      functions: 90,
      branches:  80,
      statements:90,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage',
};
