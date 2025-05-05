import { ipcMain } from 'electron';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fsExtra from 'fs-extra';
import SMPGenerator from './smpGenerator';

/**
 * Handle the upload of a file from the renderer process
 * @param event Electron IPC event
 * @param filePath Path to the uploaded file
 * @returns Result of the upload operation
 */
const handleUploadFile = async (
  // eslint-disable-next-line no-undef
  event: Electron.IpcMainEvent,
  filePath: string,
) => {
  console.log('upload-file received from renderer process', filePath);
  if (!filePath) {
    console.log('No file path received.');
    return { canceled: true, error: { message: 'No file path received.' } };
  }
  try {
    // Create a unique hash for the temporary folder
    const hash = crypto
      .createHash('sha256')
      .update(filePath + Date.now().toString())
      .digest('hex');
    console.log(`Generated hash length: ${hash.length}, hash: ${hash}`);
    const outputDir = path.join(os.tmpdir(), 'comapeo-smp', hash);
    console.log(`Directories and file paths set: outputDir=${outputDir}`);

    // Convert the file to SMP
    const generator = new SMPGenerator();

    // Create a temporary SMP file
    const smpFilePath = path.join(outputDir, 'map.smp');

    // Before creating the SMP file, ensure the directory exists
    fsExtra.ensureDirSync(path.dirname(smpFilePath));

    // Convert MBTiles to SMP
    await generator.fromMbtiles(filePath, smpFilePath);

    // Extract the SMP file to the output directory
    fsExtra.ensureDirSync(outputDir);
    await generator.extractSMP(smpFilePath, outputDir);

    console.log(`File converted to SMP: ${filePath}`);
    const downloadUrl = `file://${smpFilePath}`;
    // Get OS information and default application folder
    const osType = os.type();
    const homeDir = os.homedir();

    return {
      canceled: false,
      filePath,
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

ipcMain.on('upload-file', async (event, filePath) => {
  console.log('upload-file event received in main process', filePath);
  try {
    // First, notify the renderer that we've received the file and are starting to process it
    event.reply('upload-file-response', { uploaded: true });

    // Then process the file
    const result = await handleUploadFile(event, filePath);

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
