import React, { useState } from "react";

export default function FilePicker({ onFiles, progress, height = "6vh" }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (e) => {
    if (!e.target.files) return;
    onFiles(Array.from(e.target.files));
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
      onFiles(Array.from(e.dataTransfer.files));
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
