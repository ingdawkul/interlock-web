import React, { useState } from 'react';
import RecentInterlocks from './RecentInterlocks';
import TrendViewer from './TrendViewer';
import Report from './Report';

export default function StatsBar({
  totalLines,
  matches,
  uniqueCount,
  recentInterlocks,
  trendData,
  showTimeline,
  setShowTimeline,
  fileMachines,
  query,
  setQuery,
}) {
  const [showInterlocks, setShowInterlocks] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [trendInitialParam, setTrendInitialParam] = useState(null);

  function handleOpenTrend(param) {
    setTrendInitialParam(param);
    setShowTrends(true);
    // ← Report stays open, TrendViewer opens on top (z-60)
  }

  function handleCloseTrends() {
    setShowTrends(false);
    setTrendInitialParam(null);
  }

  return (
    <div className="flex flex-wrap gap-4 items-center text-sm w-full">
      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Lines: <strong>{totalLines}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Interlocks: <strong>{matches}</strong>
      </div>

      <div
        className="p-3 rounded-2xl shadow-sm border"
        style={{ color: 'var(--btn-secondary-hover)', borderColor: 'var(--border-soft)' }}
      >
        Unique Interlocks: <strong>{uniqueCount}</strong>
      </div>

      {/* ── Recent interlocks ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-orange-500 bg-gray-100 hover:bg-gray-200"
        onClick={() => setShowInterlocks(true)}
      >
        Show recent interlocks
      </button>

      {showInterlocks && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div
            className="bg-white rounded-lg shadow-lg max-w-8xl w-full p-6 relative overflow-hidden"
            style={{ maxHeight: '100vh' }}
          >
            <button
              className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={() => setShowInterlocks(false)}
            >
              ✕
            </button>
            <div className="overflow-y-auto panel">
              <RecentInterlocks interlocks={recentInterlocks} />
            </div>
          </div>
        </div>
      )}

      {/* ── Trend / Controllers ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-orange-500 bg-gray-100 hover:bg-gray-200"
        onClick={() => { setTrendInitialParam(null); setShowTrends(true); }}
      >
        Show controllers
      </button>

      {/* TrendViewer modal – z-60 so it layers above Report (z-50) */}
      {showTrends && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 60 }}>
          <div
            className="bg-white rounded-lg shadow-lg max-w-8xl w-full p-6 relative overflow-hidden"
            style={{ maxHeight: '100vh' }}
          >
            <button
              className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={handleCloseTrends}
            >
              ✕
            </button>
            <div className="overflow-y-auto panel">
              <TrendViewer trendData={trendData} initialParam={trendInitialParam} />
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-orange-500 bg-gray-100 hover:bg-gray-200"
        onClick={() => setShowTimeline(prev => !prev)}
      >
        {showTimeline ? 'Hide timeline' : 'Show timeline'}
      </button>

      {/* ── Report – z-50 ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-2"
        onClick={() => setShowReport(true)}
      >
        Report
      </button>

      {showReport && (
        <Report
          trendData={trendData}
          fileMachines={fileMachines}
          onClose={() => setShowReport(false)}
          onOpenTrend={handleOpenTrend}
        />
      )}

      {/* ── Search ── */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search (ID, Type or Description)"
        className="px-4 py-3 rounded-2xl w-64 border border-gray-400 ml-auto"
      />
    </div>
  );
}