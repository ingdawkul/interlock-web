import React, { useMemo, useState } from "react";

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
    const arr = Object.entries(results).map(([id, data]) => ({
      id,
      type: data.entries[0]?.Type || "N/A",
      total: data.total,
    }));

    const q = (query || "").toLowerCase();
    const filtered = arr.filter((r) => {
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
  }, [results, query, sortKey, descending]);

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
          {rows.map((r) => (
            <tr
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className={`
                cursor-pointer
                hover:bg-gray-100
                ${selectedId === r.id ? "bg-blue-100 font-medium" : ""}
              `}
            >
              <td className="py-2">{r.id}</td>
              <td className="py-2 text-center">{r.type}</td>
              <td className="py-2 text-center">{r.total}</td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-gray-500">
                Ingen resultater
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
