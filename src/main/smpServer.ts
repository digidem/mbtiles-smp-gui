import path from 'node:path';
import { shell } from 'electron';
import { createServer } from 'node:http';
import fs, { createReadStream } from 'node:fs';

// Track active servers to avoid creating duplicates
const activeServers: Map<
  string,
  { server: any; port: number; extractedDir: string }
> = new Map();

// Track servers by port to avoid port conflicts
const portToFilePath: Map<number, string> = new Map();

/**
 * Stop a server for a specific SMP file
 * @param smpFilePath Path to the SMP file
 * @returns Promise that resolves when the server is stopped
 */
export async function stopSMPServer(smpFilePath: string): Promise<void> {
  const serverInfo = activeServers.get(smpFilePath);
  if (serverInfo) {
    return new Promise((resolve) => {
      // Close the server
      serverInfo.server.close(() => {
        // Remove from active servers
        activeServers.delete(smpFilePath);
        // Remove from port mapping
        portToFilePath.delete(serverInfo.port);
        console.log(`SMP server for ${smpFilePath} stopped`);
        resolve();
      });
    });
  }
  return Promise.resolve();
}

/**
 * Stop a server running on a specific port
 * @param port Port number
 * @returns Promise that resolves when the server is stopped
 */
async function stopServerByPort(port: number): Promise<void> {
  const filePath = portToFilePath.get(port);
  if (filePath) {
    console.log(`Stopping server on port ${port} for file ${filePath}`);
    await stopSMPServer(filePath);
  }
}

/**
 * Get the content type for a file based on its extension
 * @param filePath Path to the file
 * @returns Content type string
 */
function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
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

  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Transform a URL to use the server URL
 * @param url URL to transform
 * @param baseUrl Base URL to use
 * @returns Transformed URL
 */
