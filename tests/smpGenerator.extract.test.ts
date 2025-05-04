/* eslint-disable global-require */
// Import the SMPGenerator class
import SMPGenerator from '../src/main/smpGenerator';

// Mock dependencies before importing SMPGenerator
jest.mock('archiver', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    pipe: jest.fn().mockReturnThis(),
    directory: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'close') {
        callback();
      }
      return { pipe: jest.fn() };
    }),
  }),
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

jest.mock('sqlite3', () => {
  const mockDb = {
    all: jest.fn(),
    close: jest.fn(),
  };

  return {
    Database: jest.fn().mockReturnValue(mockDb),
  };
});

// Mock dependencies
jest.mock('node:fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
  createWriteStream: jest.fn().mockReturnValue({
    on: jest.fn().mockImplementation(function (this: any) {
      return this;
    }),
  }),
  existsSync: jest.fn().mockReturnValue(true),
}));

// Mock yauzl
jest.mock('yauzl', () => {
  const mockReadStream = {
    on: jest.fn().mockImplementation(function (event, handler) {
      if (event === 'end') {
        setTimeout(handler, 10);
      }
      return this;
    }),
    pipe: jest.fn(),
  };

  return {
    open: jest.fn((zipPath, options, callback) => {
      const mockZipFile = {
        on: jest.fn().mockImplementation(function (event, handler) {
          if (event === 'entry') {
            // Simulate a few entries
            handler({ fileName: 'style.json' });
            handler({ fileName: 'mbtiles-source/0/0/0.png' });
          }
          if (event === 'end') {
            setTimeout(handler, 10);
          }
          return this;
        }),
        readEntry: jest.fn(),
        openReadStream: jest.fn((entry, streamCallback) => {
          streamCallback(null, mockReadStream);
        }),
      };

      callback(null, mockZipFile);
    }),
  };
});

describe('SMPGenerator.extractSMP', () => {
  let generator: SMPGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SMPGenerator();
  });

  it('should extract an SMP file', async () => {
    const smpPath = '/path/to/test.smp';
    const outputDir = '/path/to/output';

    await generator.extractSMP(smpPath, outputDir);

    // Verify that yauzl.open was called with the correct parameters
    expect(jest.mocked(require('yauzl')).open).toHaveBeenCalledWith(
      smpPath,
      { lazyEntries: true },
      expect.any(Function),
    );
  });
});
