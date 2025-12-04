import React from 'react';

export default function StatsBar({ totalLines, matches, uniqueCount }) {
  return (
    <div className="flex flex-wrap gap-4 items-center text-sm">

      <div
        className="p-3 rounded shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-lines)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Linjer: <strong>{totalLines}</strong>
      </div>

      <div
        className="p-3 rounded shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-lines)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Varsler: <strong>{matches}</strong>
      </div>

      <div
        className="p-3 rounded shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-lines)',
          color: 'var(--text-primary)',
          borderColor: 'var(--border-soft)'
        }}
      >
        Unike Interlocks: <strong>{uniqueCount}</strong>
      </div>

    </div>
  );
}
