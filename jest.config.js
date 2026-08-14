module.exports = {
  testEnvironment: 'node',
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'controllers/**/*.js',
    'services/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
  ],
};
