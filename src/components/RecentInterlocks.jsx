import React, { useState, useMemo } from "react";

function getSeverity(description, type) {
  const lower = (description + " " + type).toLowerCase();
  if (lower.includes("fault") || lower.includes("error") || type === "Fault") return "fault";
  if (lower.includes("warn")) return "warning";
  return "info";
}

const SEV = {
  fault: {
    dot:        "#dc2626",
    rowBg:      "rgba(220,38,38,0.06)",
    border:     "#fca5a5",
    badge:      "bg-red-100 text-red-700 border-red-300",
    time:       "#b91c1c",
    chipBg:     "rgba(220,38,38,0.10)",
    chipBorder: "#fca5a5",
    chipColor:  "#b91c1c",
    // Active filter button style
    activeBg:   "#dc2626",
    activeText: "text-white",
    inactiveBg: "bg-red-100 text-red-700 border-red-300",
  },
  warning: {
    dot:        "#d97706",
    rowBg:      "rgba(217,119,6,0.06)",
    border:     "#fcd34d",
    badge:      "bg-yellow-100 text-yellow-700 border-yellow-300",
    time:       "#92400e",
    chipBg:     "rgba(217,119,6,0.10)",
    chipBorder: "#fcd34d",
    chipColor:  "#92400e",
    activeBg:   "#d97706",
    activeText: "text-white",
    inactiveBg: "bg-yellow-100 text-yellow-700 border-yellow-300",
  },
  info: {
    dot:        "#3b82f6",
    rowBg:      "transparent",
    border:     "#e5e7eb",
    badge:      "bg-blue-100 text-blue-700 border-blue-300",
    time:       "#374151",
    chipBg:     "#f3f4f6",
    chipBorder: "#e5e7eb",
    chipColor:  "#374151",
    activeBg:   "#3b82f6",
    activeText: "text-white",
    inactiveBg: "bg-blue-100 text-blue-700 border-blue-300",
  },
};

// ── Row ───────────────────────────────────────────────────────────────────────

