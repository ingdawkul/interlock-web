import React from 'react'

export default function DetailTable({ data }) {
  if (!data) return <div className="text-sm text-gray-500">Velg en Interlock ID for detaljer</div>
  return (
    <div className="bg-white border rounded-2xl p-4 shadow-lg">
      <div className="text-sm text-gray-600 mb-2">Detaljer for <strong>{data.id}</strong></div>
      <table className="w-full table-auto">
        <thead>
          <tr><th>Klokkelsett</th><th>Beskrivelse</th></tr>
        </thead>
        <tbody>
          {data.entries.map((e, i) => (
            <tr key={i} className="align-top">
              <td className="py-2">{e.Times.join(', ')}</td>
              <td className="py-2">{e.description} <div className="text-xs text-gray-400 mt-1">{e.Type}</div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}