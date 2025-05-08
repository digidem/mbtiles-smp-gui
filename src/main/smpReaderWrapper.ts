/**
 * This is a simple SMP reader implementation that extracts files from an SMP file (which is a ZIP archive).
 * It provides a simplified interface for reading the style.json and other resources from the SMP file.
 */
// import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import yauzl from 'yauzl';

// Define the Resource interface
export interface Resource {
  contentType: string;
  contentLength: number;
  contentEncoding?: string;
  // eslint-disable-next-line no-undef
  stream: NodeJS.ReadableStream;
}

// Define the SmpReader interface
export interface SmpReader {
  getStyle(baseUrl: string | null): Promise<any>;
  getResource(path: string): Promise<Resource>;
  close(): Promise<void>;
}

// Map file extensions to content types
const contentTypes: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pbf': 'application/x-protobuf',
  '.mvt': 'application/x-protobuf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
};

// Get content type based on file extension
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Simple SMP reader implementation
 */
class SimpleSmpReader implements SmpReader {
  private filePath: string;

  private zipFile: yauzl.ZipFile | null = null;

  private styleCache: any | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Open the ZIP file
   */
  private async openZip(): Promise<yauzl.ZipFile> {
    if (this.zipFile) {
      return this.zipFile;
    }

    return new Promise<yauzl.ZipFile>((resolve, reject) => {
      yauzl.open(this.filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open ZIP file'));
          return;
        }
        this.zipFile = zipfile;
        resolve(zipfile);
      });
    });
  }

  /**
   * Get a file from the ZIP archive
   */
  private async getFileFromZip(filePath: string): Promise<Buffer> {
    console.log(`Getting file from ZIP: ${filePath}`);
    const zipFile = await this.openZip();

    return new Promise<Buffer>((resolve, reject) => {
      const normalizedPath = filePath.startsWith('/')
        ? filePath.slice(1)
        : filePath;
      console.log(`Normalized path: ${normalizedPath}`);

      // Read all entries until we find the one we want
      const chunks: Buffer[] = [];
      const entries: string[] = [];

      zipFile.on('entry', (entry) => {
        entries.push(entry.fileName);

        if (entry.fileName === normalizedPath) {
          console.log(`Found entry: ${entry.fileName}`);
          // Found the file we want
          zipFile.openReadStream(entry, (err, stream) => {
            if (err || !stream) {
              console.error(
                `Failed to open read stream for ${entry.fileName}:`,
                err,
              );
              reject(
                err ||
                  new Error(`Failed to open read stream for ${entry.fileName}`),
              );
              return;
            }

            stream.on('data', (chunk) => {
              chunks.push(chunk);
            });

            stream.on('end', () => {
              console.log(
                `Read ${chunks.length} chunks from ${entry.fileName}`,
              );
              resolve(Buffer.concat(chunks));
            });

            stream.on('error', (streamErr) => {
              console.error(
                `Error reading stream for ${entry.fileName}:`,
                streamErr,
              );
              reject(streamErr);
            });
          });
        } else {
          // Not the file we want, continue to the next entry
          zipFile.readEntry();
        }
      });

      zipFile.on('end', () => {
        console.error(`File not found in ZIP: ${normalizedPath}`);
        console.log(`Available entries: ${entries.join(', ')}`);
        reject(new Error(`File not found in ZIP: ${normalizedPath}`));
      });

      zipFile.on('error', (err) => {
        console.error(`Error reading ZIP file:`, err);
        reject(err);
      });

      // Start reading entries
      zipFile.readEntry();
    });
  }

  /**
   * Get the style JSON from the SMP file
   */
  async getStyle(baseUrl: string | null): Promise<any> {
    // If we already have the style cached, return it
    if (this.styleCache) {
      return this.transformUrls(this.styleCache, baseUrl);
    }

    try {
      // Get the style.json file from the ZIP
      const styleBuffer = await this.getFileFromZip('style.json');

      // Parse the JSON
      const style = JSON.parse(styleBuffer.toString('utf8'));

      // Cache the style
      this.styleCache = style;

      // Transform URLs if a base URL is provided
      return this.transformUrls(style, baseUrl);
    } catch (error) {
      console.error('Error getting style.json:', error);
      throw error;
    }
  }

  /**
   * Transform URLs in the style JSON to use the provided base URL
   */
  private transformUrls(style: any, baseUrl: string | null): any {
    if (!baseUrl) {
      return style;
    }

    // Create a deep copy of the style
    const transformedStyle = JSON.parse(JSON.stringify(style));

    // Transform sprite URL if it exists
    if (transformedStyle.sprite) {
      transformedStyle.sprite = this.getUrl(transformedStyle.sprite, baseUrl);
    }

    // Transform glyphs URL if it exists
    if (transformedStyle.glyphs) {
      transformedStyle.glyphs = this.getUrl(transformedStyle.glyphs, baseUrl);
    }

    // Transform source URLs
    if (transformedStyle.sources) {
      Object.keys(transformedStyle.sources).forEach((sourceId) => {
        const source = transformedStyle.sources[sourceId];

        // Transform tiles URLs if they exist
        if (source.tiles) {
          source.tiles = source.tiles.map((tile: string) =>
            this.getUrl(tile, baseUrl),
          );
        }

        // Transform url if it exists (for raster sources)
        if (source.url) {
          source.url = this.getUrl(source.url, baseUrl);
        }

        // Handle TileJSON sources
        if (source.tiles && Array.isArray(source.tiles)) {
          source.tiles = source.tiles.map((tileUrl: string) => {
            // Special handling for smp:// protocol
            if (tileUrl.startsWith('smp://')) {
              return this.getUrl(tileUrl.replace('smp://', ''), baseUrl);
            }
            return this.getUrl(tileUrl, baseUrl);
          });
        }
      });
    }

    return transformedStyle;
  }

  /**
   * Get a full URL by combining the base URL with a relative URL
   */
  // eslint-disable-next-line class-methods-use-this
  private getUrl(url: string, baseUrl: string): string {
    // If the URL is already absolute, return it as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Special handling for smp:// protocol
    let modifiedUrl = url;
    if (modifiedUrl.startsWith('smp://')) {
      modifiedUrl = modifiedUrl.replace('smp://', '');
    }

    // Remove leading slash if present
    const relativeUrl = modifiedUrl.startsWith('/')
      ? modifiedUrl.slice(1)
      : modifiedUrl;

    // Combine the base URL with the relative URL
    return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${relativeUrl}`;
  }

  /**
   * Get a resource from the SMP file
   */
  async getResource(resourcePath: string): Promise<Resource> {
    try {
      console.log(`Getting resource: ${resourcePath}`);

      // Handle smp:// protocol
      let modifiedResourcePath = resourcePath;
      if (modifiedResourcePath.startsWith('smp://')) {
        modifiedResourcePath = modifiedResourcePath.replace('smp://', '');
        console.log(`Transformed resource path: ${modifiedResourcePath}`);
      }

      // Get the file from the ZIP
      const buffer = await this.getFileFromZip(modifiedResourcePath);

      // Create a readable stream from the buffer
      const stream = Readable.from(buffer);

      // Determine content type
      const contentType = getContentType(resourcePath);
      console.log(
        `Resource ${modifiedResourcePath} loaded successfully, content type: ${contentType}, size: ${buffer.length}`,
      );

      // Return the resource
      return {
        contentType,
        contentLength: buffer.length,
        stream,
      };
    } catch (error) {
      console.error(`Error getting resource ${resourcePath}:`, error);
      throw error;
    }
  }

  /**
   * Close the ZIP file
   */
  async close(): Promise<void> {
    if (this.zipFile) {
      this.zipFile.close();
      this.zipFile = null;
    }
  }
}

/**
 * Create an SMP reader instance
 */
export async function createReader(filePath: string): Promise<SmpReader> {
  return new SimpleSmpReader(filePath);
}
