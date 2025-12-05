import React, { useCallback, useState } from 'react';

export default function FilePicker({ onFiles }) {
  const [isDragging, setIsDragging] = useState(false);
  const [failedFiles, setFailedFiles] = useState([]);
  const [error, setError] = useState("");

  function tryReadFiles(fileList) {
    const files = Array.from(fileList);
    const okFiles = [];
    const failed = [];

    let pending = files.length;

    files.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        okFiles.push(file);
        if (--pending === 0) finish();
      };

      reader.onerror = () => {
        failed.push(file);
        if (--pending === 0) finish();
      };

      try {
        reader.readAsText(file);
      } catch (e) {
        failed.push(file);
        if (--pending === 0) finish();
      }
    });

    function finish() {
      if (failed.length > 0) {
        setError(`Noen filer kunne ikke leses (${failed.length}). De kan være åpne i et annet program.`);
        setFailedFiles(failed);
      }
      if (okFiles.length > 0) {
        onFiles(okFiles);
      }
    }
  }

  const handleInputChange = (e) => {
    if (!e.target.files) return;
    setError("");
    setFailedFiles([]);
    tryReadFiles(e.target.files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length > 0) {
      setError("");
      setFailedFiles([]);
      tryReadFiles(e.dataTransfer.files);
    }
  };

  const retry = () => {
    setError("");
    const retryList = [...failedFiles];
    setFailedFiles([]);
    tryReadFiles(retryList);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Error + retry */}
      {error && (
        <div className="p-3 bg-red-200 text-red-900 rounded shadow">
          <div>{error}</div>
          {failedFiles.length > 0 && (
            <button
              onClick={retry}
              className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-800"
            >
              Prøv igjen
            </button>
          )}
        </div>
      )}

      {/* Drop area + file picker */}
      <div className="flex gap-4 items-center">

        <div
          className={`border-2 border-dashed rounded p-6 text-center flex-1 transition-colors
            ${isDragging 
              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md" 
              : "border-gray-400 bg-gray-50 text-gray-600"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging
            ? "Slipp filene her!"
            : "Slipp filer hvor som helst på siden eller her"}
        </div>

        <button
          onClick={() => document.getElementById('fileInput').click()}
          className="px-3 py-2 rounded font-semibold bg-blue-600 text-white hover:bg-blue-900 transition-colors"
        >
          Velg filer
        </button>

        <input
          id="fileInput"
          onChange={handleInputChange}
          multiple
          type="file"
          accept=".txt,.log,.out,text/*"
          className="hidden"
        />
      </div>
    </div>
  );
}
