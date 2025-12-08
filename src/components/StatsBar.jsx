import React from 'react';

export default function StatsBar({ totalLines, matches, uniqueCount }) {
  return (
    <div className="flex flex-wrap gap-4 items-center text-sm">

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{
          color: 'var(--btn-secondary-hover)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Linjer: <strong>{totalLines}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{
          color: 'var(--btn-secondary-hover)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Varsler: <strong>{matches}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{
          color: 'var(--btn-secondary-hover)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Unike Interlocks: <strong>{uniqueCount}</strong>
      </div>

    </div>
  );
}
