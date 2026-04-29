import React, { useState, useMemo, useEffect } from "react";
import { parseLogForViewer, discoverFacets, EVENT_KINDS } from "../utils/logViewerParser";

// ─────────────────────────────────────────────────────────────────────────────

function timeToSec(t) {
  if (!t) return 0;
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

function secToTime(sec) {
  const s = Math.max(0, Math.min(86399, Math.round(sec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

function formatDuration(secs) {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs/60)}m ${secs%60}s`;
  return `${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m`;
}

const WINDOW_PRESETS = [
  { label: "5 min",  sec: 300 },
  { label: "15 min", sec: 900 },
  { label: "1 h",    sec: 3600 },
  { label: "4 h",    sec: 14400 },
  { label: "All",    sec: 86400 },
];

// Common operating hours quick-jumps
const TIME_SHORTCUTS = [
  { label: "07:00", time: "07:00:00" },
  { label: "09:00", time: "09:00:00" },
  { label: "12:00", time: "12:00:00" },
  { label: "15:00", time: "15:00:00" },
  { label: "18:00", time: "18:00:00" },
];

// ─────────────────────────────────────────────────────────────────────────────

export default function LogViewer({ rawLogTexts }) {
  const fileNames = useMemo(() =>
    Object.keys(rawLogTexts).sort((a, b) => b.localeCompare(a))
  , [rawLogTexts]);

  const [activeFile,   setActiveFile]   = useState(fileNames[0] ?? null);
  const [centerSec,    setCenterSec]    = useState(timeToSec("12:00:00"));
  const [windowSec,    setWindowSec]    = useState(900);
  const [enabledKinds, setEnabledKinds] = useState(new Set(Object.keys(EVENT_KINDS)));
  const [enabledCats,  setEnabledCats]  = useState(null);   // null = all
  const [search,       setSearch]       = useState("");
  const [expanded,     setExpanded]     = useState({});
  const [showCatPicker,setShowCatPicker]= useState(false);

  // Anchors for jump-to chips
  // Categories and sources discovered in active file
  const facets = useMemo(() => {
    if (!activeFile || !rawLogTexts[activeFile]) return { sources: [], categories: [] };
    return discoverFacets(rawLogTexts[activeFile]);
  }, [activeFile, rawLogTexts]);

  // Reset state when file changes
  useEffect(() => {
    setCenterSec(timeToSec("12:00:00"));
    setExpanded({});
    setEnabledCats(null);
  }, [activeFile]);

  // Time window
  const halfWindow = Math.floor(windowSec / 2);
  const startSec   = Math.max(0,    centerSec - halfWindow);
  const endSec     = Math.min(86399, centerSec + halfWindow);
  const startTime  = secToTime(startSec);
  const endTime    = secToTime(endSec);

  // Parse window
  const parsed = useMemo(() => {
    if (!activeFile || !rawLogTexts[activeFile]) {
      return { events: [], totalScanned: 0, truncated: false, allTimes: {} };
    }
    return parseLogForViewer(rawLogTexts[activeFile], {
      startTime, endTime,
      kinds: enabledKinds,
      categories: enabledCats,
      maxEvents: 5000,
    });
  }, [activeFile, rawLogTexts, startTime, endTime, enabledKinds, enabledCats]);

  // Search filter
  const filteredEvents = useMemo(() => {
    if (!search.trim()) return parsed.events;
    const q = search.toLowerCase();
    return parsed.events.filter(e =>
      e.summary.toLowerCase().includes(q)  ||
      e.raw.toLowerCase().includes(q)      ||
      e.source.toLowerCase().includes(q)   ||
      e.category.toLowerCase().includes(q)
    );
  }, [parsed.events, search]);

  // Counts per kind (for chip toggles)
  const kindCounts = useMemo(() => {
    const counts = {};
    for (const k of Object.keys(EVENT_KINDS)) counts[k] = 0;
    for (const e of parsed.events) counts[e.kind]++;
    return counts;
  }, [parsed.events]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function toggleKind(k) {
    setEnabledKinds(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function toggleCategory(cat) {
    setEnabledCats(prev => {
      // If currently null (all), start with all categories enabled then remove this one
      const all = facets.categories.map(c => c.name);
      const current = prev ?? new Set(all);
      const next = new Set(current);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      // If next contains all, treat as "all" (null)
      if (next.size === all.length) return null;
      return next;
    });
  }

  function jumpTo(sec) {
    setCenterSec(sec);
    setExpanded({});
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (!activeFile) {
    return <div className="p-8 text-center text-gray-400 text-sm">No log files loaded.</div>;
  }

  const activeCatsCount = enabledCats === null ? facets.categories.length : enabledCats.size;
  const allCatsEnabled  = enabledCats === null;

  return (
    <div className="flex flex-col h-full">

      {/* ── Header (does not grow) ──────────────────────────────────────── */}
      <div className="shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Log activity</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {parsed.events.length} events
              {parsed.truncated && <span className="text-orange-500"> (truncated at 5000)</span>} ·
              {" "}window {startTime} – {endTime} ({formatDuration(windowSec)})
            </p>
          </div>
        </div>

        {/* File tabs */}
        {fileNames.length > 1 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {fileNames.map((file, idx) => (
              <button
                key={file}
                onClick={() => setActiveFile(file)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  file === activeFile
                    ? "bg-gray-800 text-white border-gray-800"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}
              >
                {idx === 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${file === activeFile ? "bg-green-400" : "bg-green-500"}`} />
                )}
                {file}
              </button>
            ))}
          </div>
        )}

        {/* Time controls */}
        <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 mb-3">

          {/* Row 1: center + windows + step */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-700">
              Center:
              <input
                type="time"
                step="1"
                value={secToTime(centerSec)}
                onChange={e => e.target.value && setCenterSec(timeToSec(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </label>

            {/* Quick time shortcuts */}
            <div className="flex gap-1 items-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold mr-1">Jump:</span>
              {TIME_SHORTCUTS.map(s => (
                <button
                  key={s.time}
                  onClick={() => jumpTo(timeToSec(s.time))}
                  className="px-2 py-1 text-[11px] font-mono font-medium rounded-md bg-white text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-gray-500 ml-2">±</span>

            <div className="flex gap-1 items-center">
              {WINDOW_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => setWindowSec(p.sec)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                    windowSec === p.sec
                      ? "bg-indigo-600 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 ml-auto">
              <button
                onClick={() => jumpTo(centerSec - windowSec)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
              >
                ← Step
              </button>
              <button
                onClick={() => jumpTo(centerSec + windowSec)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white hover:bg-gray-100"
              >
                Step →
              </button>
            </div>
          </div>

        </div>

        {/* Kind filters + category dropdown + search */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(EVENT_KINDS).map(([key, k]) => {
              const active = enabledKinds.has(key);
              const count  = kindCounts[key] || 0;
              return (
                <button
                  key={key}
                  onClick={() => toggleKind(key)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-all"
                  style={{
                    backgroundColor: active ? k.color : "white",
                    color:           active ? "white" : k.color,
                    borderColor:     k.color,
                    opacity:         active ? 1 : 0.6,
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{
                    backgroundColor: active ? "rgba(255,255,255,0.7)" : k.color
                  }} />
                  {k.label} {count > 0 && <span className="font-mono">{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 items-center">
            {/* Category filter button */}
            <div className="relative">
              <button
                onClick={() => setShowCatPicker(v => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  allCatsEnabled
                    ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    : "bg-indigo-50 text-indigo-700 border-indigo-300"
                }`}
              >
                Categories
                <span className="font-mono">{activeCatsCount}/{facets.categories.length}</span>
                <span className="text-gray-400">{showCatPicker ? "▲" : "▼"}</span>
              </button>

              {showCatPicker && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowCatPicker(false)} />
                  <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-xl z-40 w-64 max-h-80 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 flex gap-2">
                      <button
                        onClick={() => setEnabledCats(null)}
                        className="flex-1 px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                      >
                        Select all
                      </button>
                      <button
                        onClick={() => setEnabledCats(new Set())}
                        className="flex-1 px-2 py-1 text-xs rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-1">
                      {facets.categories.map(({ name, count }) => {
                        const checked = enabledCats === null || enabledCats.has(name);
                        return (
                          <label
                            key={name}
                            className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded-md cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCategory(name)}
                              className="shrink-0"
                            />
                            <span className="font-mono text-gray-700 flex-1 truncate" title={name}>{name}</span>
                            <span className="text-gray-400 font-mono">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <input
              type="text"
              placeholder="Search messages…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* ── Event list (the only scrollable area) ────────────────────────── */}
      <div className="flex-1 min-h-0 border border-gray-200 rounded-xl overflow-hidden flex flex-col">

        {/* Sticky column header */}
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 shrink-0">
          <span className="text-[10px] text-gray-400 uppercase tracking-wide w-20 shrink-0">Time</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide w-24 shrink-0">Kind</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide w-14 shrink-0">Source</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide w-28 shrink-0">Category</span>
          <span className="text-[10px] text-gray-400 uppercase tracking-wide flex-1">Message</span>
        </div>

        {/* Scrollable list */}
        <div className="overflow-y-auto flex-1">
          {filteredEvents.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">
              No events in this time window
              {parsed.totalScanned > 0 && ` (${parsed.totalScanned} lines scanned)`}.
            </div>
          ) : (
            filteredEvents.map((ev, i) => {
              const k = EVENT_KINDS[ev.kind];
              const isExpanded = expanded[i];
              return (
                <div
                  key={i}
                  className="border-b last:border-b-0 cursor-pointer hover:brightness-95 transition-colors"
                  style={{ borderColor: k.border, backgroundColor: k.bg }}
                  onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
                >
                  <div className="flex items-start gap-3 px-4 py-2">
                    <span className="text-xs font-mono font-bold w-20 shrink-0 tabular-nums" style={{ color: k.color }}>
                      {ev.ms ? ev.ms.slice(0,8) : ev.time}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border w-24 shrink-0 text-center"
                      style={{ backgroundColor: "white", borderColor: k.border, color: k.color }}>
                      {k.label}
                    </span>
                    <span className="text-xs font-mono text-gray-500 w-14 shrink-0 truncate" title={ev.source}>
                      {ev.source}
                    </span>
                    <span className="text-xs font-mono text-gray-500 w-28 shrink-0 truncate" title={ev.category}>
                      {ev.category}
                    </span>
                    <span className="text-sm text-gray-800 flex-1 min-w-0 leading-snug">
                      {ev.summary}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-3 pt-1 border-t" style={{ borderColor: k.border }}>
                      <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-xs mb-2">
                        <div><span className="text-gray-500">Level:</span> <span className="font-medium">{ev.level}</span></div>
                        <div><span className="text-gray-500">Source:</span> <span className="font-mono">{ev.source}</span></div>
                        <div><span className="text-gray-500">Category:</span> <span className="font-mono">{ev.category}</span></div>
                        <div><span className="text-gray-500">Time:</span> <span className="font-mono">{ev.ms}</span></div>
                      </div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Full message</p>
                      <pre className="text-xs bg-white border border-gray-200 rounded-lg p-2 whitespace-pre-wrap font-mono break-all max-h-40 overflow-y-auto">
                        {ev.raw}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}