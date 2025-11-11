import React, { useCallback } from 'react';

export default function FilePicker({ onFiles }) {
  const handleFiles = useCallback(async (files) => {
    const arr = await Promise.all(
      Array.from(files).map(f => f.text().then(txt => ({ name: f.name, text: txt })))
    );
    onFiles(arr);
  }, [onFiles]);

  const handleInputChange = (e) => {
    handleFiles(e.target.files);
  }

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleFiles(e.dataTransfer.files);
  }

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  }

  return (
    <div className="flex gap-4 items-center">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-400 rounded p-6 text-center cursor-pointer hover:bg-gray-100 flex-1"
      >
        Dra og slipp filer her
      </div>

      {/* File select button */}
      <label className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:opacity-95">
        Velg filer
        <input
          onChange={handleInputChange}
          multiple
          type="file"
          accept=".txt,.log,.out,text/*"
          className="hidden"
        />
      </label>
    </div>
  )
}
