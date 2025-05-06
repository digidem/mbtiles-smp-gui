/* eslint-disable global-require */
// Import the SMPGenerator class
import SMPGenerator from '../src/main/smpGenerator';

// Mock the mbtilesConverter module
jest.mock('../src/main/mbtilesConverter', () => ({
  convertMBTilesToSMP: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

// Mock dependencies
jest.mock('node:fs', () => {
  const mockOn = jest.fn().mockImplementation(function (this: any) {
    return this;
  });

  return {
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
    },
    createWriteStream: jest.fn().mockReturnValue({
      on: mockOn,
    }),
    existsSync: jest.fn().mockReturnValue(true),
  };
});

// Mock yauzl
jest.mock('yauzl', () => {
  const mockReadStream = {
    on: jest.fn(function (this: any, event, handler) {
      if (event === 'end') {
        setTimeout(handler, 10);
      }
      return this;
    }),
    pipe: jest.fn(),
  };

  const mockZipFile = {
    on: jest.fn(function (this: any, event, handler) {
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

  return {
    open: jest.fn((zipPath, options, callback) => {
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
