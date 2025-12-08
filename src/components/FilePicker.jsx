import React, { useState, useRef } from 'react';

export default function FilePicker({ onFiles, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const retryCountRef = useRef(0);
  const maxRetries = 15;
  const retryDelay = 500; // ms

  // ---------------------------------------------------------
  // Leser ALLE filer, og hvis én feiler → trigges automatisk retry
  // ---------------------------------------------------------
  async function readAllFilesWithRetry(files) {
    retryCountRef.current = 0;
    await attemptRead(files);
  }

  async function attemptRead(files) {
    const okFiles = [];
    const failedFiles = [];

    // Les alle filer parallelt
    await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();

            reader.onload = () => {
              okFiles.push(file);
              resolve();
            };

            reader.onerror = () => {
              failedFiles.push(file);
              resolve();
            };

            try {
              reader.readAsText(file);
            } catch {
              failedFiles.push(file);
              resolve();
            }
          })
      )
    );

    // Hvis ingenting feilet → ferdig
    if (failedFiles.length === 0) {
      onFiles(okFiles);
      return;
    }

    // Hvis FAIL og vi har flere forsøk → vent og prøv igjen
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++;

      setTimeout(() => {
        attemptRead(files);
      }, retryDelay);

      return;
    }

    // Hvis vi kommer hit betyr det at selv etter 15 forsøk var noe fortsatt locked
    // Men: Vi sender fortsatt med alt som var OK
    if (okFiles.length > 0) {
      onFiles(okFiles);
    }

    // Feilmelding skal ikke vises grafisk – kun logges
    console.warn(
      `Noen filer kunne ikke leses etter ${maxRetries} forsøk:`,
      failedFiles.map((f) => f.name)
    );
  }

  // ---------------------------------------------------------
  // Input / drop handlers
  // ---------------------------------------------------------

  const handleInputChange = (e) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    readAllFilesWithRetry(files);
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
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);

      readAllFilesWithRetry(files);
    }
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Drop + velg-knapp */}
      <div className="flex gap-4 items-center">
        <div
          className={`border-4 border-dashed w-full rounded-2xl p-4 text-center flex-1 transition-colors cursor-pointer
            ${
              isDragging
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-md"
                : "border-gray-400 bg-gray-50 text-gray-600 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-700"
            }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{ minHeight: height }}
          onClick={() => document.getElementById("fileInput").click()}
        >
          {isDragging
            ? "Slipp filene her!"
            : "Trykk her for å velge filer eller slipp dem her"}
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
