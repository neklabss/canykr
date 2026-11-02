/** @type {import('jest').Config} */
const base = { preset: 'ts-jest', testEnvironment: 'node', moduleFileExtensions: ['ts', 'js', 'json'] };
module.exports = {
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    { ...base, displayName: 'e2e', testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'], globalSetup: '<rootDir>/test/global-setup.ts', setupFiles: ['<rootDir>/test/env.ts'] },
  ],
};
