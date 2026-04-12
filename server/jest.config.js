/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/server.test.js',
  ],
  roots: ['..'],
  collectCoverageFrom: [
    'server.js',
  ],
  coverageThreshold: {
    global: {
      lines:     85,
      functions: 90,
      branches:  75,
      statements:85,
    },
  },
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: '../coverage/server',
};
