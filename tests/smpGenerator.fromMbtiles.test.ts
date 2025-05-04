import fs from 'node:fs';

// Import after mocking dependencies
import SMPGenerator from '../src/main/smpGenerator';

// Mock electron and other dependencies
jest.mock('electron', () => ({
  ipcMain: {
    on: jest.fn(),
  },
}));

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
      return { pipe: jest.fn() }; // Return an object instead of 'this'
    }),
  }),
}));

// Mock dependencies
jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    end: jest.fn(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return { on: jest.fn() }; // Return an object instead of 'this'
    }),
  }),
  existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

// Mock sqlite3
jest.mock('sqlite3', () => {
  const mockDb = {
    all: jest.fn(),
    close: jest.fn(),
  };

  return {
    Database: jest.fn().mockReturnValue(mockDb),
  };
});
describe('SMPGenerator.fromMbtiles', () => {
  let generator: SMPGenerator;
  let mockDb: {
    all: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    generator = new SMPGenerator();
    mockDb = jest.requireMock('sqlite3').Database();

    // Mock the metadata query
    mockDb.all.mockImplementation(
      (
        query: string,
        params: unknown[] | ((err: Error | null, rows: unknown[]) => void),
        callback?: (err: Error | null, rows: unknown[]) => void,
        // eslint-disable-next-line consistent-return
      ) => {
        // Handle different parameter patterns
        if (typeof params === 'function') {
          const callbackFn = params;
          const paramsArray: unknown[] = [];
          return mockDb.all(query, paramsArray, callbackFn);
        }

        if (query.includes('metadata')) {
          if (callback) {
            callback(null, [
              { name: 'name', value: 'Test Map' },
              { name: 'format', value: 'png' },
              { name: 'minzoom', value: '0' },
              { name: 'maxzoom', value: '1' },
              { name: 'bounds', value: '-180,-85,180,85' },
            ]);
          }
        } else if (query.includes('DISTINCT zoom_level')) {
          if (callback) {
            callback(null, [{ zoom_level: 0 }, { zoom_level: 1 }]);
          }
        } else if (query.includes('WHERE zoom_level')) {
          // For the zoom level 0 query
          if (
            query.includes('= ?') &&
            Array.isArray(params) &&
            params[0] === 0
          ) {
            if (callback) {
              callback(null, [
                {
                  zoom_level: 0,
                  tile_column: 0,
                  tile_row: 0,
                  tile_data: Buffer.from('test-tile-data'),
                },
              ]);
            }
          } else {
            // For the zoom level 1 query
            callback?.(null, [
              {
                zoom_level: 1,
                tile_column: 0,
                tile_row: 0,
                tile_data: Buffer.from('test-tile-data'),
              },
              {
                zoom_level: 1,
                tile_column: 0,
                tile_row: 1,
                tile_data: Buffer.from('test-tile-data'),
              },
              {
                zoom_level: 1,
                tile_column: 1,
                tile_row: 0,
                tile_data: Buffer.from('test-tile-data'),
              },
              {
                zoom_level: 1,
                tile_column: 1,
                tile_row: 1,
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
    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';

    await generator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that the database was opened
    expect(jest.requireMock('sqlite3').Database).toHaveBeenCalledWith(
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
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('style.json'),
      expect.any(String),
    );

    // Verify that the archive was created
    expect(jest.requireMock('archiver').default).toHaveBeenCalledWith(
      'zip',
      expect.any(Object),
    );
  });

  it('should reject if the MBTiles file is a vector tile', async () => {
    const mbtilesPath = '/path/to/vector.mbtiles';
    const outputPath = '/path/to/output.smp';

    // Mock the metadata query to return pbf format
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        callback: (err: Error | null, rows: unknown[]) => void,
      ) => {
        if (query.includes('metadata')) {
          callback(null, [
            { name: 'name', value: 'Vector Map' },
            { name: 'format', value: 'pbf' },
            { name: 'minzoom', value: '0' },
            { name: 'maxzoom', value: '1' },
          ]);
        }
      },
    );

    await expect(
      generator.fromMbtiles(mbtilesPath, outputPath),
    ).rejects.toThrow('Vector MBTiles are not yet supported');
  });
});