function InterlockRow({ time, entry, allTimes, isRepeat }) {
  const [expanded, setExpanded] = useState(false);
  const sev         = getSeverity(entry.description, entry.type);
  const style       = SEV[sev];
  const multi       = allTimes.length > 1;
  const sortedTimes = [...allTimes].sort((a, b) => b.localeCompare(a));

  return (
    <div className="border-b last:border-b-0" style={{ borderColor: style.border }}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:brightness-95"
        style={{ backgroundColor: style.rowBg, opacity: isRepeat ? 0.72 : 1 }}
        onClick={() => setExpanded(v => !v)}
      >
        <span className="text-sm font-bold font-mono w-16 text-right shrink-0 tabular-nums" style={{ color: style.time }}>
          {time.slice(0, 8)}
        </span>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: style.dot }} />
        <span className="text-xs font-mono font-bold text-gray-600 w-20 shrink-0 truncate">
          #{entry.id}
        </span>
        <span className="text-sm text-gray-800 flex-1 min-w-0 truncate" title={entry.description}>
          {entry.description}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.badge}`}>
            {entry.type}
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-400 w-10 justify-end">
            {multi && <span className="font-semibold text-gray-500">×{allTimes.length}</span>}
            <span>{expanded ? "▲" : "▼"}</span>
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 border-t" style={{ borderColor: style.border, backgroundColor: style.rowBg }}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Description</p>
          <p className="text-sm text-gray-800 mb-3 leading-relaxed">{entry.description}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-2">
            {multi ? `All ${sortedTimes.length} occurrences` : "Time"}
          </p>
          <div className="flex flex-wrap gap-2">
            {sortedTimes.map((t, i) => (
              <span key={i} className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: style.chipBg, border: `1px solid ${style.chipBorder}`, color: style.chipColor }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter chip button ────────────────────────────────────────────────────────

function FilterChip({ sev, count, active, onClick }) {
  const s = SEV[sev];
  const label = sev === "fault" ? "Fault" : sev === "warning" ? "Warning" : "Info";

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${
        active
          ? `${s.activeText} border-transparent`
          : `${s.inactiveBg} hover:opacity-80`
      }`}
      style={active ? { backgroundColor: s.activeBg } : {}}
      title={active ? `Showing only ${label}s — click to show all` : `Filter by ${label}`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : s.dot }}
      />
      {count} {label}{count !== 1 ? "s" : ""}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecentInterlocks({ interlocks }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // "fault"|"warning"|"info"|null
  const [page, setPage]                 = useState(0);
  const PAGE_SIZE = 20;

  const files = useMemo(() => {
    const unique = [...new Set(interlocks.map(i => i.file))];
    return unique.sort((a, b) => b.localeCompare(a));
  }, [interlocks]);

  const activeFile = selectedFile ?? files[0] ?? null;

  const allTimesById = useMemo(() => {
    const map = {};
    for (const entry of interlocks) {
      if (entry.file !== activeFile) continue;
      const key = `${entry.id}||${entry.description}`;
      if (!map[key]) map[key] = [];
      for (const t of (entry.times ?? [])) {
        if (!map[key].includes(t)) map[key].push(t);
      }
    }
    return map;
  }, [interlocks, activeFile]);

  // All rows for this file (unfiltered), newest first
  const allRows = useMemo(() => {
    if (!activeFile) return [];
    const flat = [];
    for (const entry of interlocks) {
      if (entry.file !== activeFile) continue;
      for (const t of (entry.times ?? [])) flat.push({ time: t, entry });
    }
    flat.sort((a, b) => b.time.localeCompare(a.time));
    return flat;
  }, [interlocks, activeFile]);

  // Apply severity filter
  const rows = useMemo(() => {
    if (!activeFilter) return allRows;
    return allRows.filter(r => getSeverity(r.entry.description, r.entry.type) === activeFilter);
  }, [allRows, activeFilter]);

  const faultCount   = allRows.filter(r => getSeverity(r.entry.description, r.entry.type) === "fault").length;
  const warningCount = allRows.filter(r => getSeverity(r.entry.description, r.entry.type) === "warning").length;
  const infoCount    = allRows.filter(r => getSeverity(r.entry.description, r.entry.type) === "info").length;

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleFilter(sev) {
    setActiveFilter(prev => prev === sev ? null : sev);
    setPage(0);
  }

  function switchFile(file) { setSelectedFile(file); setActiveFilter(null); setPage(0); }

  if (!interlocks?.length) {
    return <div className="p-8 text-center text-gray-400 text-sm">No interlocks found.</div>;
  }

  return (
    <div className="flex flex-col" style={{ maxHeight: "80vh" }}>

      {/* Header */}
      <div className="shrink-0 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Recent interlocks</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeFilter
                ? `${rows.length} of ${allRows.length} events shown · ${activeFile}`
                : `${allRows.length} events · ${activeFile}`}
            </p>
          </div>

          {/* Filter chips — right side with padding away from ✕ */}
          <div className="flex gap-2 flex-wrap justify-end" style={{ paddingRight: "3.5rem" }}>
            {faultCount > 0 && (
              <FilterChip sev="fault"   count={faultCount}   active={activeFilter === "fault"}   onClick={() => toggleFilter("fault")} />
            )}
            {warningCount > 0 && (
              <FilterChip sev="warning" count={warningCount} active={activeFilter === "warning"} onClick={() => toggleFilter("warning")} />
            )}
            {infoCount > 0 && (
              <FilterChip sev="info"    count={infoCount}    active={activeFilter === "info"}    onClick={() => toggleFilter("info")} />
            )}
            {/* Clear filter */}
            {activeFilter && (
              <button
                onClick={() => { setActiveFilter(null); setPage(0); }}
                className="px-3 py-1.5 rounded-full border text-xs font-semibold border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Show all
              </button>
            )}
          </div>
        </div>

        {files.length > 1 && (
          <div className="flex gap-2 flex-wrap">
            {files.map((file, idx) => (
              <button key={file} onClick={() => switchFile(file)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  file === activeFile
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {idx === 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${file === activeFile ? "bg-green-400" : "bg-green-500"}`} />
                )}
                {file}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1">
        {pageRows.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">No interlocks match this filter.</div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-[10px] text-gray-400 uppercase tracking-wide w-16 text-right shrink-0">Time</span>
              <span className="w-2 shrink-0" />
              <span className="text-[10px] text-gray-400 uppercase tracking-wide w-20 shrink-0">ID</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide flex-1">Description</span>
              <span className="text-[10px] text-gray-400 uppercase tracking-wide shrink-0 w-24 text-right">Type</span>
            </div>

            {pageRows.map(({ time, entry }, i) => {
              const key      = `${entry.id}||${entry.description}`;
              const allTimes = allTimesById[key] ?? [time];
              const isRepeat = i > 0 &&
                pageRows[i - 1].entry.id          === entry.id &&
                pageRows[i - 1].entry.description === entry.description;

              return (
                <InterlockRow
                  key={`${entry.id}-${time}-${i}`}
                  time={time}
                  entry={entry}
                  allTimes={allTimes}
                  isRepeat={isRepeat}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 shrink-0">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Previous
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 9) }, (_, idx) => (
              <button key={idx} onClick={() => setPage(idx)}
                className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                  idx === page ? "bg-gray-800 text-white" : "text-gray-500 hover:bg-gray-100"
                }`}>
                {idx + 1}
              </button>
            ))}
            {totalPages > 9 && <span className="text-xs text-gray-400 px-1">… {totalPages}</span>}
          </div>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}