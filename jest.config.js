/** @type {import('jest').Config} */
const config = {
  moduleDirectories: ['node_modules', 'release/app/node_modules', 'src'],
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/.erb/mocks/fileMock.js',
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
  },
  // Remove the setupFiles that check for built files
  // setupFiles: ['./.erb/scripts/check-build-exists.ts'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost/',
  },
  testPathIgnorePatterns: [
    'release/app/dist',
    '.erb/dll',
    'mbtiles-reader/test',
  ],
  transform: {
    '\\.(ts|tsx|js|jsx)$': 'ts-jest',
  },
  // Add transformIgnorePatterns to handle ESM modules
  transformIgnorePatterns: [
    '/node_modules/(?!chalk|ansi-styles|escape-string-regexp|strip-ansi|ansi-regex|#ansi-styles)/',
  ],
  // Setup files after env is loaded
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};

module.exports = config;
