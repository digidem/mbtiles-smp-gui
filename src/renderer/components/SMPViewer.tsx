import { useEffect, useState } from 'react';

interface SMPViewerProps {
  smpFilePath: string;
}

function SMPViewer({ smpFilePath }: SMPViewerProps) {
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const startServer = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('Starting SMP server for:', smpFilePath);

        // Start the SMP server
        const result = await window.electron.smpViewer.startServer(smpFilePath);

        if (result.success) {
          console.log('SMP server started at:', result.serverUrl);
          setServerUrl(result.serverUrl);
        } else {
          console.error('Failed to start SMP server:', result.error);
          setError(result.error || 'Failed to start SMP server');
        }
      } catch (err) {
        console.error('Error starting SMP server:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    startServer();

    // Clean up when the component unmounts
    return () => {
      console.log('Stopping SMP server for:', smpFilePath);
      window.electron.smpViewer.stopServer(smpFilePath).catch(console.error);
    };
  }, [smpFilePath]);

  if (loading) {
    return (
      <div className="mt-4 mb-8 mx-auto w-full max-w-md">
        <div className="bg-white p-4 rounded-lg shadow-xl w-full h-64 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold">Map Preview</h2>
          </div>
          <div className="flex-grow flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
            <span className="ml-3 text-sm text-gray-700">Loading map...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 mb-8 mx-auto w-full max-w-md">
        <div className="bg-white p-4 rounded-lg shadow-xl w-full h-64 flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold">Map Preview</h2>
          </div>
          <div className="flex-grow flex items-center justify-center">
            <div className="text-red-500 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-8 w-8 mx-auto mb-2"
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
              <p className="text-sm font-semibold">Error loading map</p>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 mx-auto w-full max-w-md">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full h-64 flex flex-col">
        <div className="flex-grow relative">
          {serverUrl && (
            <iframe
              src={serverUrl}
              className="absolute inset-0 w-full h-full border-0 rounded"
              title="SMP Map Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default SMPViewer;
