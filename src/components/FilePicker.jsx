import React, { useState, useRef } from 'react';

export default function FilePicker({ onFiles, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);

  const retryCountRef = useRef(0);
  const maxRetries = 15;
  const retryDelay = 500;

  // ---------------------------------------------------------------------
  // LES ALLE FILER MED FULL RETRY-LOGIKK – onFiles() KALLES KUN ÉN GANG
  // ---------------------------------------------------------------------
  async function readAllFilesWithRetry(files) {
    retryCountRef.current = 0;

    const finalOk = await attemptRead(files);

    // KUN HER trigges analyse – ALDRI underveis
    onFiles(finalOk);
  }

  async function attemptRead(files) {
    const okFiles = [];
    const failedFiles = [];

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

    // 🎯 Case 1: Alle filer OK
    if (failedFiles.length === 0) {
      return okFiles; // ferdig
    }

    // 🎯 Case 2: Noen feilet men vi har retry igjen
    if (retryCountRef.current < maxRetries) {
      retryCountRef.current++;

      return new Promise((resolve) => {
        setTimeout(async () => {
          const retryResult = await attemptRead(files);
          resolve(retryResult);
        }, retryDelay);
      });
    }

    // 🎯 Case 3: Max retries – vi returnerer alle OK-filer
    console.warn(
      `Følgende filer kunne ikke leses etter ${maxRetries} forsøk:`,
      failedFiles.map((f) => f.name)
    );

    return okFiles;
  }

  // ---------------------------------------------------------------------
  // INPUT / DROP HANDLERS
  // ---------------------------------------------------------------------

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
