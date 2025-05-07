import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

function SingleFileUploadForm() {
  const [uploading, setUploading] = useState<boolean>(false);
  const [results, setResults] = useState<any | null>(null);
  const [failed, setFailed] = useState<any | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  // const [tab, setTab] = useState('mobile');

  const handleUpload = useCallback(async (file: File) => {
    if (!file) return;
    setUploading(true);

    // For drag and drop operations, we need to create a temporary file
    // and copy the contents to ensure we have a valid file path
    if (file.path) {
      // If we have a direct file path (from file dialog), use it
      console.log('Using direct file path:', file.path);
      window.electron.ipcRenderer.sendMessage('upload-file', {
        type: 'path',
        path: file.path,
      });
    } else {
      // For drag and drop, we need to send the file data to the main process
      console.log('Using file blob for drag and drop');

      // Read the file as an ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      // Send the file data to the main process
      window.electron.ipcRenderer.sendMessage('upload-file', {
        type: 'buffer',
        name: file.name,
        buffer: arrayBuffer,
      });
    }
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) {
        const file = acceptedFiles[0];
        /** File validation */
        if (!file.name.endsWith('.mbtiles')) {
          setFailed(
            'Please select a valid .mbtiles file with .mbtiles extension',
          );
          return;
        }

        // Check file size (max 500MB)
        const MAX_SIZE = 500 * 1024 * 1024; // 500MB in bytes
        if (file.size > MAX_SIZE) {
          setFailed(
            `File is too large. Maximum size is 500MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          );
          return;
        }

        // Check if file is empty
        if (file.size === 0) {
          setFailed('File is empty. Please select a valid MBTiles file.');
          return;
        }

        // Reset any previous errors
        setFailed(null);

        // Debug information about the file
        console.log('Drag and drop file details:', {
          name: file.name,
          path: file.path,
          webkitRelativePath: file.webkitRelativePath,
          size: file.size,
          type: file.type,
        });

        handleUpload(file);
      }
    },
    [handleUpload],
  );

  useEffect(() => {
    const handleResponse = (result: any) => {
      console.log('Upload response received:', result); // Add logging

      // Skip processing if the result is just a test message (like "IPC test: pong")
      if (typeof result === 'string' && result.startsWith('IPC test:')) {
        console.log('Received test message, ignoring:', result);
        return;
      }

      if (result && result.uploaded && !result.downloadUrl) {
        // This is the initial response indicating the file is being processed
        console.log('File upload started, processing...');
        setUploading(false);
        setProcessing(true);
      } else if (result && (result.error || result.canceled)) {
        // Error occurred during processing
        setUploading(false);
        setProcessing(false);
        setFailed(result.error || 'Upload was canceled');
        console.log('File upload was canceled or failed.', result);
      } else if (result && result.downloadUrl) {
        // Processing completed successfully
        console.log('File processing completed successfully');
        setResults(result);
        setUploading(false);
        setProcessing(false);
      }
    };
    console.log('Setting up IPC listeners');
    const removeListener = window.electron.ipcRenderer.on(
      'upload-file-response',
      handleResponse,
    );

    return () => {
      console.log('Removing IPC listeners');
      if (removeListener) {
        removeListener();
      }
    };
  }, []);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    useFsAccessApi: false,
    accept: {
      'application/x-sqlite3': ['.mbtiles'],
    },
  });
  return (
    <div>
      <div className="mt-4 text-center pb-4">
        <h1 className="text-2xl font-bold text-center">
          mbtiles to CoMapeo SMP conversion
        </h1>
        <span className="hidden bg-gray-500 text-white rounded-full px-4 py-2 uppercase">
          <b>Current State:</b>{' '}
          {(() => {
            if (uploading) return 'Uploading';
            if (processing) return 'Processing';
            if (
              results &&
              typeof results === 'object' &&
              'downloadUrl' in results
            )
              return 'Ready to Download';
            if (failed) return 'Failed';
            return 'Idle';
          })()}
        </span>
      </div>
      <div>
        {results && typeof results === 'object' && 'downloadUrl' in results && (
          <div className="mt-4 flex flex-col items-center space-y-8">
            <div className="flex flex-wrap justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = results.downloadUrl as string;
                  link.download = '';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="bg-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download SMP Map
              </button>
              <a
                href="https://smp-viewer.pages.dev/"
                target="_blank"
                rel="noreferrer"
              >
                <button
                  type="button"
                  className="bg-green-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-green-700 transition duration-300 ease-in-out transform hover:scale-105 flex items-center"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  View in SMP Viewer
                </button>
              </a>
            </div>

            <div className="mt-4 py-8 px-4 bg-blue-200 rounded-xl shadow-inner max-w-md">
              <p className="text-gray-700 text-center mb-4">
                Your map has been successfully converted! You can download it
                now or view it in the SMP Viewer.
              </p>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="w-full bg-orange-500 text-white font-bold py-3 px-6 rounded-full shadow-lg hover:bg-red-700 transition duration-300 ease-in-out transform hover:scale-105 flex items-center justify-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Convert Another Map
              </button>
            </div>
          </div>
        )}
        {failed && (
          <div className="my-4 text-center">
            <div className="bg-red-500 text-white rounded-lg px-6 py-4 max-w-lg mx-auto shadow-lg">
              <div className="flex items-center mb-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="font-bold text-lg">Error</span>
              </div>
              <p className="text-left">
                {(() => {
                  if (
                    typeof failed === 'object' &&
                    failed !== null &&
                    'message' in failed
                  ) {
                    return failed.message;
                  }
                  if (typeof failed === 'string') {
                    return failed;
                  }
                  return 'An unknown error occurred. Please try again.';
                })()}
              </p>
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setFailed(null);
                  }}
                  className="bg-white text-red-500 font-bold py-2 px-4 rounded-full shadow-lg hover:bg-gray-100 transition duration-300 ease-in-out"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
        {processing && (
          <div className="mt-4 text-center">
            <span className=" text-white uppercase">
              <div className="flex items-center justify-center">
                <svg
                  className="animate-spin h-5 w-5 mr-3 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <b>Processing...</b>
              </div>
            </span>
          </div>
        )}
      </div>
      {!(results && typeof results === 'object' && 'downloadUrl' in results) &&
        !processing && (
          <div
            {...getRootProps()}
            className="w-full p-3 py-36 border border-gray-500 border-dashed"
          >
            <input {...getInputProps()} />
            <div className="flex flex-col md:flex-row gap-1.5 md:py-4">
              <div className="flex-grow flex items-center justify-center">
                {uploading ? (
                  <div className="mx-auto w-80 text-center animate-bounce">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      className="h-6 w-6 mx-auto"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 10l7-7m0 0l7 7m-7-7v18"
                      />
                    </svg>
                    Uploading
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-3 transition-colors duration-150 cursor-pointer hover:text-gray-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-14 h-14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <strong className="text-sm font-medium">
                      Drag and drop a .mbtiles file here, or click to select
                      file
                    </strong>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      <div className="mt-12 text-center text-white">
        Made with <span className="text-red">❤️</span> by{' '}
        <a
          target="_blank"
          href="https://awana.digital"
          className="text-white hover:underline"
          rel="noreferrer"
        >
          Awana Digital
        </a>
      </div>
    </div>
  );
}

export default SingleFileUploadForm;
