import fs from 'node:fs';
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
      return this;
    }),
  }),
}));

// Mock dependencies
jest.mock('node:fs', () => ({
  writeFileSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    end: jest.fn(),
  }),
  existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
}));

// Mock sqlite3
jest.mock('sqlite3', () => {
  const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn(),
  };

  // Create a constructor function for Database
  function Database() {
    return mockDb;
  }

  return {
    Database,
    verbose: jest.fn().mockReturnValue({
      Database,
    }),
  };
});

describe('fromMbtiles', () => {
  let smpGenerator: SMPGenerator;
  let sqlite3: any;
  let mockDb: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Initialize the SMP generator
    smpGenerator = new SMPGenerator();

    // Setup sqlite3 mock
    sqlite3 = jest.requireMock('sqlite3');
    mockDb = sqlite3.verbose().Database();
  });

  // Increase the timeout for all tests in this file
  jest.setTimeout(30000);

  it('should convert MBTiles to SMP format', async () => {
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

    // Mock the zoom levels query
    mockDb.all.mockImplementation(
      (
        query: string,
        params: unknown[],
        callback: (err: Error | null, rows: Record<string, unknown>[]) => void,
      ) => {
        if (query.includes('DISTINCT zoom_level')) {
          callback(null, [{ zoom_level: 0 }, { zoom_level: 1 }]);
        } else if (query.includes('WHERE zoom_level')) {
          // Mock tiles for zoom level 0
          if (params[0] === 0) {
            callback(null, [
              {
                zoom_level: 0,
                tile_column: 0,
                tile_row: 0,
                tile_data: Buffer.from('test-tile-data'),
              },
            ]);
          }
          // Mock tiles for zoom level 1
          else if (params[0] === 1) {
            callback(null, [
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

    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output';

    await smpGenerator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that the database was opened
    expect(sqlite3.verbose().Database).toHaveBeenCalledWith(mbtilesPath);

    // Verify that the metadata was queried
    expect(mockDb.get).toHaveBeenCalledWith(
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
  });

  it('should reject if the MBTiles file is a vector tile', async () => {
    // Mock the metadata query to return pbf format
    mockDb.get.mockImplementation(
      (
        query: string,
        callback: (err: Error | null, row?: Record<string, unknown>) => void,
      ) => {
        if (query.includes('format')) {
          callback(null, { name: 'format', value: 'pbf' });
        }
      },
    );

    // Mock the database close
    mockDb.close.mockImplementation((callback: (err: Error | null) => void) => {
      if (callback) callback(null);
    });

    // Call the function
    const mbtilesPath = '/path/to/vector.mbtiles';
    const outputPath = '/path/to/output';

    let errorThrown = false;
    try {
      await smpGenerator.fromMbtiles(mbtilesPath, outputPath);
    } catch (error) {
      errorThrown = true;
      // Move expectations outside the catch block to avoid conditional expects
    }

    // Verify error was thrown and has correct properties
    expect(errorThrown).toBe(true);
    await expect(smpGenerator.fromMbtiles).rejects.toThrow(
      'Vector MBTiles are not yet supported',
    );

    // If no error was thrown, the test should fail
    expect(errorThrown).toBe(true);
  });
});
