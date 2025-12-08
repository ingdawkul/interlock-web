import React, { useState } from 'react';

export default function FilePicker({ onFiles, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);

  // Hele filsettet brukeren valgte
  const [selectedFiles, setSelectedFiles] = useState([]);

  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);   // kun for feilmelding

  function tryReadFiles(fileList) {
    const files = Array.from(fileList);
    setSelectedFiles(files); // <-- viktig! behold hele settet for retry

    const okFiles = [];
    const failedFiles = [];

    let pending = files.length;

    files.forEach((file) => {
      const reader = new FileReader();

      reader.onload = () => {
        okFiles.push(file);
        if (--pending === 0) finish();
      };

      reader.onerror = () => {
        failedFiles.push(file);
        if (--pending === 0) finish();
      };

      try {
        reader.readAsText(file);
      } catch (e) {
        failedFiles.push(file);
        if (--pending === 0) finish();
      }
    });

    function finish() {
      if (failedFiles.length > 0) {
        setError(
          `Noen filer kunne ikke leses (${failedFiles.length}). De kan være åpne i et annet program.`
        );
        setFailed(failedFiles);
      }

      if (okFiles.length > 0) {
        onFiles(okFiles);
      }
    }
  }

  const handleInputChange = (e) => {
    if (!e.target.files) return;

    setError("");
    setFailed([]);

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
      setFailed([]);
      tryReadFiles(e.dataTransfer.files);
    }
  };

  // ⟶ Viktig: retry skal bruke selectedFiles (hele settet)
  const retry = () => {
    setError("");
    setFailed([]);
    tryReadFiles(selectedFiles);
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Feil + retry */}
      {error && (
        <div className="p-3 bg-red-200 text-red-900 rounded shadow">
          <div>{error}</div>
          <button
            onClick={retry}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-800"
          >
            Prøv igjen
          </button>
        </div>
      )}

      {/* Drop area + knapper */}
      <div className="flex gap-4 items-center">
        <div
          className={`border-4 border-dashed w-full rounded-2xl p-4 text-center flex-1 transition-colors cursor-pointer
            ${isDragging
              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md"
              : "border-gray-400 bg-gray-50 text-gray-600 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ minHeight: height }}
          onClick={() => document.getElementById("fileInput").click()}
        >
          {isDragging ? "Slipp filene her!" : "Trykk her for å velge filer eller slipp dem her"}
        </div>

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