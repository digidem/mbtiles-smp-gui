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
    on: jest.fn().mockImplementation(function (this: any, event, callback) {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
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
  jest.setTimeout(60000);

  it('should convert MBTiles to SMP format', async () => {
    // Mock the metadata query
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        callback: (
          err: Error | null,
          rows: { name: string; value: string }[],
        ) => void,
      ) => {
        if (query.includes('metadata')) {
          callback(null, [
            { name: 'format', value: 'png' },
            { name: 'name', value: 'Test Map' },
            { name: 'minzoom', value: '0' },
            { name: 'maxzoom', value: '1' },
          ]);
        }
      },
    );

    // Mock the zoom levels query
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        callback: (err: Error | null, rows: { zoom_level: number }[]) => void,
      ) => {
        if (query.includes('DISTINCT zoom_level')) {
          callback(null, [{ zoom_level: 0 }, { zoom_level: 1 }]);
        }
      },
    );

    // Mock tiles for zoom level 0
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        params: unknown[],
        callback: (err: Error | null, rows: Record<string, unknown>[]) => void,
      ) => {
        callback(null, [
          {
            zoom_level: 0,
            tile_column: 0,
            tile_row: 0,
            tile_data: Buffer.from('test-tile-data'),
          },
        ]);
      },
    );

    // Mock tiles for zoom level 1
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        params: unknown[],
        callback: (err: Error | null, rows: Record<string, unknown>[]) => void,
      ) => {
        callback(null, [
          {
            zoom_level: 1,
            tile_column: 0,
            tile_row: 0,
            tile_data: Buffer.from('test-tile-data'),
          },
        ]);
      },
    );

    // Mock the database close
    mockDb.close.mockImplementationOnce(
      (callback: (err: Error | null) => void) => {
        callback(null);
      },
    );

    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output';

    await smpGenerator.fromMbtiles(mbtilesPath, outputPath);

    // Verify that the database was created
    expect(sqlite3.verbose).toHaveBeenCalled();

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
    mockDb.all.mockImplementationOnce(
      (
        query: string,
        callback: (
          err: Error | null,
          rows: { name: string; value: string }[],
        ) => void,
      ) => {
        if (query.includes('metadata')) {
          callback(null, [{ name: 'format', value: 'pbf' }]);
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

    // Expect the function to reject with the correct error message
    await expect(
      smpGenerator.fromMbtiles(mbtilesPath, outputPath),
    ).rejects.toThrow('Vector MBTiles are not yet supported');
  });
});
