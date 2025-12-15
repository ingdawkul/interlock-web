import React, { useState } from 'react';
import RecentInterlocks from './RecentInterlocks';

export default function StatsBar({ totalLines, matches, uniqueCount, recentInterlocks }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-4 items-center text-sm">
      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Linjer: <strong>{totalLines}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Antall interlocks: <strong>{matches}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Unike interlocks: <strong>{uniqueCount}</strong>
      </div>

      {/* Knapp for å åpne modal */}
      <button
        className="px-4 py-3 rounded-2xl border border-orange-500 bg-gray-100 hover:bg-gray-200"
        onClick={() => setIsOpen(true)}
      >
        Vis siste interlocks
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            className="bg-white rounded-lg shadow-lg  max-w-8xl w-full p-6 relative overflow-hidden"
            style={{ maxHeight: "100vh" }}
          >
            {/* Lukk-knapp */}
            <button
              className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={() => setIsOpen(false)}
            >
              ✕
            </button>

            <div className="overflow-y-auto panel">
              <RecentInterlocks interlocks={recentInterlocks} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}