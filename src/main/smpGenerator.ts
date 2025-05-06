/* eslint-disable class-methods-use-this */
import fs from 'node:fs';
import path from 'node:path';
import fsExtra from 'fs-extra';
import yauzl from 'yauzl';
import { convertMBTilesToSMP } from './mbtilesConverter';

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

    try {
      // Use the convertMBTilesToSMP function from mbtilesConverter.ts
      // This uses styled-map-package's implementation which doesn't require sqlite3
      await convertMBTilesToSMP(mbtilesPath, outputPath);

      console.log(`MBTiles file converted to SMP format at ${outputPath}`);
    } catch (error) {
      console.error('Error converting MBTiles to SMP:', error);
      throw error;
    }
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
