import React, { useState } from 'react';
import RecentInterlocks from './RecentInterlocks';
import TrendViewer from './TrendViewer';
import Report from './Report';
import BeamViewer from './Beamviewer';
import LogViewer from './LogViewer';

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
  rawLogTexts,        // ← new prop: { filename: rawText }
}) {
  const [showInterlocks, setShowInterlocks] = useState(false);
  const [showTrends,     setShowTrends]     = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [showBeams,      setShowBeams]      = useState(false);
  const [showLog,        setShowLog]        = useState(false);
  const [trendInitialParam, setTrendInitialParam] = useState(null);

  function handleOpenTrend(param) {
    setTrendInitialParam(param);
    setShowTrends(true);
  }

  function handleCloseTrends() {
    setShowTrends(false);
    setTrendInitialParam(null);
  }

  const totalMVBeams = Object.values(beamEventsByFile || {})
    .flat()
    .filter(b => b.isMV).length;

  const hasLogs = rawLogTexts && Object.keys(rawLogTexts).length > 0;

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
        ⚠️ Recent interlocks
      </button>

      {showInterlocks && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-2xl shadow-lg relative flex flex-col"
            style={{ width: "min(90vw, 1400px)", maxHeight: "90vh", padding: "1.5rem" }}>
            <button className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={() => setShowInterlocks(false)}>✕</button>
            <div className="overflow-y-auto flex-1">
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
        ⚙️ Controllers
      </button>

      {showTrends && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 60 }}>
          <div className="bg-white rounded-2xl shadow-lg relative flex flex-col"
            style={{ width: "min(90vw, 1400px)", maxHeight: "90vh", padding: "1.5rem" }}>
            <button className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={handleCloseTrends}>✕</button>
            <div className="overflow-y-auto flex-1">
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
        {showTimeline ? '⏱️ Hide timeline' : '⏱️ Show timeline'}
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

      {/* ── Log activity (always last, rightmost) ── */}
      {hasLogs && (
        <button
          className="px-4 py-3 rounded-2xl border border-blue-600 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-2"
          onClick={() => setShowLog(true)}
          title="Browse raw log activity in a time window"
        >
          📋 Log
        </button>
      )}

      {showLog && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-2xl shadow-lg relative flex flex-col"
            style={{ width: "min(95vw, 1600px)", height: "92vh", padding: "1.5rem" }}>
            <button className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md z-10"
              onClick={() => setShowLog(false)}>✕</button>
            <div className="overflow-hidden flex-1">
              <LogViewer rawLogTexts={rawLogTexts} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}