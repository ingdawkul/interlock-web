import React from 'react'

export default function FilePicker({ onFiles }) {
  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    // Read files as text
    const arr = await Promise.all(
      files.map((f) => f.text().then((txt) => ({ name: f.name, text: txt })))
    );
    onFiles(arr);
  }

  return (
    <div className="flex gap-2 items-center">
      <label className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer hover:opacity-95">
        Velg filer
        <input onChange={handleFiles} multiple type="file" accept=".txt,.log,.out,text/*" className="hidden" />
      </label>
    </div>
  )
}