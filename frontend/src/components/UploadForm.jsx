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
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        Upload Magic Line Data
      </h2>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-4">
            <FileText className="w-12 h-12 text-blue-500" />
            <Image className="w-12 h-12 text-green-500" />
          </div>
          
          {uploading ? (
            <>
              <p className="text-lg font-medium">Uploading...</p>
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600">{progress}%</p>
            </>
          ) : isDragActive ? (
            <p className="text-lg font-medium text-blue-600">Drop your file here...</p>
          ) : (
            <>
              <p className="text-lg font-medium">
                Drag & drop your CSV or Image here
              </p>
              <p className="text-sm text-gray-500">
                or click to select a file
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supported formats: CSV, JPG, PNG, GIF (max 10MB)
              </p>
            </>
          )}
        </div>
      </div>

      {/* Success Message */}
      {result && result.success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-green-900">{result.message}</p>
            <p className="text-sm text-green-700 mt-1">
              {result.data.symbolsCount} symbols loaded successfully
            </p>
            {result.data.errors && result.data.errors.length > 0 && (
              <div className="mt-2 text-xs text-orange-700">
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
            className="text-green-600 hover:text-green-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-red-900">Upload Failed</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Expected Format:</h3>
        <div className="text-sm text-blue-800 space-y-1">
          <p><strong>CSV:</strong> Columns: "Scrip" (or "Symbol") and "Magic Line" (or "Magic Lin")</p>
          <p><strong>Image:</strong> Table with two columns showing Symbol and Magic Line values</p>
          <p className="text-xs text-blue-600 mt-2">
            Example: ABL | 205, Dyno | 341, LCI | 336
          </p>
        </div>
      </div>
    </div>
  );
}

