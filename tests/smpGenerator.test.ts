/* eslint-disable global-require */
// Mock dependencies
// Import the SMPGenerator class
import SMPGenerator from '../src/main/smpGenerator';

jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  createWriteStream: jest.fn().mockReturnValue({
    end: jest.fn(),
    on: jest.fn().mockImplementation(function (event, callback) {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
    }),
  }),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

// Mock archiver
jest.mock('archiver', () => {
  const mockArchiver = {
    pipe: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    file: jest.fn().mockReturnThis(),
    directory: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockResolvedValue(undefined),
  };

  return jest.fn().mockReturnValue(mockArchiver);
});

// Mock sqlite3
jest.mock('sqlite3', () => {
  const mockDb = {
    all: jest.fn(),
    get: jest.fn(),
    close: jest.fn(),
  };

  return {
    Database: jest.fn().mockReturnValue(mockDb),
    verbose: jest.fn().mockReturnValue({
      Database: jest.fn().mockReturnValue(mockDb),
    }),
  };
});

// Mock yauzl
jest.mock('yauzl', () => {
  const mockReadStream = {
    on: jest.fn().mockImplementation(function (this: any, event, handler) {
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
        on: jest.fn().mockImplementation(function (this: any, event, handler) {
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

describe('SMPGenerator', () => {
  let generator: SMPGenerator;
  let mockDb: {
    all: jest.Mock;
    get: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    generator = new SMPGenerator();
    mockDb = require('sqlite3').verbose().Database();

    // Mock the metadata query
    mockDb.get.mockImplementation(
      (
        query: string,
        callback: (err: Error | null, row?: Record<string, unknown>) => void,
      ) => {
        if (query.includes('format')) {
          callback(null, { name: 'format', value: 'png' });
        }
      },
    );

    // Mock the metadata query
    mockDb.all.mockImplementation(
      (
        query: string,
        params: unknown[] | ((err: Error | null, rows: unknown[]) => void),
        callback?: (err: Error | null, rows: unknown[]) => void,
        // eslint-disable-next-line consistent-return
      ) => {
        // Handle the case when params is a function (no params provided)
        if (typeof params === 'function') {
          const callbackFn = params as (
            err: Error | null,
            rows: unknown[],
          ) => void;
          const paramsArray: unknown[] = [];
          return mockDb.all(query, paramsArray, callbackFn);
        }

        if (query.includes('metadata')) {
          callback(null, [
            { name: 'name', value: 'Test Map' },
            { name: 'format', value: 'png' },
            { name: 'minzoom', value: '0' },
            { name: 'maxzoom', value: '1' },
            { name: 'bounds', value: '-180,-85,180,85' },
          ]);
        } else if (query.includes('DISTINCT zoom_level')) {
          callback(null, [{ zoom_level: 0 }, { zoom_level: 1 }]);
        } else if (query.includes('WHERE zoom_level')) {
          // For the zoom level 0 query
          if (params[0] === 0) {
            callback(null, [
              {
                zoom_level: 0,
                tile_column: 0,
                tile_row: 0,
                tile_data: Buffer.from('test-tile-data'),
              },
            ]);
          } else {
            // For the zoom level 1 query
            callback(null, [
              {
                zoom_level: 1,
                tile_column: 0,
                tile_row: 0,
                tile_data: Buffer.from('test-tile-data'),
              },
            ]);
          }
        }
      },
    );

    // Mock the database close
    mockDb.close.mockImplementation((callback: (err: Error | null) => void) => {
      callback(null);
    });
  });

  it('should convert MBTiles to SMP format', async () => {
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';

    await generator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that the database was opened
    expect(require('sqlite3').verbose().Database).toHaveBeenCalledWith(
      mbtilesPath,
    );

    // Verify that the metadata was queried
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('metadata'),
      expect.any(Function),
    );

    // Verify that the zoom levels were queried
    expect(mockDb.all).toHaveBeenCalledWith(
      expect.stringContaining('DISTINCT zoom_level'),
      expect.any(Function),
    );

    // Verify that the database was closed
    expect(mockDb.close).toHaveBeenCalled();

    // Verify that the style.json file was created
    expect(require('node:fs').writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('style.json'),
      expect.any(String),
    );

    // Verify that the archive was created
    expect(require('archiver')).toHaveBeenCalledWith('zip', expect.any(Object));
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

  it('should reject if the MBTiles file is a vector tile', async () => {
    const mbtilesPath = '/path/to/vector.mbtiles';
    const outputPath = '/path/to/output.smp';

    // Mock the metadata query to return pbf format
    mockDb.get.mockImplementationOnce(
      (
        query: string,
        callback: (err: Error | null, row?: Record<string, unknown>) => void,
      ) => {
        if (query.includes('format')) {
          callback(null, { name: 'format', value: 'pbf' });
        }
      },
    );

    await expect(
      generator.fromMbtiles(mbtilesPath, outputPath),
    ).rejects.toThrow('Vector MBTiles are not yet supported');
  });
});
