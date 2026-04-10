import React, { useState, useMemo, useEffect, useCallback } from 'react'

import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import DayTimeline from './components/DayTimeline'
import './theme.css'
import InterlockSearch from "./components/InterlockSearch"
import InterlockActionsModal from "./components/InterlockActionsModal"
import { interlockMap } from './utils/interlockLookup'
import { parseLogText, parsePowerEvents, buildPowerIntervals, parseBeamEvents } from './utils/parser'

// ── Timeline legend data ──────────────────────────────────
const TIMELINE_LEGEND = [
  { color: "#9ca3af", label: "Default – outside working hours" },
  { color: "#dc2626", label: "Stop / fault (downtime)" },
  { color: "#3b82f6", label: "Clinical mode" },
  { color: "#fb923c", label: "Service mode" },
  { color: "#facc15", label: "Power ON event", border: true, glow: "#facc15" },
  { color: "#7c3aed", label: "Power OFF event", border: true, glow: "#7c3aed" },
]

function TimelineLegendPopover({ onClose }) {
  return (
    <>
      {/* click-outside overlay */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-8 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50 w-72"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Timeline legend</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <ul className="space-y-2">
          {TIMELINE_LEGEND.map(({ color, label, border, glow }) => (
            <li key={label} className="flex items-center gap-3 text-xs text-gray-700">
              <span
                className="shrink-0 rounded-sm"
                style={{
                  width: 18, height: 14,
                  backgroundColor: color,
                  border: border ? "1px solid rgba(0,0,0,0.3)" : "none",
                  boxShadow: glow ? `0 0 6px ${glow}` : "none",
                  display: "inline-block"
                }}
              />
              {label}
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-gray-400 mt-3 leading-tight">
          Power events are shown as short vertical markers on the bar —
          purple (top half) for OFF and yellow (bottom half) for ON.
        </p>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────

export default function App() {
  const [rawFiles, setRawFiles] = useState([])
  const [results, setResults] = useState({})
  const [totalLines, setTotalLines] = useState(0)
  const [matchLines, setMatchLines] = useState(0)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [recentInterlocks, setRecentInterlocks] = useState([])
  const [fileMachines, setFileMachines] = useState({})
  const [fileDowntime, setFileDowntime] = useState({})
  const [searchInterlock, setSearchInterlock] = useState(null)
  const [showTimeline, setShowTimeline] = useState(false)
  const [filePowerRaw, setFilePowerRaw] = useState({})
  const [filePowerRawEvents, setFilePowerRawEvents] = useState({})
  const [showTimelineLegend, setShowTimelineLegend] = useState(false)

  const [trendData, setTrendData] = useState({})
  const [fileDowntimeRaw, setFileDowntimeRaw] = useState({})
  const [fileSystemModesRaw, setFileSystemModesRaw] = useState({})
  const [fileBeamEvents, setFileBeamEvents] = useState({})

  function extractDateFromFilename(name) {
    const match = name.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return null
    const [, y, m, d] = match
    return new Date(`${y}-${m}-${d}`)
  }

  function calcDowntimeStats(downtimeByDate) {
    let count = 0
    let minutes = 0
    for (const intervals of Object.values(downtimeByDate || {})) {
      for (const d of intervals) {
        count++
        const start = new Date(`1970-01-01T${d.start}`)
        const end = new Date(`1970-01-01T${d.end}`)
        minutes += Math.max(0, (end - start) / 1000 / 60)
      }
    }
    return { count, minutes: Math.round(minutes) }
  }

  const uniqueMachineNames = useMemo(() => {
    return new Set(Object.values(fileMachines)).size
  }, [fileMachines])

  const showMachineName = uniqueMachineNames > 1

  const handleDroppedFiles = useCallback(async (fileList) => {
    const fileObjs = await Promise.all(
      Array.from(fileList).map(f =>
        f.text().then(txt => ({ name: f.name, text: txt }))
      )
    )
    handleFiles(fileObjs)
  }, [])

  useEffect(() => {
    const preventDefaults = (e) => { e.preventDefault(); e.stopPropagation() }
    const handleDrop = (e) => {
      preventDefaults(e)
      if (e.dataTransfer.files?.length > 0) handleDroppedFiles(e.dataTransfer.files)
    }
    window.addEventListener('dragover', preventDefaults)
    window.addEventListener('drop', handleDrop)
    return () => {
      window.removeEventListener('dragover', preventDefaults)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDroppedFiles])

  const handleFiles = (files) => {
    const normalizeAndProcess = async () => {
      const arr = await Promise.all(
        Array.from(files).map(async (f) => {
          if (f && typeof f.text === 'function' && f.name && !('text' in f)) {
            const txt = await f.text()
            return { name: f.name, text: txt }
          }
          return f
        })
      )

      const sortedNames = arr
        .map(f => f.name)
        .sort((a, b) => {
          const da = extractDateFromFilename(a)
          const db = extractDateFromFilename(b)
          if (!da && !db) return 0
          if (!da) return 1
          if (!db) return -1
          return da - db
        })

      setRawFiles(sortedNames)

      let combinedResults = {}
      let total = 0
      let matches = 0

      const newInterlocks = []
      const machines = {}
      const downtimeStats = {}
      const downtimeRaw = {}
      const powerRaw = {}
      const powerRawEventsPerFile = {}
      const systemModesRaw = {}
      const combinedTrendData = {}
      const beamEventsPerFile = {}

      for (const f of arr) {
        const {
          results: r,
          totalLines: t,
          matchLines: m,
          machineName,
          downtimeByDate,
          systemModesByDate,
          trendData
        } = parseLogText(f.text)

        total += t
        matches += m

        const lines = f.text.split("\n")
        const rawPowerEvents = parsePowerEvents(lines)
        const powerIntervals = buildPowerIntervals(rawPowerEvents)

        const beamEvents = parseBeamEvents(lines)
        if (beamEvents.length > 0) {
          beamEventsPerFile[f.name] = beamEvents
        }

        if (rawPowerEvents.length > 0) powerRawEventsPerFile[f.name] = rawPowerEvents
        if (powerIntervals.length > 0) powerRaw[f.name] = powerIntervals
        if (machineName) machines[f.name] = machineName

        if (trendData) {
          Object.entries(trendData).forEach(([param, points]) => {
            if (!combinedTrendData[param]) combinedTrendData[param] = []
            combinedTrendData[param].push(...points)
          })
        }

        if (downtimeByDate && Object.keys(downtimeByDate).length > 0) {
          downtimeStats[f.name] = calcDowntimeStats(downtimeByDate)
          downtimeRaw[f.name] = downtimeByDate
        }

        if (systemModesByDate && Object.keys(systemModesByDate).length > 0) {
          systemModesRaw[f.name] = systemModesByDate
        }

        for (const [id, data] of Object.entries(r)) {
          if (!combinedResults[id]) combinedResults[id] = { entries: [], total: 0 }
          combinedResults[id].total += data.total

          for (const e of data.entries) {
            newInterlocks.push({
              id, type: e.Type, description: e.description,
              times: e.Times, Dates: e.Dates || [], file: f.name
            })

            let found = false
            for (const ex of combinedResults[id].entries) {
              if (ex.description === e.description && ex.Type === e.Type) {
                ex.Times = ex.Times.concat(e.Times)
                ex.Dates = ex.Dates ? ex.Dates.concat(e.Dates || []) : (e.Dates || [])
                found = true
                break
              }
            }

            if (!found) {
              combinedResults[id].entries.push({ ...e, file: f.name })
            }
          }
        }
      }

      Object.values(combinedTrendData).forEach(arr =>
        arr.sort((a, b) => a.timestamp - b.timestamp)
      )

      const sortedRecent = newInterlocks.sort((a, b) => {
        const lastA = a.times[a.times.length - 1]
        const lastB = b.times?.[b.times.length - 1]
        const dateA = lastA ? new Date(`1970-01-01T${lastA}`) : new Date(0)
        const dateB = lastB ? new Date(`1970-01-01T${lastB}`) : new Date(0)
        return dateB - dateA
      })

      setResults(combinedResults)
      setFileMachines(machines)
      setFileDowntime(downtimeStats)
      setFileDowntimeRaw(downtimeRaw)
      setFileSystemModesRaw(systemModesRaw)
      setTotalLines(total)
      setMatchLines(matches)
      setRecentInterlocks(sortedRecent)
      setSelected(null)
      setFilePowerRaw(powerRaw)
      setFilePowerRawEvents(powerRawEventsPerFile)
      setTrendData(combinedTrendData)
      setFileBeamEvents(beamEventsPerFile)
    }

    normalizeAndProcess().catch(err => console.error("Error while reading files:", err))
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return { id: selected, entries: data.entries }
  }, [selected, results])

  const showDate = rawFiles.length > 1

  // ── Empty state ───────────────────────────────────────────
  if (rawFiles.length === 0) {
    return (
      <div
        className="app-container min-h-screen flex flex-col bg-primary-dark text-primary"
        style={{ backgroundColor: 'var(--color-primary-dark)' }}
      >
        <header className="flex items-center justify-between p-6 max-w-[1400px] mx-auto w-full">
          <img src="/interlock-web/bjornlogo.png" alt="favicon" className="w-56 h-24 rounded-2xl" />
        </header>

        <main className="flex flex-col items-center justify-center flex-1 w-full px-4">
          <div className="w-full max-w-xl mx-auto mb-6">
            <InterlockSearch
              onSelect={(idOrObj) => {
                if (idOrObj && typeof idOrObj === "object") {
                  setSearchInterlock(idOrObj)
                } else if (idOrObj && interlockMap[idOrObj]) {
                  setSearchInterlock(interlockMap[idOrObj])
                } else {
                  console.warn("Could not find interlock for id:", idOrObj)
                }
              }}
            />
          </div>
          <div className="w-full px-4">
            <div className="w-full max-w-6xl mx-auto">
              <FilePicker onFiles={handleDroppedFiles} height="50vh" />
            </div>
          </div>
        </main>

        {searchInterlock && (
          <InterlockActionsModal interlock={searchInterlock} onClose={() => setSearchInterlock(null)} />
        )}
        <footer className="text-center text-xs text-gray-400 mt-6 pb-2 opacity-70">
          © {new Date().getFullYear()} OUS AMF ING. All rights reserved.
        </footer>
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────
  return (
    <div
      className="app-container p-6 max-w-[1400px] mx-auto text-primary"
      style={{ backgroundColor: 'var(--color-primary-dark)' }}
    >
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => window.location.reload()}>
          <img
            src={import.meta.env.BASE_URL + 'bjornlogo.png'}
            alt="favicon"
            className="w-56 h-24 rounded-2xl transition-transform duration-200 hover:scale-110"
          />
        </button>
        <div style={{ minWidth: 320 }}>
          <FilePicker onFiles={handleDroppedFiles} />
        </div>
      </header>

      <div className="bg-white panel mb-4 border rounded-2xl p-4">

        {/* ── Panel header: title + legend button ── */}
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold">Selected files:</p>

          {/* Legend button – only visible when timeline is shown */}
          {showTimeline && (
            <div className="relative">
              <button
                onClick={() => setShowTimelineLegend(v => !v)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center font-bold text-[9px] leading-none">
                  i
                </span>
                Timeline legend
              </button>

              {showTimelineLegend && (
                <TimelineLegendPopover onClose={() => setShowTimelineLegend(false)} />
              )}
            </div>
          )}
        </div>

        {/* ── File list ── */}
        <ul className="list-none text-sm mb-6 space-y-3">
          {rawFiles.map((file, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{file}</span>

                {fileMachines[file] && (
                  <span className="text-orange-500 italic font-bold">
                    | {fileMachines[file]}
                  </span>
                )}

                {showTimeline && fileDowntime[file] && (
                  <span className="text-red-600 font-semibold">
                    | {fileDowntime[file].count} STOP ({fileDowntime[file].minutes} min)
                  </span>
                )}

                {showTimeline && filePowerRawEvents[file]?.length > 0 && (
                  <span className="text-sm text-gray-500 font-semibold">
                    {" | "}
                    {filePowerRawEvents[file]
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((e, i) => (
                        <span
                          key={i}
                          className={`mr-2 font-semibold ${
                            e.type === "OFF" ? "text-purple-600" : "text-yellow-600"
                          }`}
                        >
                          {e.type} {e.time}
                        </span>
                      ))}
                  </span>
                )}
              </div>

              <div className={`timeline-wrapper ${showTimeline ? 'open' : 'closed'}`}>
                <div className="timeline-inner">
                  <DayTimeline
                    downtime={Object.values(fileDowntimeRaw[file] || {}).flat()}
                    systemModes={Object.values(fileSystemModesRaw[file] || {}).flat()}
                    powerEvents={filePowerRaw[file] || []}
                    powerRawEvents={filePowerRawEvents[file] || []}
                    beamEvents={fileBeamEvents[file] || []}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* ── StatsBar ── */}
        <div className="flex flex-wrap items-center gap-4 mb-4 relative z-20">
          <StatsBar
            totalLines={totalLines}
            matches={matchLines}
            uniqueCount={Object.keys(results).length}
            recentInterlocks={recentInterlocks}
            trendData={trendData}
            showTimeline={showTimeline}
            setShowTimeline={setShowTimeline}
            fileMachines={fileMachines}
            query={query}
            setQuery={setQuery}
            beamEventsByFile={fileBeamEvents}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel rounded-lg p-2">
          <InterlockTable results={results} onSelect={setSelected} query={query} setQuery={setQuery} />
        </div>
        <div className="panel rounded-lg p-2">
          <DetailTable
            data={selectedData}
            showDate={showDate}
            fileMachines={fileMachines}
            showMachineName={showMachineName}
          />
        </div>
      </div>

      {searchInterlock && (
        <InterlockActionsModal interlock={searchInterlock} onClose={() => setSearchInterlock(null)} />
      )}

      <footer className="text-center text-xs text-gray-400 mt-6 pb-2 opacity-70">
        © {new Date().getFullYear()} OUS AMF ING. All rights reserved.
      </footer>
    </div>
  )
}