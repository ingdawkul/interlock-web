import React, { useState, useRef } from "react";

export default function FilePicker({ onFiles, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);

  // For feilmelding/UI
  const [error, setError] = useState("");
  const [failed, setFailed] = useState([]);

  // Stabil referanse som ALLTID husker alle filer valgt av brukeren
  const filesRef = useRef([]);

  // ------------------------------------------------------
  //  FULL OG ROBUST LESING AV FILER MED AUTOMATISK RETRY
  // ------------------------------------------------------
  async function tryReadFiles(files, attempt = 1) {
    const okFiles = [];
    const failedFiles = [];

    // Les ALLE filer parallelt (trygt)
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
            } catch (e) {
              failedFiles.push(file);
              resolve();
            }
          })
      )
    );

    // Hvis noen filer feiler og vi har forsøk igjen → prøv igjen
    if (failedFiles.length > 0 && attempt < 15) {
      await new Promise((res) => setTimeout(res, 500));
      return tryReadFiles(filesRef.current, attempt + 1);
    }

    // Hvis det MASSE feiler etter alle forsøk
    if (failedFiles.length > 0) {
      setError(
        `Noen filer kunne ikke leses (${failedFiles.length}). De kan være åpne i et annet program.`
      );
      setFailed(failedFiles);
    }

    // Send KUN når vi har et endelig resultat (delvise er ikke lov)
    if (okFiles.length > 0) {
      onFiles(okFiles);
    }
  }

  // ------------------------------------------------------
  //  HÅNDTERING AV INPUT / DRAG & DROP
  // ------------------------------------------------------
  const handleInputChange = (e) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);

    // lagre FØR lesing
    filesRef.current = files;
    setError("");
    setFailed([]);

    tryReadFiles(files);
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

      filesRef.current = files;
      setError("");
      setFailed([]);

      tryReadFiles(files);
    }
  };

  // ------------------------------------------------------
  //  MANUELL RETRY (bruker ALLTID hele file-settet)
  // ------------------------------------------------------
  const retry = () => {
    setError("");
    setFailed([]);
    tryReadFiles(filesRef.current);
  };

  // ------------------------------------------------------
  //  RENDER
  // ------------------------------------------------------
  return (
    <div className="flex flex-col gap-3">
      
      {/* Feilmelding + retry */}
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

      {/* Drop area */}
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
