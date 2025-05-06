/* eslint-disable global-require */
// Mock dependencies
// Import the SMPGenerator class
import SMPGenerator from '../src/main/smpGenerator';

// Mock the mbtilesConverter module
jest.mock('../src/main/mbtilesConverter', () => ({
  convertMBTilesToSMP: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('node:fs', () => {
  const mockOn = jest.fn().mockImplementation(function (
    this: any,
    event,
    callback,
  ) {
    if (event === 'close') {
      setTimeout(callback, 10);
    }
    return this;
  });

  return {
    writeFileSync: jest.fn(),
    existsSync: jest.fn().mockReturnValue(true),
    createWriteStream: jest.fn().mockReturnValue({
      end: jest.fn(),
      on: mockOn,
    }),
    promises: {
      mkdir: jest.fn().mockResolvedValue(undefined),
    },
  };
});

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

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

describe('SMPGenerator', () => {
  let generator: SMPGenerator;
  let convertMBTilesToSMP: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SMPGenerator();
    convertMBTilesToSMP =
      require('../src/main/mbtilesConverter').convertMBTilesToSMP;
  });

  it('should convert MBTiles to SMP format', async () => {
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';

    await generator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that the convertMBTilesToSMP function was called with the correct parameters
    expect(convertMBTilesToSMP).toHaveBeenCalledWith(mbtilesPath, outputPath);
  });

  it('should extract an SMP file', async () => {
    const smpPath = '/path/to/test.smp';
    const outputDir = '/path/to/output';

    await generator.extractSMP(smpPath, outputDir);

    // Verify that the output directory was created
    expect(require('fs-extra').ensureDirSync).toHaveBeenCalledWith(outputDir);

    // Verify that the zip file was opened
    expect(require('yauzl').open).toHaveBeenCalledWith(
      smpPath,
      { lazyEntries: true },
      expect.any(Function),
    );
  });

  it('should handle errors during MBTiles to SMP conversion', async () => {
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';
    const errorMessage = 'Conversion error';

    // Mock the convertMBTilesToSMP function to throw an error
    convertMBTilesToSMP.mockRejectedValueOnce(new Error(errorMessage));

    // Expect the function to reject with the correct error message
    await expect(
      generator.fromMbtiles(mbtilesPath, outputPath),
    ).rejects.toThrow(errorMessage);
  });
});
