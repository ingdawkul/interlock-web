import React, { useState, useMemo, useEffect, useCallback } from 'react'

import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import DayTimeline, { getModeColor, OTHER_MODE_COLOR, KNOWN_MODES, appColor } from './components/DayTimeline'
import './theme.css'
import InterlockSearch from "./components/InterlockSearch"
import InterlockActionsModal from "./components/InterlockActionsModal"
import FailedFilesModal from "./components/FailedFilesModal"
import NetworkEventsModal from "./components/NetworkEventsModal"
import { interlockMap } from './utils/interlockLookup'
import { parseLogText, parsePowerEvents, buildPowerIntervals, parseBeamEvents } from './utils/parser'
import { readFilesSequentially } from './utils/fileReader'

// ── Mode label map for known modes ───────────────────────────────────────────
const MODE_LABELS = {
  SERVICE:  "Service mode",
  CLINICAL: "Clinical mode",
  QA:       "QA mode",
  SMC:      "SMC mode (Safe Mode Control)",
  PMI:      "PMI mode (preventive maintenance)",
  INSTALL:  "Install mode",
}
const MODE_ORDER = ["CLINICAL", "SERVICE", "QA", "SMC", "PMI", "INSTALL"]

// Fixed legend sections for the extra timeline rows.
const STATE_LEGEND = [
  { color: "#16a34a", label: "ON" },
  { color: "#d97706", label: "STANDBY" },
  { color: "#dc2626", label: "POWEROFF" },
]
const MARKER_LEGEND = [
  { color: "#4EDFAF", label: "Power ON",  border: true, glow: "#4EDFAF" },
  { color: "#7c3aed", label: "Power OFF", border: true, glow: "#7c3aed" },
  { emoji: "👤",      label: "Login" },
]
const FAULT_LEGEND = [
  { color: "rgba(220,38,38,0.75)", label: "Fault density (click row: heatmap ⇄ sparkline)" },
]

// ── Lost-log detection (Module 6) ─────────────────────────────────────────────
// A "lost-log" window is a gap in the machine syslog ("SN# ####") during which
// the workstation kept logging (`wkstLines` high). The syslog chain was down —
// usually a power cut killing the syslog server — so any faults/interlocks in
// that window are missing from this file. We surface the windows so the operator
// knows the day's record has holes rather than reading a clean stretch.
const LOST_LOG_MIN_WKST = 50
// Only a substantial hole is worth alarming about. Some firmwares (e.g. SN5724)
// produce frequent 3–7 min syslog blips during normal operation; flagging those
// would cry wolf. A real outage (power cut killing the syslog server) is much
// longer. The Network tab still shades every significant gap for detail work.
const LOST_LOG_MIN_MINUTES = 15

function llToSec(t) {
  if (!t) return null
  const [h, m, s = 0] = t.split(":").map(Number)
  return h * 3600 + m * 60 + s
}

// Operating window = first machine/login activity → parked / last-seen. Silence
// gaps that fall outside it are not lost operational data — the machine simply
// wasn't running. This filters the nightly AutomaticPartsMaintenance run (~02:00,
// machine parked) that otherwise looks like a syslog-chain-down window.
function operatingWindow(bundle) {
  const starts = []
  if (bundle.machineStates?.length) {
    const s = llToSec(bundle.machineStates[0].start)
    if (s != null) starts.push(s)
  }
  if (bundle.logins?.length) {
    const ls = bundle.logins.map(l => llToSec(l.time)).filter(x => x != null)
    if (ls.length) starts.push(Math.min(...ls))
  }
  const dayStart = starts.length ? Math.min(...starts) : null
  const dayEnd = llToSec(bundle.parkedAt) ?? llToSec(bundle.lastSeen)
  return { dayStart, dayEnd }
}

function lostLogWindows(bundle) {
  if (!bundle || !bundle.silenceGaps) return []
  const { dayStart, dayEnd } = operatingWindow(bundle)
  return bundle.silenceGaps
    .filter(g => (g.wkstLines || 0) >= LOST_LOG_MIN_WKST && (g.durationMin || 0) >= LOST_LOG_MIN_MINUTES)
    .map(g => ({
      start: g.start?.time, end: g.end?.time,
      durationMin: g.durationMin, wkstLines: g.wkstLines,
    }))
    .filter(w => w.start && w.end)
    .filter(w => {
      const a = llToSec(w.start), b = llToSec(w.end)
      if (dayStart != null && b <= dayStart) return false  // before the day began
      if (dayEnd != null && a >= dayEnd) return false      // after the machine was parked
      return true
    })
}

