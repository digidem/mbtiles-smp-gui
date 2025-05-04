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
    const filePath = file.path || file.webkitRelativePath || file.name; // Ensure compatibility
    window.electron.ipcRenderer.sendMessage(
      'ipc-example',
      'upload-file',
      filePath,
    );
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length) {
        const file = acceptedFiles[0];
        /** File validation */
        if (window.innerWidth > 768) {
          if (!file.name.endsWith('.mbtiles')) {
            alert('Please select a valid .mbtiles file');
            return;
          }
        }
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  useEffect(() => {
    const handleResponse = (result: any) => {
      console.log('Upload response received:', result); // Add logging
      if (result.uploaded) {
        setUploading(false);
        setProcessing(true);
      } else if (result.error || result.canceled) {
        setUploading(false);
        setProcessing(false);
        setFailed(result.error);
        console.log('File upload was canceled or failed.', result);
      } else {
        setResults(result);
        setUploading(false);
        setProcessing(false);
      }
    };
    console.log('Setting up IPC listeners');
    const removeListener = window.electron.ipcRenderer.on(
      'ipc-example',
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
            if (results && 'downloadUrl' in results) return 'Ready to Download';
            if (failed) return 'Failed';
            return 'Idle';
          })()}
        </span>
      </div>
      <div>
        {results && 'downloadUrl' in results && (
          <div className="mt-4 flex flex-col items-center space-y-8">
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
              className="bg-blue-500 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-blue-700 transition duration-300 ease-in-out transform hover:scale-105"
            >
              Download SMP Map
            </button>
            {/*
            <div className="mt-4 flex flex-col items-center max-w-[500px]">
              <h2 className="text-lg font-bold text-center py-2">
                Instructions
              </h2>
              <div className="tabs flex justify-center space-x-4 mt-4">
                <button
                  type="button"
                  className={`tab-button px-4 py-2 rounded-full font-semibold transition duration-300 ease-in-out ${
                    tab === 'desktop'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setTab('desktop')}
                >
                  Desktop
                </button>
                <button
                  type="button"
                  className={`tab-button px-4 py-2 rounded-full font-semibold transition duration-300 ease-in-out ${
                    tab === 'mobile'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}
                  onClick={() => setTab('mobile')}
                >
                  Mobile
                </button>
              </div>
              {tab === 'desktop' && <div className="tab-content" />}
              {tab === 'mobile' && <div className="tab-content" />}
            </div>
             */}
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="bg-orange-500 text-white font-bold py-2 px-4 rounded-full shadow-lg hover:bg-red-700 transition duration-300 ease-in-out transform hover:scale-105"
            >
              Restart
            </button>
          </div>
        )}
        {failed && (
          <div className="my-4 text-center">
            <span className="bg-red-500 text-white rounded-full px-4 py-2 uppercase">
              <b>Error:</b>{' '}
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
                return 'Error';
              })()}
            </span>
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
      {!(results && 'downloadUrl' in results) && !processing && (
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
                    Drag and drop a .mbtiles file here, or click to select file
                  </strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="mt-12 text-center text-white">
        Made with <span className="text-red">❤️</span> by{' '}
        <a href="https://awana.digital" className="text-white hover:underline">
          Awana Digital
        </a>
      </div>
    </div>
  );
}

export default SingleFileUploadForm;
