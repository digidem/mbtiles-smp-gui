import { ipcMain } from 'electron';
import { startSMPServer, stopSMPServer, openSMPInBrowser } from './smpServer';

// Handle IPC messages for the SMP viewer
ipcMain.handle('start-smp-server', async (event, smpFilePath: string) => {
  try {
    console.log(`Starting SMP server for ${smpFilePath}`);
    const serverUrl = await startSMPServer(smpFilePath);
    console.log(`SMP server started at ${serverUrl}`);
    return { success: true, serverUrl };
  } catch (error) {
    console.error('Error starting SMP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

ipcMain.handle('stop-smp-server', async (event, smpFilePath: string) => {
  try {
    console.log(`Stopping SMP server for ${smpFilePath}`);
    await stopSMPServer(smpFilePath);
    return { success: true };
  } catch (error) {
    console.error('Error stopping SMP server:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// Handle IPC messages for opening the SMP file in the browser
ipcMain.handle('open-smp-in-browser', async (event, smpFilePath: string) => {
  try {
    console.log(`Opening SMP file in browser: ${smpFilePath}`);
    await openSMPInBrowser(smpFilePath);
    return { success: true };
  } catch (error) {
    console.error('Error opening SMP file in browser:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});
