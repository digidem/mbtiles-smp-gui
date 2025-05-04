import { ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';

const copyRecursiveSync = (src: string, dest: string) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName),
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const handleCopyDefaultFolder = async (
  // eslint-disable-next-line no-undef
  event: Electron.IpcMainEvent,
  outputDir: string,
) => {
  console.log('copy-default-folder received from renderer process', outputDir);
  if (!outputDir) {
    console.log('No output directory received.');
    return {
      canceled: true,
      error: { message: 'No output directory received.' },
    };
  }
  event.reply('copy-default-folder-response', { copied: true });
  try {
    let mapeoTilesDir: string;
    const osType = os.type();

    if (osType === 'Windows_NT') {
      mapeoTilesDir = path.join(
        os.homedir(),
        'AppData',
        'Roaming',
        'Mapeo',
        'styles',
      );
    } else if (osType === 'Darwin') {
      mapeoTilesDir = path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'Mapeo',
        'styles',
      );
    } else {
      mapeoTilesDir = path.join(os.homedir(), '.config', 'Mapeo', 'styles');
    }

    const defaultDir = path.join(mapeoTilesDir, 'default');
    console.log(`Mapeo tiles directory: ${mapeoTilesDir}`);
    console.log(`Default directory: ${defaultDir}`);

    if (!fs.existsSync(mapeoTilesDir)) {
      console.log(
        `Mapeo tiles directory does not exist. Creating: ${mapeoTilesDir}`,
      );
      fs.mkdirSync(mapeoTilesDir, { recursive: true });
    } else {
      console.log(`Mapeo tiles directory already exists: ${mapeoTilesDir}`);
    }

    if (fs.existsSync(defaultDir)) {
      let index = 1;
      let backupDir;
      do {
        backupDir = path.join(mapeoTilesDir, `default-${index}`);
        index += 1;
      } while (fs.existsSync(backupDir));
      console.log(`Backing up existing default folder to: ${backupDir}`);
      fs.renameSync(defaultDir, backupDir);
    }

    console.log(`Copying files from ${outputDir} to ${defaultDir}`);
    copyRecursiveSync(outputDir, defaultDir);
    console.log(`Files copied to Mapeo tiles directory: ${defaultDir}`);
    return {
      canceled: false,
      outputDir,
      mapeoTilesDir,
    };
  } catch (error) {
    console.error('Error during copying:', error);
    return {
      canceled: true,
      error: (error as Error).message,
    };
  }
};

ipcMain.on('copy-default-folder', async (event, outputDir) => {
  console.log('Received copy-default-folder event');
  const result = await handleCopyDefaultFolder(event, outputDir);
  console.log(
    'Sending copy-default-folder-response event with result:',
    result,
  );
  event.reply('copy-default-folder-response', result);
});

export default handleCopyDefaultFolder;
