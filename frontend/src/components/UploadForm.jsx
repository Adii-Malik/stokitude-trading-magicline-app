import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, CheckCircle, AlertCircle, X } from 'lucide-react';
import { uploadFile } from '../services/api';

export default function UploadForm({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setProgress(0);
    setError(null);
    setResult(null);

    try {
      const data = await uploadFile(file, setProgress);
      setResult(data);

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif']
    },
    maxFiles: 1,
    disabled: uploading
  });

  return (
    <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-md">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
        <Upload className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
        Upload Strategic Level Data
      </h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-4">
            <FileText className="w-12 h-12 text-cyan-500 dark:text-cyan-500" />
            <Image className="w-12 h-12 text-green-500 dark:text-green-500" />
          </div>

          {uploading ? (
            <>
              <p className="text-lg font-medium text-gray-900 dark:text-white">Uploading...</p>
              <div className="w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-cyan-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{progress}%</p>
            </>
          ) : isDragActive ? (
            <p className="text-lg font-medium text-cyan-600 dark:text-cyan-400">Drop your file here...</p>
          ) : (
            <>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Drag & drop your CSV or Image here
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                or click to select a file
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                Supported formats: CSV, JPG, PNG, GIF (max 10MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {result && result.success && (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-400">{result.message}</p>
            <p className="text-sm text-green-300 mt-1">
              {result.data.symbolsCount} symbols loaded successfully
            </p>
            {result.data.errors && result.data.errors.length > 0 && (
              <div className="mt-2 text-xs text-yellow-400">
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc list-inside">
                  {result.data.errors.slice(0, 3).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {result.data.errors.length > 3 && (
                    <li>... and {result.data.errors.length - 3} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            className="text-green-400 hover:text-green-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-400">Upload Failed</p>
            <p className="text-sm text-red-300 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 rounded-lg">
        <h3 className="font-semibold text-cyan-700 dark:text-cyan-400 mb-2">Expected Format:</h3>
        <div className="text-sm text-cyan-800 dark:text-cyan-300 space-y-1">
          <p><strong>CSV:</strong> Columns: "Scrip" (or "Symbol") and "Strategic Level" (or "Magic Line" for backwards compatibility)</p>
          <p><strong>Image:</strong> Table with two columns showing Symbol and Strategic Level values</p>
          <p className="text-xs text-cyan-600 dark:text-cyan-500 mt-2">
            Example: ABL | 205, Dyno | 341, LCI | 336
          </p>
        </div>
      </div>
    </div>
  );
}

