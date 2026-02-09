import React, { useState, useRef } from "react";

export default function FilePicker({ onFiles, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const retryCountRef = useRef(0);
  const maxRetries = 30;
  const retryDelay = 2000;

  // LESER FILER SEKVENTIELLT FOR MAKS STABILITET
  function readFilesSequentially(files, callback) {
    let index = 0;
    const ok = [];
    const failed = [];

    function readNext() {
      if (index >= files.length) {
        callback(ok, failed);
        return;
      }

      const file = files[index];
      const reader = new FileReader(); // Sterk referanse i denne scope
      index++;

      reader.onload = () => {
        ok.push(file);
        readNext();
      };

      reader.onerror = () => {
        failed.push(file);
        readNext();
      };

      try {
        reader.readAsText(file);
      } catch {
        failed.push(file);
        readNext();
      }
    }

    readNext();
  }

  // FULL RETRY-LOGIKK
  function readAllWithRetry(files) {
    retryCountRef.current = 0;

    const loop = () => {
      readFilesSequentially(files, (okFiles, failedFiles) => {
        if (failedFiles.length === 0) {
          // FULL SUKSESS
          onFiles(okFiles);
          return;
        }

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          setTimeout(loop, retryDelay);
        } else {
          // RETRY FAIL — returner alt som ble OK
          console.warn(
            "Failed to read any files after all retry attempts:",
            failedFiles.map((f) => f.name)
          );
          onFiles(okFiles);
        }
      });
    };

    loop();
  }

  // UI HANDLERS
  const handleInputChange = (e) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    readAllWithRetry(files);
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
    if (e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
      readAllWithRetry(files);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 items-center">
        <div
          className={`border-4 border-dashed w-full rounded-2xl p-4 text-center flex-1 transition-colors cursor-pointer
            ${
              isDragging
                ? "border-orange-500 bg-blue-50 text-blue-800 shadow-md"
                : "border-blue-500 bg-gray-50 text-gray-600 hover:border-orange-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ minHeight: height }}
          onClick={() => document.getElementById("fileInput").click()}
        >
          {isDragging 
          ? "Drop files here!" : "Click here to select files or drop them here"}
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
