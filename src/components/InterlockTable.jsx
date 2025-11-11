import React, { useMemo, useState } from 'react'

export default function InterlockTable({ results, onSelect, query }) {
  const [sortKey, setSortKey] = useState('total');
  const [descending, setDescending] = useState(true);

  const rows = useMemo(() => {
    const arr = Object.entries(results).map(([id, data]) => ({ id, type: data.entries[0]?.Type || 'N/A', total: data.total }));
    let filtered = arr.filter((r) => {
      const q = (query || '').toLowerCase();
      if (!q) return true;
      if (r.id.toLowerCase().includes(q)) return true;
      const entries = results[r.id].entries;
      return entries.some((e) => e.description.toLowerCase().includes(q) || (e.Type || '').toLowerCase().includes(q));
    });
    filtered.sort((a, b) => {
      if (sortKey === 'total') return descending ? b.total - a.total : a.total - b.total;
      const va = a[sortKey] || '';
      const vb = b[sortKey] || '';
      return descending ? String(vb).localeCompare(String(va)) : String(va).localeCompare(String(vb));
    });
    return filtered;
  }, [results, sortKey, descending, query]);

  const headerClass = 'cursor-pointer select-none';

  return (
    //<div className="bg-white rounded shadow p-3 overflow-auto">
    <div className="bg-white border rounded-2xl p-4 shadow-lg">
      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className={headerClass} onClick={() => { setSortKey('id'); setDescending(sortKey==='id' ? !descending : false) }}>Interlock ID</th>
            <th className={headerClass} onClick={() => { setSortKey('type'); setDescending(sortKey==='type' ? !descending : false) }}>Node</th>
            <th className={headerClass} onClick={() => { setSortKey('total'); setDescending(sortKey==='total' ? !descending : !descending) }}>Totalt antall</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => onSelect(r.id)}>
              <td className="py-2">{r.id}</td>
              <td className="py-2 text-center">{r.type}</td>
              <td className="py-2 text-center">{r.total}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-gray-500">Ingen resultater</td></tr>}
        </tbody>
      </table>
    </div>
  )
}