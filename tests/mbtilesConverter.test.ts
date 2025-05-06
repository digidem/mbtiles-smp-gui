/* eslint-disable global-require */
import { convertMBTilesToSMP } from '../src/main/mbtilesConverter';

// Mock better-sqlite3
jest.mock('better-sqlite3', () => {
  const mockPrepare = jest.fn();

  // Mock different query results
  mockPrepare.mockImplementation((query) => {
    if (query.includes('SELECT name, value FROM metadata')) {
      return {
        all: jest.fn().mockReturnValue([
          { name: 'name', value: 'Test Map' },
          { name: 'format', value: 'png' },
          { name: 'minzoom', value: '0' },
          { name: 'maxzoom', value: '1' },
          { name: 'bounds', value: '-180,-85,180,85' },
        ]),
      };
    }
    if (
      query.includes(
        'SELECT zoom_level, tile_column, tile_row, tile_data FROM tiles',
      )
    ) {
      return {
        all: jest.fn().mockReturnValue([
          {
            zoom_level: 0,
            tile_column: 0,
            tile_row: 0,
            tile_data: Buffer.from('test-tile-data'),
          },
        ]),
      };
    }
    if (query.includes('SELECT MIN(zoom_level)')) {
      return {
        get: jest.fn().mockReturnValue({ minzoom: 0 }),
      };
    }
    if (query.includes('SELECT MAX(zoom_level)')) {
      return {
        get: jest.fn().mockReturnValue({ maxzoom: 1 }),
      };
    }
    if (query.includes('SELECT MIN(tile_column)')) {
      return {
        get: jest.fn().mockReturnValue({
          minx: 0,
          miny: 0,
          maxx: 0,
          maxy: 0,
        }),
      };
    }
    if (query.includes('SELECT tile_data FROM tiles LIMIT 1')) {
      return {
        get: jest.fn().mockReturnValue({
          tile_data: Buffer.from('test-tile-data'),
        }),
      };
    }
    return {
      all: jest.fn().mockReturnValue([]),
      get: jest.fn().mockReturnValue({}),
    };
  });

  const mockDb = {
    prepare: mockPrepare,
    close: jest.fn(),
  };

  return jest.fn().mockReturnValue(mockDb);
});

// Mock @mapbox/tiletype
jest.mock('@mapbox/tiletype', () => ({
  type: jest.fn().mockReturnValue('png'),
}));

// Mock fs
jest.mock('node:fs', () => ({
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn().mockReturnValue({
    on: jest.fn().mockImplementation(function (this: any, event, callback) {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
    }),
  }),
}));

// Mock archiver
jest.mock('archiver', () => {
  const mockArchiver = {
    pipe: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockResolvedValue(undefined),
  };
  return jest.fn().mockReturnValue(mockArchiver);
});

describe('mbtilesConverter', () => {
  let mockDatabase: jest.Mock;
  let mockArchiver: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabase = require('better-sqlite3');
    mockArchiver = require('archiver');
    // We don't need to mock tiletype as it's not directly used in the test
  });

  it('should convert MBTiles to SMP format', async () => {
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';

    await convertMBTilesToSMP(mbtilesPath, outputPath);

    // Verify that the directory was created
    expect(require('node:fs').mkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );

    // Verify that the database was opened with the correct path
    expect(mockDatabase).toHaveBeenCalledWith(mbtilesPath, { readonly: true });

    // Verify that the archive was created
    expect(mockArchiver).toHaveBeenCalledWith('zip', expect.any(Object));

    // Verify that the style.json file was added to the archive
    const archiverInstance = mockArchiver.mock.results[0].value;
    expect(archiverInstance.append).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ name: 'style.json' }),
    );

    // Verify that at least one tile was added to the archive
    expect(archiverInstance.append).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.objectContaining({
        name: expect.stringMatching(/s\/0\/0\/0\/0\.png/),
      }),
    );

    // Verify that the archive was finalized
    expect(archiverInstance.finalize).toHaveBeenCalled();
  });

  it('should handle vector MBTiles format', async () => {
    const mbtilesPath = '/path/to/vector.mbtiles';
    const outputPath = '/path/to/output.smp';

    // Mock the metadata query to return pbf format
    const mockPrepare = jest.fn();
    mockPrepare.mockImplementation((query) => {
      if (query.includes('SELECT name, value FROM metadata')) {
        return {
          all: jest.fn().mockReturnValue([{ name: 'format', value: 'pbf' }]),
        };
      }
      return {
        all: jest.fn().mockReturnValue([]),
        get: jest.fn().mockReturnValue({}),
      };
    });

    mockDatabase.mockReturnValueOnce({
      prepare: mockPrepare,
      close: jest.fn(),
    });

    // Expect the function to reject with the correct error message
    await expect(convertMBTilesToSMP(mbtilesPath, outputPath)).rejects.toThrow(
      'Vector MBTiles are not yet supported',
    );
  });

  it('should handle errors during conversion', async () => {
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output.smp';
    const errorMessage = 'Conversion error';

    // Mock the database constructor to throw an error
    mockDatabase.mockImplementationOnce(() => {
      throw new Error(errorMessage);
    });

    // Expect the function to reject with the correct error message
    await expect(convertMBTilesToSMP(mbtilesPath, outputPath)).rejects.toThrow(
      errorMessage,
    );
  });
});
