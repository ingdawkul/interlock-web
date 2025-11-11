import React from 'react'

export default function StatsBar({ totalLines, matches, uniqueCount }) {
  return (
    <div className="flex flex-wrap gap-4 items-center text-sm">
      <div className="bg-white p-3 rounded shadow-sm">Linjer: <strong>{totalLines}</strong></div>
      <div className="bg-white p-3 rounded shadow-sm">Varsler: <strong>{matches}</strong></div>
      <div className="bg-white p-3 rounded shadow-sm">Unike Interlocks: <strong>{uniqueCount}</strong></div>
    </div>
  )
}