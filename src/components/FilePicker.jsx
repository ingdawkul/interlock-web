import React, { useState, useRef } from "react";

export default function FilePicker({ onFiles, onProgress, progress, height = "6vh" }) {
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
        // Final tick so the bar visibly reaches 100% before handing off to parsing
        onProgress?.({
          active: true,
          phase: "reading",
          current: files.length,
          total: files.length,
          fileName: "",
        });
        callback(ok, failed);
        return;
      }

      const file = files[index];
      const reader = new FileReader(); // Sterk referanse i denne scope
      const fileIndex = index;
      index++;

      onProgress?.({
        active: true,
        phase: "reading",
        current: fileIndex,
        total: files.length,
        fileName: file.name,
      });

      reader.onload = () => {
        // Pass the text along so App doesn't have to re-read the same file
        ok.push({ name: file.name, text: reader.result });
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

  const isLoading = !!progress?.active;
  const percent =
    isLoading && progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;
  const phaseLabel = progress?.phase === "parsing" ? "Processing" : "Reading";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4 items-center">
        <div
          className={`border-4 border-dashed w-full rounded-2xl p-4 text-center flex-1 transition-colors
            ${
              isLoading
                ? "border-blue-500 bg-blue-50 cursor-default"
                : isDragging
                ? "border-orange-500 bg-blue-50 text-blue-800 shadow-md cursor-pointer"
                : "border-blue-500 bg-gray-50 text-gray-600 hover:border-orange-600 hover:bg-blue-50 hover:text-blue-700 cursor-pointer"
            }`}
          onDragOver={!isLoading ? handleDragOver : undefined}
          onDragLeave={!isLoading ? handleDragLeave : undefined}
          onDrop={!isLoading ? handleDrop : undefined}
          style={{ minHeight: height }}
          onClick={
            !isLoading
              ? () => document.getElementById("fileInput").click()
              : undefined
          }
        >
          {isLoading ? (
            <div className="flex flex-col items-center justify-center w-full gap-1.5 px-4 py-1">
              <div className="text-sm font-semibold text-blue-800">
                {phaseLabel} files ({progress.current} / {progress.total}) — {percent}%
              </div>
              {progress.fileName && (
                <div
                  className="text-xs text-gray-600 truncate max-w-full"
                  title={progress.fileName}
                >
                  {progress.fileName}
                </div>
              )}
              <div className="w-full max-w-md h-2 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-150 ease-out"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ) : isDragging ? (
            "Drop files here!"
          ) : (
            "Click here to select files or drop them here"
          )}
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
