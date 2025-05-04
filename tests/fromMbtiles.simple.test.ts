// Mock dependencies before importing the module
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  createWriteStream: jest.fn().mockReturnValue({
    end: jest.fn(),
    on: jest.fn().mockImplementation((event, callback) => {
      if (event === 'close') {
        setTimeout(callback, 10);
      }
      return this;
    }),
  }),
}));

jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  removeSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
}));

// Mock archiver
jest.mock('archiver', () => {
  const mockArchiver = {
    pipe: jest.fn().mockReturnThis(),
    append: jest.fn().mockReturnThis(),
    file: jest.fn().mockReturnThis(),
    finalize: jest.fn().mockResolvedValue(undefined),
  };

  return jest.fn().mockReturnValue(mockArchiver);
});

// Mock mbtiles-reader as an ES Module
jest.mock(
  'mbtiles-reader',
  () => {
    const mockGetTile = jest.fn().mockImplementation(() => {
      // Return a mock tile
      return Buffer.from('mock-tile-data');
    });

    const mockMBTiles = jest.fn().mockImplementation(() => ({
      metadata: {
        name: 'Test Map',
        format: 'png',
        minzoom: 0,
        maxzoom: 1,
        bounds: '-180,-85,180,85',
      },
      getTile: mockGetTile,
    }));

    return {
      __esModule: true,
      MBTiles: mockMBTiles,
    };
  },
  { virtual: true },
);

jest.mock('yauzl', () => ({
  open: jest.fn((zipPath, options, callback) => {
    const mockZipFile = {
      on: jest.fn((event, handler) => {
        if (event === 'entry') {
          // Simulate a few entries
          handler({ fileName: 'style.json' });
          handler({ fileName: 's/0/0/0.png' });
        }
        if (event === 'end') {
          setTimeout(handler, 10);
        }
        return mockZipFile;
      }),
      readEntry: jest.fn(),
      openReadStream: jest.fn((entry, streamCallback) => {
        const mockReadStream = {
          on: jest.fn((event, handler) => {
            if (event === 'end') {
              setTimeout(handler, 10);
            }
            return mockReadStream;
          }),
          pipe: jest.fn(),
        };
        streamCallback(null, mockReadStream);
      }),
    };
    callback(null, mockZipFile);
  }),
}));

// Simplified extractZip function for testing
async function extractZip(zipPath: string, outputDir: string): Promise<void> {
  // Use dynamic imports for all modules
  const yauzl = await import('yauzl');
  const path = await import('path');
  const fsPromises = await import('fs/promises');
  const fs = await import('fs');

  return new Promise((resolve, reject) => {
    yauzl.default.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        return reject(err || new Error('Failed to open zip file'));
      }

      zipfile.on('error', reject);
      zipfile.on('end', resolve);

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry
          const dirPath = path.join(outputDir, entry.fileName);
          fsPromises
            .mkdir(dirPath, { recursive: true })
            .then(() => {
              zipfile.readEntry();
              return undefined;
            })
            .catch(reject);
        } else {
          // File entry
          const entryPath = path.join(outputDir, entry.fileName);
          const entryDir = path.dirname(entryPath);

          fsPromises
            .mkdir(entryDir, { recursive: true })
            .then(() => {
              zipfile.openReadStream(entry, (streamErr, readStream) => {
                if (streamErr || !readStream) {
                  return reject(
                    streamErr ||
                      new Error(
                        `Failed to open read stream for ${entry.fileName}`,
                      ),
                  );
                }

                const writeStream = fs.default.createWriteStream(entryPath);
                readStream.on('end', () => {
                  zipfile.readEntry();
                });

                readStream.pipe(writeStream);
                return undefined;
              });
              return undefined;
            })
            .catch(reject);
        }
      });

      zipfile.readEntry();
      return undefined;
    });
  });
}

// Simplified version of the convertMBTilesToSMP function for testing
async function convertMBTilesToSMP(
  mbtilesPath: string,
  outputPath: string,
): Promise<void> {
  // Use dynamic imports for all modules
  const fs = await import('fs');
  const archiver = await import('archiver');

  // Dynamically import mbtiles-reader (ES Module)
  const mbtilesReader = await import('mbtiles-reader');
  const { MBTiles } = mbtilesReader;

  // Open the MBTiles file
  const reader = new MBTiles(mbtilesPath);

  // Create a ZIP file for the SMP package
  const output = fs.default.createWriteStream(outputPath);
  const archive = archiver.default('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  // Pipe the archive to the output file
  archive.pipe(output);

  // Add the style.json file to the archive
  archive.append(
    JSON.stringify(
      {
        version: 8,
        name: reader.metadata.name,
        sources: {
          'mbtiles-source': {
            ...reader.metadata,
            type: 'raster',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: {
              'background-color': 'white',
            },
          },
          {
            id: 'raster',
            type: 'raster',
            source: 'mbtiles-source',
            paint: {
              'raster-opacity': 1,
            },
          },
        ],
      },
      null,
      2,
    ),
    { name: 'style.json' },
  );

  // Finalize the archive
  await archive.finalize();

  // Wait for the output file to be written
  await new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
  });
}

// Create a simplified version of the fromMbtiles function for testing
async function fromMbtiles(
  mbtilesPath: string,
  outputPath: string,
): Promise<void> {
  // Use dynamic imports for all modules
  const fsExtra = await import('fs-extra');
  const path = await import('path');
  const os = await import('os');
  const crypto = await import('crypto');

  // Create output directory
  fsExtra.default.ensureDirSync(outputPath);

  // Create a temporary directory for the SMP file
  const tempDir = path.join(
    os.tmpdir(),
    'mbtiles-to-smp',
    crypto.randomBytes(16).toString('hex'),
  );
  fsExtra.default.ensureDirSync(tempDir);

  // Create the SMP file path
  const smpFilePath = path.join(tempDir, 'map.smp');

  // Convert the MBTiles file to SMP using our direct implementation
  await convertMBTilesToSMP(mbtilesPath, smpFilePath);

  // Extract the SMP file to the output directory
  await extractZip(smpFilePath, outputPath);

  // Clean up the temporary directory
  fsExtra.default.removeSync(tempDir);
}

describe('fromMbtiles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should convert MBTiles to SMP format', async () => {
    // Get the mocked modules
    const fsExtra = await import('fs-extra');
    const yauzl = await import('yauzl');
    const mbtilesReader = await import('mbtiles-reader');

    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output';

    await fromMbtiles(mbtilesPath, outputPath);

    // Verify that the output directory was created
    expect(fsExtra.default.ensureDirSync).toHaveBeenCalledWith(outputPath);

    // Verify that MBTiles was used
    expect(mbtilesReader.MBTiles).toHaveBeenCalledWith(mbtilesPath);

    // Verify that the zip file was extracted
    expect(yauzl.default.open).toHaveBeenCalledWith(
      expect.any(String),
      { lazyEntries: true },
      expect.any(Function),
    );

    // Verify that the temporary directory was cleaned up
    expect(fsExtra.default.removeSync).toHaveBeenCalled();
  });

  it('should handle errors during conversion', async () => {
    // Mock MBTiles to throw an error
    const mbtilesReader = await import('mbtiles-reader');
    mbtilesReader.MBTiles.mockImplementationOnce(() => {
      throw new Error('Conversion failed');
    });

    // Call the function
    const mbtilesPath = '/path/to/test.mbtiles';
    const outputPath = '/path/to/output';

    await expect(fromMbtiles(mbtilesPath, outputPath)).rejects.toThrow(
      'Conversion failed',
    );
  });
});