function fmtGapDur(min) {
  if (min == null) return ""
  if (min < 60) return `${Math.round(min)} min`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

function LostLogBanner({ windows }) {
  if (!windows.length) return null
  return (
    <div className="mt-1.5 flex items-start gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
      <span className="text-sm leading-none mt-px">⚠️</span>
      <div>
        <span className="font-semibold">Log data lost</span>
        {" — the machine syslog went silent while the workstation kept logging. "}
        {windows.length === 1 ? "Events in this window are missing:" : "Events in these windows are missing:"}
        <ul className="mt-1 space-y-0.5 list-none">
          {windows.map((w, i) => (
            <li key={i} className="font-medium">
              {w.start}–{w.end}
              <span className="font-normal text-amber-700"> ({fmtGapDur(w.durationMin)}, ~{w.wkstLines.toLocaleString()} lines logged during the outage)</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function LegendSwatch({ color, border, glow, thin, emoji }) {
  if (emoji) {
    return <span className="shrink-0 inline-block text-center" style={{ width: 18, fontSize: 13, lineHeight: "14px" }}>{emoji}</span>
  }
  return (
    <span
      className="shrink-0 rounded-sm"
      style={{
        width: thin ? 4 : 18, height: 14,
        backgroundColor: color,
        border: border ? "1px solid rgba(0,0,0,0.3)" : "none",
        boxShadow: glow ? `0 0 6px ${glow}` : "none",
        display: "inline-block",
        marginLeft: thin ? 7 : 0, marginRight: thin ? 7 : 0,
      }}
    />
  )
}

function TimelineLegendPopover({ sections, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-8 bg-white border border-gray-200 rounded-2xl shadow-xl p-4 z-50 w-72 max-h-[70vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm text-gray-800">Timeline legend</span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
        </div>
        <div className="space-y-3">
          {sections.map(({ title, entries }) => (
            <div key={title}>
              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1.5">{title}</div>
              <ul className="space-y-1.5">
                {entries.map((e) => (
                  <li key={e.label} className="flex items-center gap-2 text-xs text-gray-700">
                    <LegendSwatch {...e} />
                    {e.label}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function AppFooter({ dark, onToggleDark }) {
  return (
    <footer className="text-center text-xs text-gray-400 mt-6 pb-4 opacity-80">
      <div>© {new Date().getFullYear()} OUS AMF ING. All rights reserved.</div>
      <div className="mt-0.5 italic">Designed and made by Dawid Kuleczko</div>
      <button
        onClick={onToggleDark}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 text-gray-500 hover:bg-gray-100 transition-colors"
        aria-label="Toggle dark mode"
      >
        {dark ? "☀️ Light mode" : "🌙 Dark mode"}
      </button>
    </footer>
  )
}

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
  const [rawLogTexts, setRawLogTexts] = useState({})
  const [fileNetwork, setFileNetwork] = useState({})   // Modules 2-5: per-file event bundle
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [dark, setDark] = useState(() => {
    try { return localStorage.getItem('theme') === 'dark' } catch { return false }
  })
  const [networkInitial, setNetworkInitial] = useState({ tab: null, file: null })

  const openEventsModal = (initial = { tab: null, file: null }) => {
    setNetworkInitial(initial)
    setShowNetworkModal(true)
  }
  const [loadProgress, setLoadProgress] = useState({
    active: false, phase: null, current: 0, total: 0, fileName: ''
  })
  // When some files fail to read (e.g. TrueBeam locking today's log), we pause
  // and let the user decide via FailedFilesModal. ok = successful reads so far,
  // failed = File objects that still need a decision.
  const [pendingRead, setPendingRead] = useState(null)

  const clearProgress = () =>
    setLoadProgress({ active: false, phase: null, current: 0, total: 0, fileName: '' })

  // Apply + persist the colour theme
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try { localStorage.setItem('theme', dark ? 'dark' : 'light') } catch {}
  }, [dark])

  // ── Dynamic legend: the main bar shows login-app sessions where logged, else
  //    system modes. Collect whichever the loaded files actually render. ────────
  const timelineLegend = useMemo(() => {
    // Login apps (newer software) — these colour the main bar as sessions
    const apps = new Set()
    for (const bundle of Object.values(fileNetwork)) {
      for (const l of (bundle.logins || [])) if (l.source === "task") apps.add(l.app)
    }

    // Modes from files WITHOUT app-based logins (the mode-fallback bar)
    const modes = new Set()
    for (const [fname, modesByDate] of Object.entries(fileSystemModesRaw)) {
      const bundle = fileNetwork[fname]
      const hasApp = bundle && (bundle.logins || []).some(l => l.source === "task")
      if (hasApp) continue
      for (const intervals of Object.values(modesByDate)) {
        for (const interval of intervals) modes.add(interval.mode)
      }
    }

    const mainEntries = [{ color: "#9ca3af", label: "No active session / mode" }]
    for (const app of [...apps].sort()) mainEntries.push({ color: appColor(app), label: app })
    const knownModes = [...modes].filter(m => KNOWN_MODES.includes(m))
      .sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b))
    const unknownModes = [...modes].filter(m => !KNOWN_MODES.includes(m))
    for (const m of knownModes) mainEntries.push({ color: getModeColor(m), label: MODE_LABELS[m] ?? `${m} mode` })
    if (unknownModes.length) mainEntries.push({ color: OTHER_MODE_COLOR, label: `Other / unknown (${unknownModes.join(", ")})` })

    return [
      { title: "Main bar (sessions / modes)", entries: mainEntries },
      { title: "Machine state", entries: STATE_LEGEND },
      { title: "Markers", entries: MARKER_LEGEND },
      { title: "Faults", entries: FAULT_LEGEND },
    ]
  }, [fileSystemModesRaw, fileNetwork])

  // ─────────────────────────────────────────────────────────────────────────

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
        const end   = new Date(`1970-01-01T${d.end}`)
        minutes += Math.max(0, (end - start) / 1000 / 60)
      }
    }
    return { count, minutes: Math.round(minutes) }
  }

  const uniqueMachineNames = useMemo(() => new Set(Object.values(fileMachines)).size, [fileMachines])
  const showMachineName    = uniqueMachineNames > 1

  const handleDroppedFiles = useCallback(async (fileList) => {
    const items = Array.from(fileList)
    if (items.length === 0) return

    // External callers may already pass normalized { name, text } objects —
    // pass those straight through to parsing.
    const alreadyNormalized = items[0] && typeof items[0].text === 'string'
    if (alreadyNormalized) {
      handleFiles(items)
      return
    }

    setLoadProgress({
      active: true, phase: 'reading',
      current: 0, total: items.length, fileName: items[0]?.name ?? ''
    })

    const { ok, failed } = await readFilesSequentially(items, { onProgress: setLoadProgress })

    if (failed.length > 0) {
      // Pause here and let the user decide. The modal renders based on pendingRead.
      clearProgress()
      setPendingRead({ ok, failed })
      return
    }

    handleFiles(ok)
  }, [])

  const handleRetryFailed = useCallback(async () => {
    if (!pendingRead) return
    const { ok: prevOk, failed: prevFailed } = pendingRead
    setPendingRead(null)

    setLoadProgress({
      active: true, phase: 'reading',
      current: 0, total: prevFailed.length, fileName: prevFailed[0]?.name ?? ''
    })

    const { ok: newOk, failed: newFailed } = await readFilesSequentially(prevFailed, { onProgress: setLoadProgress })
    const combinedOk = [...prevOk, ...newOk]

    if (newFailed.length > 0) {
      clearProgress()
      setPendingRead({ ok: combinedOk, failed: newFailed })
      return
    }

    handleFiles(combinedOk)
  }, [pendingRead])

  const handleSkipFailed = useCallback(() => {
    if (!pendingRead) return
    const okFiles = pendingRead.ok
    setPendingRead(null)
    if (okFiles.length > 0) handleFiles(okFiles)
    else clearProgress()
  }, [pendingRead])

  const handleCancelLoad = useCallback(() => {
    setPendingRead(null)
    clearProgress()
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
      let total   = 0
      let matches = 0

      const newInterlocks          = []
      const machines               = {}
      const downtimeStats          = {}
      const downtimeRaw            = {}
      const powerRaw               = {}
      const powerRawEventsPerFile  = {}
      const systemModesRaw         = {}
      const combinedTrendData      = {}
      const beamEventsPerFile      = {}
      const rawTextPerFile         = {}
      const networkPerFile         = {}

      setLoadProgress({
        active: true, phase: 'parsing',
        current: 0, total: arr.length, fileName: arr[0]?.name ?? ''
      })
      await new Promise(r => setTimeout(r, 0))

      for (let i = 0; i < arr.length; i++) {
        const f = arr[i]
        setLoadProgress({
          active: true, phase: 'parsing',
          current: i, total: arr.length, fileName: f.name
        })
        // Yield to React between files so the progress bar can actually paint
        await new Promise(r => setTimeout(r, 0))

        const {
          results: r, totalLines: t, matchLines: m,
          machineName, downtimeByDate, systemModesByDate, trendData, parkedAt, lastSeen,
          nodeEvents, nodeDisconnects, heartbeatLosses, coldStarts, silenceGaps,
          cbctDowns, exioEvents, imagingPsuEvents, irmEvents,
          stateEvents, machineStates, modeUpAttempts, modeUpLatencies, pelEvents, warmupDelays,
          powerLossIntervals, emoEvents, flappingGroups, cbHits,
          logins, failedLogins, restarts, planLoads,
          faultIntervals, orphanRemovals
        } = parseLogText(f.text)

        // Flatten fault raise/removal events for the faults density timeline
        const faultEvents = [
          ...(faultIntervals || []).filter(iv => iv.start).map(iv => ({ time: iv.start, id: iv.id })),
          ...(orphanRemovals || []).map(o => ({ time: o.time, id: o.id })),
        ]

        total   += t
        matches += m

        // Modules 2 & 3: keep the per-file event bundle if anything was found
        const hasNetwork = (nodeEvents && nodeEvents.length) || (silenceGaps && silenceGaps.length) ||
            (coldStarts && coldStarts.length) || (heartbeatLosses && heartbeatLosses.length) ||
            (cbctDowns && cbctDowns.length) || (exioEvents && exioEvents.length) ||
            (imagingPsuEvents && imagingPsuEvents.length) || (irmEvents && irmEvents.length)
        const hasState = (machineStates && machineStates.length) || (pelEvents && pelEvents.length) ||
            (modeUpAttempts && modeUpAttempts.length)
        const hasPower = (powerLossIntervals && powerLossIntervals.length) || (emoEvents && emoEvents.length) ||
            (cbHits && cbHits.length)
        const hasSession = (logins && logins.length) || (failedLogins && failedLogins.length) ||
            (restarts && restarts.length)
        const hasFaults = faultEvents.length > 0
        if (hasNetwork || hasState || hasPower || hasSession || hasFaults) {
          networkPerFile[f.name] = {
            nodeEvents: nodeEvents || [],
            nodeDisconnects: nodeDisconnects || [],
            heartbeatLosses: heartbeatLosses || [],
            coldStarts: coldStarts || [],
            silenceGaps: silenceGaps || [],
            cbctDowns: cbctDowns || [],
            exioEvents: exioEvents || [],
            imagingPsuEvents: imagingPsuEvents || [],
            irmEvents: irmEvents || [],
            stateEvents: stateEvents || [],
            machineStates: machineStates || [],
            modeUpAttempts: modeUpAttempts || [],
            modeUpLatencies: modeUpLatencies || [],
            pelEvents: pelEvents || [],
            warmupDelays: warmupDelays || [],
            powerLossIntervals: powerLossIntervals || [],
            emoEvents: emoEvents || [],
            flappingGroups: flappingGroups || [],
            cbHits: cbHits || [],
            logins: logins || [],
            failedLogins: failedLogins || [],
            restarts: restarts || [],
            planLoads: planLoads || [],
            faultEvents,
            parkedAt,
            lastSeen
          }
        }

        const lines          = f.text.split("\n")
        const rawPowerEvents = parsePowerEvents(lines)
        const powerIntervals = buildPowerIntervals(rawPowerEvents)
        const beamEvents     = parseBeamEvents(lines)

        if (beamEvents.length > 0)     beamEventsPerFile[f.name]    = beamEvents
        if (rawPowerEvents.length > 0) powerRawEventsPerFile[f.name] = rawPowerEvents
        if (powerIntervals.length > 0) powerRaw[f.name]             = powerIntervals
        if (machineName)               machines[f.name]             = machineName
        rawTextPerFile[f.name] = f.text

        if (trendData) {
          Object.entries(trendData).forEach(([param, points]) => {
            if (!combinedTrendData[param]) combinedTrendData[param] = []
            combinedTrendData[param].push(...points)
          })
        }

        if (downtimeByDate && Object.keys(downtimeByDate).length > 0) {
          downtimeStats[f.name] = calcDowntimeStats(downtimeByDate)
          downtimeRaw[f.name]   = downtimeByDate
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
            if (!found) combinedResults[id].entries.push({ ...e, file: f.name })
          }
        }
      }

      setLoadProgress({
        active: true, phase: 'parsing',
        current: arr.length, total: arr.length, fileName: ''
      })
      await new Promise(r => setTimeout(r, 0))

      Object.values(combinedTrendData).forEach(arr => arr.sort((a, b) => a.timestamp - b.timestamp))

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
      setRawLogTexts(rawTextPerFile)
      setFileNetwork(networkPerFile)
      setLoadProgress({ active: false, phase: null, current: 0, total: 0, fileName: '' })
    }

    normalizeAndProcess().catch(err => {
      console.error("Error while reading files:", err)
      setLoadProgress({ active: false, phase: null, current: 0, total: 0, fileName: '' })
    })
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return { id: selected, entries: data.entries }
  }, [selected, results])

  const showDate = rawFiles.length > 1

  // ── Empty state ───────────────────────────────────────────────────────────
  if (rawFiles.length === 0) {
    return (
      <div className="app-container min-h-screen flex flex-col bg-primary-dark text-primary"
        style={{ backgroundColor: 'var(--color-primary-dark)' }}>
        <header className="flex items-center justify-between p-6 max-w-[1400px] mx-auto w-full">
          <button onClick={() => window.location.reload()}>
            <img src={import.meta.env.BASE_URL + 'bjornlogo.png'} alt="favicon"
              className="w-56 h-24 rounded-2xl transition-transform duration-200 hover:scale-110" />
          </button>
        </header>
        <main className="flex flex-col items-center justify-center flex-1 w-full px-4">
          <div className="w-full max-w-xl mx-auto mb-6">
            <InterlockSearch
              onSelect={(idOrObj) => {
                if (idOrObj && typeof idOrObj === "object") setSearchInterlock(idOrObj)
                else if (idOrObj && interlockMap[idOrObj]) setSearchInterlock(interlockMap[idOrObj])
                else console.warn("Could not find interlock for id:", idOrObj)
              }}
            />
          </div>
          <div className="w-full px-4">
            <div className="w-full max-w-6xl mx-auto">
              <FilePicker
                onFiles={handleDroppedFiles}
                progress={loadProgress}
                height="50vh"
              />
            </div>
          </div>
        </main>
        {searchInterlock && (
          <InterlockActionsModal interlock={searchInterlock} onClose={() => setSearchInterlock(null)} />
        )}
        {pendingRead && (
          <FailedFilesModal
            failed={pendingRead.failed}
            okCount={pendingRead.ok.length}
            onRetry={handleRetryFailed}
            onSkip={handleSkipFailed}
            onCancel={handleCancelLoad}
          />
        )}
        <AppFooter dark={dark} onToggleDark={() => setDark(d => !d)} />
      </div>
    )
  }

  // ── Main app ──────────────────────────────────────────────────────────────
  return (
    <div className="app-container p-6 max-w-[1400px] mx-auto text-primary"
      style={{ backgroundColor: 'var(--color-primary-dark)' }}>

      <header className="flex items-center justify-between mb-6">
        <button onClick={() => window.location.reload()}>
          <img src={import.meta.env.BASE_URL + 'bjornlogo.png'} alt="favicon"
            className="w-56 h-24 rounded-2xl transition-transform duration-200 hover:scale-110" />
        </button>
        <div style={{ minWidth: 320 }}>
          <FilePicker
            onFiles={handleDroppedFiles}
            progress={loadProgress}
          />
        </div>
      </header>

      <div className="bg-white panel mb-4 border rounded-2xl p-4">

        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold">Selected files:</p>

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
                <TimelineLegendPopover
                  sections={timelineLegend}
                  onClose={() => setShowTimelineLegend(false)}
                />
              )}
            </div>
          )}
        </div>

        <ul className="list-none text-sm mb-6 space-y-3">
          {rawFiles.map((file, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{file}</span>

                {fileMachines[file] && (
                  <span className="text-orange-500 italic font-bold">| {fileMachines[file]}</span>
                )}

                {showTimeline && fileNetwork[file]?.planLoads?.length > 0 && (
                  <span className="text-blue-600 font-semibold">
                    | {fileNetwork[file].planLoads.length} plan{fileNetwork[file].planLoads.length !== 1 ? "s" : ""}
                  </span>
                )}

                {showTimeline && filePowerRawEvents[file]?.length > 0 && (
                  <span className="text-sm text-gray-500 font-semibold">
                    {" | "}
                    {filePowerRawEvents[file]
                      .sort((a, b) => a.time.localeCompare(b.time))
                      .map((e, i) => (
                        <span key={i} className={`mr-2 font-semibold ${e.type === "OFF" ? "text-purple-600" : "text-emerald-600"}`}>
                          {e.type} {e.time}
                        </span>
                      ))}
                  </span>
                )}
              </div>

              {showTimeline && <LostLogBanner windows={lostLogWindows(fileNetwork[file])} />}

              <div className={`timeline-wrapper ${showTimeline ? 'open' : 'closed'}`}>
                <div className="timeline-inner">
                  <DayTimeline
                    downtime={Object.values(fileDowntimeRaw[file] || {}).flat()}
                    systemModes={Object.values(fileSystemModesRaw[file] || {}).flat()}
                    powerEvents={filePowerRaw[file] || []}
                    powerRawEvents={filePowerRawEvents[file] || []}
                    beamEvents={fileBeamEvents[file] || []}
                    machineStates={fileNetwork[file]?.machineStates || []}
                    logins={fileNetwork[file]?.logins || []}
                    faultEvents={fileNetwork[file]?.faultEvents || []}
                    planLoads={fileNetwork[file]?.planLoads || []}
                    dayEnd={fileNetwork[file]?.parkedAt}
                    lastSeen={fileNetwork[file]?.lastSeen}
                    onOpenSessions={() => openEventsModal({ tab: 'session', file })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Analysis stats — grouped with the loaded files (above the action buttons) */}
        <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-xs text-gray-600 mb-5 border-t pt-3">
          <span><span className="font-semibold text-gray-900">{totalLines.toLocaleString()}</span> lines</span>
          <span className="text-gray-400 font-bold text-base leading-none">•</span>
          <span><span className="font-semibold text-gray-900">{matchLines.toLocaleString()}</span> interlocks</span>
          <span className="text-gray-400 font-bold text-base leading-none">•</span>
          <span><span className="font-semibold text-gray-900">{Object.keys(results).length.toLocaleString()}</span> unique interlocks</span>
        </div>

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
            rawLogTexts={rawLogTexts}
            hasDiagnostics={Object.keys(fileNetwork).length > 0}
            onOpenDiagnostics={() => openEventsModal()}
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

      {pendingRead && (
        <FailedFilesModal
          failed={pendingRead.failed}
          okCount={pendingRead.ok.length}
          onRetry={handleRetryFailed}
          onSkip={handleSkipFailed}
          onCancel={handleCancelLoad}
        />
      )}

      {showNetworkModal && (
        <NetworkEventsModal
          fileNetwork={fileNetwork}
          initialTab={networkInitial.tab}
          initialFile={networkInitial.file}
          onClose={() => setShowNetworkModal(false)}
        />
      )}

      <AppFooter dark={dark} onToggleDark={() => setDark(d => !d)} />
    </div>
  )
}