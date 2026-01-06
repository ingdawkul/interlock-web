import React, { useState, useMemo } from "react";
import { interlockMap, severityColor } from "../utils/interlockLookup";

export default function InterlockTable({ results, onSelect, query }) {
  const [sortKey, setSortKey] = useState("total");
  const [descending, setDescending] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setDescending(!descending);
    } else {
      setSortKey(key);
      setDescending(true);
    }
  };

  const rows = useMemo(() => {
    return Object.entries(results).map(([id, data]) => {
      const meta = interlockMap[id];
      return {
        id,
        type: data.entries[0]?.Type || "N/A",
        total: data.total,
        severity: meta?.severity
      };
    });
  }, [results]);

  const filteredRows = useMemo(() => {
    const q = (query || "").toLowerCase();

    const filtered = rows.filter((r) => {
      if (!q) return true;

      if (r.id.toLowerCase().includes(q)) return true;

      const entries = results[r.id].entries;
      return entries.some(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          (e.Type || "").toLowerCase().includes(q)
      );
    });

    filtered.sort((a, b) => {
      if (sortKey === "total") {
        return descending ? b.total - a.total : a.total - b.total;
      }

      const va = String(a[sortKey] || "");
      const vb = String(b[sortKey] || "");
      return descending ? vb.localeCompare(va) : va.localeCompare(vb);
    });

    return filtered;
  }, [rows, results, query, sortKey, descending]);


  const headerClass = "cursor-pointer select-none";

  const SortIcon = ({ active, descending }) => {
    if (!active) return <span className="opacity-30">↕</span>;
    return descending ? <span>↓</span> : <span>↑</span>;
  };

  const handleSelect = (id) => {
    const newId = selectedId === id ? null : id;
    setSelectedId(newId);
    onSelect?.(newId);
  };


  return (
    <div className="bg-white border rounded-2xl p-4 shadow-lg">
      <table className="w-full table-auto">
        <thead>
          <tr className="text-left">
            <th className={headerClass} onClick={() => toggleSort("id")}>
              <div className="flex items-center gap-1">
                Interlock ID
                <SortIcon active={sortKey === "id"} descending={descending} />
              </div>
            </th>

            <th
              className={headerClass + " text-center"}
              onClick={() => toggleSort("type")}
            >
              <div className="flex items-center justify-center gap-1">
                Node
                <SortIcon active={sortKey === "type"} descending={descending} />
              </div>
            </th>

            <th
              className={headerClass + " text-center"}
              onClick={() => toggleSort("total")}
            >
              <div className="flex items-center justify-center gap-1">
                Totalt antall
                <SortIcon active={sortKey === "total"} descending={descending} />
              </div>
            </th>
          </tr>
        </thead>

<tbody>
  {filteredRows.map((r) => (
    <tr
      key={r.id}
      onClick={() => handleSelect(r.id)}
      className={`
        cursor-pointer
        hover:bg-gray-50
        transition-colors duration-150
        ${selectedId === r.id ? "bg-blue-100 font-medium" : ""}
      `}
    >
      {/* Interlock ID med badge */}
      <td className="py-2 px-4 flex items-center gap-2">
        <div
          className={`
            flex items-center gap-2
            rounded-lg
            px-2 py-1
            ${selectedId === r.id ? "bg-blue-100 font-medium" : ""}
            ${r.severity ? severityColor[r.severity] + " bg-opacity-60" : ""}
            transition-colors duration-200
          `}
        >
        {r.id}
        </div>
      </td>

      {/* Node */}
      <td className="py-2 px-4 text-center">{r.type}</td>

      {/* Totalt antall */}
      <td className="py-2 px-4 text-center">{r.total}</td>
    </tr>
  ))}

  {rows.length === 0 && (
    <tr>
      <td colSpan={3} className="py-6 text-center text-gray-400">
        Ingen resultater
      </td>
    </tr>
  )}
</tbody>


      </table>
    </div>
  );
}
