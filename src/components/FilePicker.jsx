import React, { useCallback, useState } from 'react';

export default function FilePicker({ onFiles }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleInputChange = (e) => {
    if (!e.target.files) return;
    onFiles(e.target.files);
  };

  // Lokal drag/drop – fungerer i tillegg til global drop i App.jsx
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
      onFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="flex gap-4 items-center">
      {/* Drop area */}

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


      {/* File picker button */}
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
  );
}
