import React, { useState } from 'react';
import RecentInterlocks from './RecentInterlocks';
import TrendViewer from './TrendViewer';
import Report from './Report';
import BeamViewer from './Beamviewer';

export default function StatsBar({
  totalLines,
  matches,
  uniqueCount,
  recentInterlocks,
  trendData,
  showTimeline,
  setShowTimeline,
  fileMachines,
  beamEventsByFile,
}) {
  const [showInterlocks, setShowInterlocks] = useState(false);
  const [showTrends,     setShowTrends]     = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [showBeams,      setShowBeams]      = useState(false);
  const [trendInitialParam, setTrendInitialParam] = useState(null);

  function handleOpenTrend(param) {
    setTrendInitialParam(param);
    setShowTrends(true);
  }

  function handleCloseTrends() {
    setShowTrends(false);
    setTrendInitialParam(null);
  }

  // Total MV beam count across all files
  const totalMVBeams = Object.values(beamEventsByFile || {})
    .flat()
    .filter(b => b.isMV).length;

  return (
    <div className="flex flex-wrap gap-4 items-center text-sm w-full">
      <div className="px-4 py-3 rounded-2xl border bg-gray-200 shadow-sm inline-flex items-center gap-2">
        <span className="text-sm text-gray-800">Lines</span>
        <span className="text-sm font-semibold">{totalLines}</span>
      </div>

      <div className="px-4 py-3 rounded-2xl border bg-gray-200 shadow-sm inline-flex items-center gap-2">
        <span className="text-sm  text-gray-800">Interlocks</span>
        <span className="text-sm font-semibold">{matches}</span>
      </div>

      <div className="px-4 py-3 rounded-2xl border bg-gray-200 shadow-sm inline-flex items-center gap-2">
        <span className="text-sm text-gray-800">Unique Interlocks</span>
        <span className="text-sm font-semibold">{uniqueCount}</span>
      </div>

      {/* ── Recent interlocks ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-indigo-500 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-2"
        onClick={() => setShowInterlocks(true)}
      >
      ⚠️ Show recent interlocks
      </button>

      {showInterlocks && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-8xl w-full p-6 relative overflow-hidden" style={{ maxHeight: '100vh' }}>
            <button className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={() => setShowInterlocks(false)}>✕</button>
            <div className="overflow-y-auto panel">
              <RecentInterlocks interlocks={recentInterlocks} />
            </div>
          </div>
        </div>
      )}

      {/* ── Trend / Controllers ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-indigo-500 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-2"
        onClick={() => { setTrendInitialParam(null); setShowTrends(true); }}
      >
        ⚙️ Show controllers
      </button>

      {showTrends && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 60 }}>
          <div className="bg-white rounded-lg shadow-lg max-w-8xl w-full p-6 relative overflow-hidden" style={{ maxHeight: '100vh' }}>
            <button className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={handleCloseTrends}>✕</button>
            <div className="overflow-y-auto panel">
              <TrendViewer trendData={trendData} initialParam={trendInitialParam} />
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-indigo-500 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-2"
        onClick={() => setShowTimeline(prev => !prev)}
      >
        {showTimeline ? '⏱️Hide timeline' : '⏱️ Show timeline'}
      </button>

            {/* ── Beam activity ── */}
      {totalMVBeams > 0 && (
        <button
          className="px-4 py-3 rounded-2xl border border-indigo-500 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold flex items-center gap-2"
          onClick={() => setShowBeams(true)}
        >
          ⚡ Beams <span className="text-xs bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded-full">{totalMVBeams}</span>
        </button>
      )}

      {showBeams && (
        <BeamViewer
          beamEventsByFile={beamEventsByFile}
          fileMachines={fileMachines}
          onClose={() => setShowBeams(false)}
        />
      )}

      {/* ── Report ── */}
      <button
        className="px-4 py-3 rounded-2xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-2"
        onClick={() => setShowReport(true)}
      >
        📄 Report
      </button>

      {showReport && (
        <Report
          trendData={trendData}
          fileMachines={fileMachines}
          onClose={() => setShowReport(false)}
          onOpenTrend={handleOpenTrend}
        />
      )}
    </div>
  );
}