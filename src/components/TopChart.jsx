import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function TopChart({ results }) {
  const data = Object.entries(results)
    .map(([id, d]) => ({ id, total: d.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  if (data.length === 0) return <div className="text-gray-500">Ingen data å vise</div>

  return (
    <div className="bg-white rounded shadow p-3 h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <XAxis type="number" />
          <YAxis dataKey="id" type="category" width={120} />
          <Tooltip />
          <Bar dataKey="total" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}