function transformUrl(url: string, baseUrl: string): string {
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
 * Open the SMP file in the default browser using the styled-map-package viewer
 * @param smpFilePath Path to the SMP file
 * @returns Promise that resolves when the browser is opened
 */
export async function openSMPInBrowser(smpFilePath: string): Promise<void> {
  // Ensure the file exists
  if (!fs.existsSync(smpFilePath)) {
    throw new Error(`SMP file not found: ${smpFilePath}`);
  }

  // Use the styled-map-package viewer website
  const smpViewerUrl = 'http://localhost:3000';

  console.log(`Opening SMP file in browser: ${smpFilePath}`);

  // Open the URL in the default browser
  await shell.openExternal(smpViewerUrl);
}

/**
 * Start a server to serve an SMP file preview
 * @param smpFilePath Path to the SMP file
 * @param port Port to serve on (optional, defaults to 3000)
 * @returns Promise that resolves to the server URL
 */
export async function startSMPServer(
  smpFilePath: string,
  port = 3000,
): Promise<string> {
  // Check if we already have a server for this file
  if (activeServers.has(smpFilePath)) {
    const serverInfo = activeServers.get(smpFilePath)!;
    return `http://localhost:${serverInfo.port}`;
  }

  // Check if there's already a server running on this port
  if (portToFilePath.has(port)) {
    console.log(
      `Port ${port} is already in use by another server. Stopping that server first.`,
    );
    await stopServerByPort(port);
  }

  // Ensure the file exists
  if (!fs.existsSync(smpFilePath)) {
    throw new Error(`SMP file not found: ${smpFilePath}`);
  }

  // Get the absolute path to the SMP file
  const absoluteSmpPath = path.resolve(smpFilePath);

  // Get the directory containing the extracted SMP files
  const { extractedDir } = activeServers.get(smpFilePath) || {
    extractedDir: path.dirname(absoluteSmpPath),
  };
  console.log(`Using extracted SMP directory: ${extractedDir}`);

  // Create an HTTP server
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://localhost:${port}`);
      const { pathname } = url;

      // Serve the main HTML page
      if (pathname === '/' || pathname === '/index.html') {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMP Viewer</title>
  <script src="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js"></script>
  <link href="https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css" rel="stylesheet" />
  <script src="https://unpkg.com/@turf/turf@6/turf.min.js"></script>
  <style>
    body, html {
      margin: 0;
      padding: 0;
      height: 100%;
      width: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #map {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    // Create a map instance
    const map = new maplibregl.Map({
      container: 'map',
      style: '/style.json',  // Point to the style.json endpoint
      center: [0, 0],
      zoom: 2
    });

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl());
    map.addControl(new maplibregl.ScaleControl());

    // Handle errors
    map.on('error', (e) => {
      console.error('Map error:', e.error);
    });

    // Display bounds of offline tiles on the map
    map.on('style.load', () => {
      try {
        const style = map.getStyle();
        if (style && style.metadata && style.metadata['smp:bounds']) {
          const bounds = style.metadata['smp:bounds'];
          console.log('Map bounds:', bounds);

          // Fit map to bounds
          map.fitBounds(bounds, { padding: 20 });

          // Add bounds outline
          try {
            const boundsPolygon = turf.bboxPolygon(bounds);
            const boundsWindow = turf.polygon([
              turf.bboxPolygon([-180, -85, 180, 85]).geometry.coordinates[0],
              boundsPolygon.geometry.coordinates[0].reverse()
            ]);

            map.addSource('bounds', {
              type: 'geojson',
              data: boundsPolygon
            });

            map.addSource('bounds-window', {
              type: 'geojson',
              data: boundsWindow
            });

            map.addLayer({
              id: 'bounds-fill',
              type: 'fill',
              source: 'bounds-window',
              layout: {},
              paint: {
                'fill-color': '#000000',
                'fill-opacity': 0.5
              }
            });

            map.addLayer({
              id: 'bounds',
              type: 'line',
              source: 'bounds',
              layout: {},
              paint: {
                'line-color': '#7fff0f',
                'line-opacity': 0.6,
                'line-width': 3
              }
            });
          } catch (err) {
            console.error('Error adding bounds:', err);
          }
        }
      } catch (err) {
        console.error('Error loading style:', err);
      }
    });
  </script>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
      }

      // Serve the style.json file
      if (pathname === '/style.json') {
        try {
          // Path to the style.json file in the extracted directory
          const styleFilePath = path.join(extractedDir, 'style.json');

          // Check if the file exists
          if (!fs.existsSync(styleFilePath)) {
            console.error(`Style file not found: ${styleFilePath}`);
            res.writeHead(404);
            res.end('Style file not found');
            return;
          }

          // Read the style.json file
          const styleContent = fs.readFileSync(styleFilePath, 'utf8');

          // Parse the style JSON
          const style = JSON.parse(styleContent);

          // Transform URLs in the style to use the server URL
          const baseUrl = `http://localhost:${port}/`;

          // Transform sprite URL if it exists
          if (style.sprite) {
            style.sprite = transformUrl(style.sprite, baseUrl);
          }

          // Transform glyphs URL if it exists
          if (style.glyphs) {
            style.glyphs = transformUrl(style.glyphs, baseUrl);
          }

          // Transform source URLs
          if (style.sources) {
            Object.keys(style.sources).forEach((sourceId) => {
              const source = style.sources[sourceId];

              // Get the folder ID from the sourceFolders metadata
              // const folderId =
              //   style.metadata?.['smp:sourceFolders']?.[sourceId] || '0';

              // Transform tiles URLs if they exist
              if (source.tiles) {
                source.tiles = source.tiles.map((tileUrl: string) => {
                  // Keep the template variables as they are
                  const processedUrl = tileUrl.replace('smp://', '');
                  return `${baseUrl}${processedUrl}`;
                });
              }

              // Transform url if it exists (for raster sources)
              if (source.url) {
                source.url = transformUrl(source.url, baseUrl);
              }
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(style));
          return;
        } catch (error) {
          console.error('Error serving style.json:', error);
          res.writeHead(500);
          res.end('Error serving style.json');
          return;
        }
      }

      // Check if this is a tile request with template variables
      const tileMatch = pathname.match(
        /^\/maps\.v1\/s\/(\d+)\/(\d+)\/(\d+)\/(\d+)\.(\w+)$/,
      );
      if (tileMatch) {
        try {
          const [, folderId, z, x, y, format] = tileMatch;

          // Construct the path to the tile
          const tilePath = path.join(
            extractedDir,
            `s/${folderId}/${z}/${x}/${y}.${format}`,
          );

          console.log(`Tile request: ${pathname} -> ${tilePath}`);

          // Check if the file exists
          if (!fs.existsSync(tilePath)) {
            console.error(`Tile not found: ${tilePath}`);
            res.writeHead(404);
            res.end('Tile not found');
            return;
          }

          // Get file stats
          const stats = fs.statSync(tilePath);

          // Determine content type based on file extension
          const contentType = getContentType(tilePath);

          // Set headers
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': stats.size.toString(),
          });

          // Stream the file to the response
          const fileStream = createReadStream(tilePath);
          fileStream.pipe(res);

          return;
        } catch (error) {
          console.error(`Error serving tile: ${error}`);
          res.writeHead(500);
          res.end('Error serving tile');
          return;
        }
      }

      // Check if this is a tile request with template variables in the URL
      const templateTileMatch = pathname.match(
        /^\/maps\.v1\/s\/(\d+)\/\{z\}\/\{x\}\/\{y\}\.(\w+)$/,
      );
      if (templateTileMatch) {
        console.error(
          `Template tile request received: ${pathname}. This should not happen directly.`,
        );
        res.writeHead(400);
        res.end(
          'Template tile request received. This should not happen directly.',
        );
        return;
      }

      // Serve other files from the extracted directory
      try {
        // Remove leading slash from pathname
        const resourcePath = pathname.startsWith('/')
          ? pathname.slice(1)
          : pathname;

        // Full path to the resource in the extracted directory
        const filePath = path.join(extractedDir, resourcePath);

        console.log(`Resource request: ${pathname} -> ${filePath}`);

        // Check if the file exists
        if (!fs.existsSync(filePath)) {
          console.error(`File not found: ${filePath}`);
          res.writeHead(404);
          res.end('File not found');
          return;
        }

        // Get file stats
        const stats = fs.statSync(filePath);

        // Determine content type based on file extension
        const contentType = getContentType(filePath);

        // Set headers
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': stats.size.toString(),
        });

        // Stream the file to the response
        const fileStream = createReadStream(filePath);
        fileStream.pipe(res);
      } catch (error) {
        console.error(`Error serving file: ${error}`);
        res.writeHead(500);
        res.end('Error serving file');
      }
    } catch (error) {
      console.error('Server error:', error);
      res.writeHead(500);
      res.end('Internal server error');
    }
  });

  // Start the server on the specified port
  return new Promise<string>((resolve, reject) => {
    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, 'localhost', () => {
      const address = `http://localhost:${port}`;
      console.log(`SMP viewer server listening on ${address}`);

      // Store the server in the active servers map
      activeServers.set(smpFilePath, { server, port, extractedDir });

      // Store the mapping from port to file path
      portToFilePath.set(port, smpFilePath);

      resolve(address);
    });
  });
}

/**
 * Stop all active SMP servers
 * @returns Promise that resolves when all servers are stopped
 */
export async function stopAllSMPServers(): Promise<void> {
  const promises = Array.from(activeServers.entries()).map(([filePath]) =>
    stopSMPServer(filePath),
  );
  await Promise.all(promises);

  // Clear the port mapping
  portToFilePath.clear();

  console.log('All SMP servers stopped');
}
