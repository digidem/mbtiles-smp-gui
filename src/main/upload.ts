import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import crypto from 'node:crypto';
import fsExtra from 'fs-extra';
import SMPGenerator from './smpGenerator';

/**
 * Handle the upload of a file from the renderer process
 * @param event Electron IPC event
 * @param fileData File data object containing either a path or buffer
 * @returns Result of the upload operation
 */
const handleUploadFile = async (
  // eslint-disable-next-line no-undef
  event: Electron.IpcMainEvent,
  fileData: any,
) => {
  console.log('upload-file received from renderer process', fileData);

  if (!fileData) {
    console.log('No file data received.');
    return { canceled: true, error: { message: 'No file data received.' } };
  }

  try {
    // Create a unique hash for the temporary folder
    const hashInput =
      typeof fileData === 'string'
        ? fileData + Date.now().toString()
        : (fileData.path || fileData.name || 'unknown') + Date.now().toString();

    const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

    console.log(`Generated hash length: ${hash.length}, hash: ${hash}`);
    const tempDir = path.join(os.tmpdir(), 'comapeo-smp');
    const outputDir = path.join(tempDir, hash);

    // Ensure temp directories exist
    fsExtra.ensureDirSync(outputDir);
    console.log(`Directories and file paths set: outputDir=${outputDir}`);

    // Determine the file path to use
    let mbtilesPath: string;

    if (typeof fileData === 'string') {
      // Legacy support for string file paths
      mbtilesPath = fileData;
      console.log(`Using direct file path: ${mbtilesPath}`);
    } else if (fileData.type === 'path') {
      // Direct file path from file dialog
      mbtilesPath = fileData.path;
      console.log(`Using file path from dialog: ${mbtilesPath}`);
    } else if (fileData.type === 'buffer') {
      // File buffer from drag and drop
      console.log('Processing file buffer from drag and drop');

      // Create a temporary file from the buffer
      const tempFilePath = path.join(
        outputDir,
        fileData.name || 'temp.mbtiles',
      );

      // Convert ArrayBuffer to Buffer if needed
      const buffer =
        fileData.buffer instanceof Buffer
          ? fileData.buffer
          : Buffer.from(fileData.buffer);

      // Write the buffer to a temporary file
      fs.writeFileSync(tempFilePath, buffer);
      console.log(`Wrote temporary file: ${tempFilePath}`);

      mbtilesPath = tempFilePath;
    } else {
      throw new Error('Invalid file data format');
    }

    // Verify the file exists and is accessible
    if (!fs.existsSync(mbtilesPath)) {
      throw new Error(`MBTiles file does not exist at path: ${mbtilesPath}`);
    }

    // Try to access the file to verify permissions
    try {
      fs.accessSync(mbtilesPath, fs.constants.R_OK);
    } catch (accessError) {
      throw new Error(`Cannot access MBTiles file: ${accessError.message}`);
    }

    console.log(`Using MBTiles file at: ${mbtilesPath}`);

    // Convert the file to SMP
    const generator = new SMPGenerator();

    // Create a temporary SMP file
    const smpFilePath = path.join(outputDir, 'map.smp');

    // Before creating the SMP file, ensure the directory exists
    fsExtra.ensureDirSync(path.dirname(smpFilePath));

    // Convert MBTiles to SMP
    await generator.fromMbtiles(mbtilesPath, smpFilePath);

    // Extract the SMP file to the output directory
    fsExtra.ensureDirSync(outputDir);
    await generator.extractSMP(smpFilePath, outputDir);

    console.log(`File converted to SMP: ${mbtilesPath}`);
    const downloadUrl = `file://${smpFilePath}`;
    // Get OS information and default application folder
    const osType = os.type();
    const homeDir = os.homedir();

    return {
      canceled: false,
      filePath: mbtilesPath, // Use mbtilesPath instead of filePath
      outputDir,
      downloadUrl,
      osType,
      homeDir,
    };
  } catch (error) {
    console.error('Error during conversion:', error);
    return {
      canceled: true,
      error: (error as Error).message,
    };
  }
};

ipcMain.on('upload-file', async (event, fileData) => {
  console.log(
    'upload-file event received in main process',
    typeof fileData === 'object' ? `${fileData.type} data` : 'string path',
  );

  try {
    // First, notify the renderer that we've received the file and are starting to process it
    event.reply('upload-file-response', { uploaded: true });

    // Then process the file
    const result = await handleUploadFile(event, fileData);

    // Finally, send the result back to the renderer
    console.log('Sending result back to renderer', result);
    event.reply('upload-file-response', result);
  } catch (error) {
    console.error('Error in upload-file handler:', error);
    event.reply('upload-file-response', {
      canceled: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default handleUploadFile;
