/* eslint-disable class-methods-use-this */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import archiver from 'archiver';
import fsExtra from 'fs-extra';
import sqlite3 from 'sqlite3';
import yauzl from 'yauzl';

/**
 * Class to generate SMP (Styled Map Package) files from MBTiles
 */
class SMPGenerator {
  /**
   * Convert MBTiles to SMP format
   * @param mbtilesPath Path to the MBTiles file
   * @param outputPath Path where the SMP file will be saved
   * @returns Promise that resolves when the conversion is complete
   */
  async fromMbtiles(mbtilesPath: string, outputPath: string): Promise<void> {
    console.log(`Converting MBTiles file: ${mbtilesPath}`);
    console.log(`Output path: ${outputPath}`);

    // Use SQLite directly to extract tiles from MBTiles
    const db = new sqlite3.Database(mbtilesPath);

    try {
      // Get metadata
      const metadata = await SMPGenerator.getMetadata(db);

      // Check if it's a vector MBTiles (not supported yet)
      if (metadata.format === 'pbf') {
        throw new Error('Vector MBTiles are not yet supported');
      }

      // Create a temporary directory for the SMP contents
      const tempDir = path.join(
        os.tmpdir(),
        'mbtiles-to-smp',
        crypto.randomBytes(16).toString('hex'),
      );
      fsExtra.ensureDirSync(tempDir);

      try {
        // Create the style.json file
        const style = SMPGenerator.createStyle(metadata);
        const stylePath = path.join(tempDir, 'style.json');
        fs.writeFileSync(stylePath, JSON.stringify(style, null, 2));

        // Create the source directory with 's/0' as the folder structure
        const SOURCE_FOLDER = 's';
        const FOLDER_ID = '0';
        const sourceDir = path.join(tempDir, SOURCE_FOLDER, FOLDER_ID);
        fsExtra.ensureDirSync(sourceDir);

        // Process tiles
        await this.processTiles(db, metadata, sourceDir);

        // Create the SMP file
        await SMPGenerator.createSMPArchive(tempDir, outputPath);

        console.log(`MBTiles file converted to SMP format at ${outputPath}`);
      } finally {
        // Clean up the temporary directory
        fsExtra.removeSync(tempDir);
      }
    } finally {
      // Close the database
      await new Promise<void>((resolve, reject) => {
        db.close((err: Error | null) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    }
  }

  /**
   * Get metadata from the MBTiles file
   * @param db SQLite database
   * @returns Promise that resolves with the metadata
   */
  private static async getMetadata(
    db: sqlite3.Database,
  ): Promise<Record<string, string>> {
    return new Promise<Record<string, string>>((resolve, reject) => {
      db.all(
        'SELECT * FROM metadata',
        (err: Error | null, rows: { name: string; value: string }[]) => {
          if (err) {
            reject(err);
            return;
          }

          const metadata: Record<string, string> = {};
          // biome-ignore lint/complexity/noForEach: <explanation>
          rows.forEach((row) => {
            metadata[row.name] = row.value;
          });

          resolve(metadata);
        },
      );
    });
  }

  /**
   * Create a MapLibre style JSON
   * @param metadata MBTiles metadata
   * @returns Style JSON object
   */
  private static createStyle(
    metadata: Record<string, string>,
  ): Record<string, unknown> {
    const SOURCE_ID = 'mbtiles-source'; // Use 'mbtiles-source' as the source ID
    const FOLDER_ID = '0'; // Use '0' as the folder ID

    // Parse bounds if available
    let bounds = [-180, -85.0511, 180, 85.0511]; // Default to world bounds
    if (metadata.bounds) {
      bounds = metadata.bounds.split(',').map(Number);
    }

    // Create the style object following the MapLibre style specification
    return {
      version: 8,
      name: metadata.name || 'Converted Map',
      sources: {
        [SOURCE_ID]: {
          name: metadata.name || 'Converted Map',
          format: metadata.format || 'png',
          minzoom: Number.parseInt(metadata.minzoom || '0', 10),
          maxzoom: Number.parseInt(metadata.maxzoom || '15', 10),
          type: 'raster',
          description:
            metadata.description || `Tiles from ${metadata.name || 'MBTiles'}`,
          version: metadata.version || '1.0.0',
          attribution: metadata.attribution || '',
          scheme: 'xyz',
          bounds,
          center: [0, 0, 7],
          tiles: [
            `smp://maps.v1/s/${FOLDER_ID}/{z}/{x}/{y}.${metadata.format || 'png'}`,
          ],
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
          source: SOURCE_ID,
          paint: {
            'raster-opacity': 1,
          },
        },
      ],
      metadata: {
        'smp:bounds': bounds,
        'smp:maxzoom': Number.parseInt(metadata.maxzoom || '15', 10),
        'smp:sourceFolders': {
          [SOURCE_ID]: FOLDER_ID,
        },
      },
      center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
      zoom: Math.min(Number.parseInt(metadata.maxzoom || '15', 10) - 2, 13),
    };
  }

  /**
   * Process tiles from the MBTiles file
   * @param db SQLite database
   * @param metadata MBTiles metadata
   * @param sourceDir Directory to save tiles
   */
  private async processTiles(
    this: SMPGenerator,
    db: sqlite3.Database,
    metadata: Record<string, string>,
    sourceDir: string,
  ): Promise<void> {
    // Get zoom levels
    const zoomLevels = await SMPGenerator.getZoomLevels(db);

    console.log(`Found zoom levels: ${zoomLevels.join(', ')}`);

    // Process each zoom level sequentially to avoid await in loop
    await zoomLevels.reduce(async (previousPromise, z) => {
      await previousPromise;
      console.log(`Processing zoom level ${z}`);

      try {
        // Get all tiles for this zoom level
        const tiles = await SMPGenerator.getTilesForZoom(db, z);

        console.log(`Found ${tiles.length} tiles for zoom level ${z}`);

        // Process tiles in batches to avoid for...of loops
        await Promise.all(
          tiles.map(async (tile) => {
            const {
              zoom_level: zoomLevel,
              tile_column: tileColumn,
              tile_row: tileRow,
              tile_data: tileData,
            } = tile;

            // MBTiles uses TMS coordinates (origin bottom-left), but we need XYZ coordinates (origin top-left)
            // Convert TMS y coordinate to XYZ
            const y = 2 ** zoomLevel - 1 - tileRow;

            // Create directory structure for the tile
            const tileDir = path.join(
              sourceDir,
              zoomLevel.toString(),
              tileColumn.toString(),
            );
            fsExtra.ensureDirSync(tileDir);

            // Write the tile to a file
            const format = metadata.format || 'png';
            const tileFilePath = path.join(tileDir, `${y}.${format}`);
            fs.writeFileSync(tileFilePath, tileData);
          }),
        );
      } catch (error) {
        console.error(`Error processing zoom level ${z}:`, error);
      }
      return Promise.resolve();
    }, Promise.resolve());
  }

  /**
   * Get zoom levels from the MBTiles file
   * @param db SQLite database
   * @returns Promise that resolves with the zoom levels
   */
  private static async getZoomLevels(db: sqlite3.Database): Promise<number[]> {
    return new Promise<number[]>((resolve, reject) => {
      db.all(
        'SELECT DISTINCT zoom_level FROM tiles ORDER BY zoom_level',
        (err: Error | null, rows: { zoom_level: number }[]) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows.map((row) => row.zoom_level));
        },
      );
    });
  }

  /**
   * Get tiles for a specific zoom level
   * @param db SQLite database
   * @param zoom Zoom level
   * @returns Promise that resolves with the tiles
   */
  private static async getTilesForZoom(
    db: sqlite3.Database,
    zoom: number,
  ): Promise<
    {
      zoom_level: number;
      tile_column: number;
      tile_row: number;
      tile_data: Buffer;
    }[]
  > {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM tiles WHERE zoom_level = ?',
        [zoom],
        (
          err: Error | null,
          rows: {
            zoom_level: number;
            tile_column: number;
            tile_row: number;
            tile_data: Buffer;
          }[],
        ) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(rows);
        },
      );
    });
  }

  /**
   * Create the SMP file (zip archive)
   * @param sourceDir Source directory containing the SMP contents
   * @param outputPath Output path for the SMP file
   */
  private static async createSMPArchive(
    sourceDir: string,
    outputPath: string,
  ): Promise<void> {
    console.log(`Creating SMP archive: ${outputPath}`);

    // Create a ZIP file for the SMP package
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    });

    // Pipe the archive to the output file
    archive.pipe(output);

    // Add all files from the source directory to the archive
    archive.directory(sourceDir, false);

    // Finalize the archive
    await archive.finalize();

    // Wait for the output file to be written
    await new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });
  }

  /**
   * Extract an SMP file to a directory
   * @param smpPath Path to the SMP file
   * @param outputDir Directory to extract to
   */
  async extractSMP(smpPath: string, outputDir: string): Promise<void> {
    console.log(`Extracting SMP file: ${smpPath}`);
    console.log(`Output directory: ${outputDir}`);

    // Create the output directory if it doesn't exist
    fsExtra.ensureDirSync(outputDir);

    // Extract the SMP file (which is a ZIP file)
    return new Promise<void>((resolve, reject) => {
      yauzl.open(
        smpPath,
        { lazyEntries: true },
        (openErr: Error | null, zipfile: yauzl.ZipFile) => {
          if (openErr || !zipfile) {
            return reject(openErr || new Error('Failed to open SMP file'));
          }

          zipfile.on('error', reject);
          zipfile.on('end', resolve);

          zipfile.on('entry', (entry: yauzl.Entry) => {
            if (/\/$/.test(entry.fileName)) {
              // Directory entry, create the directory then read the next entry
              const dirPath = path.join(outputDir, entry.fileName);
              fs.promises
                .mkdir(dirPath, { recursive: true })
                .then(() => {
                  zipfile.readEntry();
                  return null;
                })
                .catch((dirErr) => {
                  reject(dirErr);
                  return null;
                });
            } else {
              // File entry - create containing folder if needed
              const entryPath = path.join(outputDir, entry.fileName);
              const entryDir = path.dirname(entryPath);

              fs.promises
                .mkdir(entryDir, { recursive: true })
                .then(() => {
                  zipfile.openReadStream(
                    entry,
                    (streamErr: Error | null, readStream: any) => {
                      if (streamErr || !readStream) {
                        return reject(
                          streamErr ||
                            new Error(
                              `Failed to open read stream for ${entry.fileName}`,
                            ),
                        );
                      }

                      const writeStream = fs.createWriteStream(entryPath);
                      readStream.on('end', () => {
                        zipfile.readEntry();
                      });

                      readStream.pipe(writeStream);
                      return null;
                    },
                  );
                  return null;
                })
                .catch((fileErr) => {
                  reject(fileErr);
                  return null;
                });
            }
          });

          zipfile.readEntry();
          return null;
        },
      );
    });
  }
}

export default SMPGenerator;
