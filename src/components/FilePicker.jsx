import React, { useCallback } from 'react';

export default function FilePicker({ onFiles }) {

  const handleInputChange = async (e) => {
    onFiles(e.target.files)
  }

  return (
    <div className="flex gap-4 items-center">
      <div className="border-2 border-dashed border-gray-400 rounded p-6 text-center text-gray-600 bg-gray-50 flex-1">
        Du kan nå slippe filer hvor som helst på siden
      </div>

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
  );
}
