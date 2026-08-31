/**
 * Jest config for the pure calculation layer only (src/calc/**).
 *
 * These modules have zero React Native / Expo imports, so they run in a plain
 * Node environment via ts-jest — no jest-expo / Metro transform pipeline needed.
 * UI is verified manually through Expo Go per the project scope.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/calc/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  clearMocks: true,
};
