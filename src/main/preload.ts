// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels = 'ipc-example' | 'upload-file' | 'upload-file-response';

const electronHandler = {
  ipcRenderer: {
    sendMessage(channel: Channels, ...args: unknown[]) {
      // Handle ArrayBuffer objects for drag and drop
      if (
        channel === 'upload-file' &&
        args[0] &&
        typeof args[0] === 'object' &&
        args[0].type === 'buffer'
      ) {
        console.log('Sending file buffer via IPC');
        // Convert ArrayBuffer to Buffer for IPC transfer
        const fileData = args[0];
        if (fileData.buffer && fileData.buffer instanceof ArrayBuffer) {
          // Create a copy of the object with the buffer converted to a Buffer
          const newArgs = [
            {
              ...fileData,
              buffer: Buffer.from(fileData.buffer),
            },
          ];
          ipcRenderer.send(channel, ...newArgs);
          return;
        }
      }

      // Default handling for other messages
      ipcRenderer.send(channel, ...args);
    },
    on(channel: Channels, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: Channels, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
