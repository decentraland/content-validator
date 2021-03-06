module.exports = {
  globals: {
    'ts-jest': {
      tsconfig: 'test/tsconfig.json'
    }
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: ["./src/**"],
  verbose: true,
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  testMatch: ['**/*.spec.(ts)'],
  testEnvironment: 'node',
}
