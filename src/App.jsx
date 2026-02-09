import React, {useState, useMemo, useEffect, useCallback} from 'react'

import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import DayTimeline from './components/DayTimeline'
import { parseLogText } from './utils/parser'
import './theme.css'
import InterlockSearch from "./components/InterlockSearch"
import InterlockActionsModal from "./components/InterlockActionsModal"
import { interlockMap } from './utils/interlockLookup'


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
  const [searchInterlock, setSearchInterlock] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false)


  // 🆕 Trend / AVG analyse
  const [trendData, setTrendData] = useState({})
  // 🆕 maskinstans
  const [fileDowntimeRaw, setFileDowntimeRaw] = useState({})
  // 🆕 SYSTEM MODES
  const [fileSystemModesRaw, setFileSystemModesRaw] = useState({})

  const meta = {
    fileCount: rawFiles.length,
    totalLines,
    matchLines
  }

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

    return {
      count,
      minutes: Math.round(minutes)
    }
  }

  const uniqueMachineNames = useMemo(() => {
  return new Set(Object.values(fileMachines)).size
}, [fileMachines])

const showMachineName = uniqueMachineNames > 1


  // ---------------------------------------------------------
  // GLOBAL DROP-HÅNDTERING
  // ---------------------------------------------------------
  const handleDroppedFiles = useCallback(async (fileList) => {
    const fileObjs = await Promise.all(
      Array.from(fileList).map(f =>
        f.text().then(txt => ({
          name: f.name,
          text: txt
        }))
      )
    )
    handleFiles(fileObjs)
  }, [])

  useEffect(() => {
    const preventDefaults = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    const handleDrop = (e) => {
      preventDefaults(e)
      if (e.dataTransfer.files?.length > 0) {
        handleDroppedFiles(e.dataTransfer.files)
      }
    }

    window.addEventListener('dragover', preventDefaults)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragover', preventDefaults)
      window.removeEventListener('drop', handleDrop)
    }
  }, [handleDroppedFiles])

  // ---------------------------------------------------------
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
      const systemModesRaw = {}
      const combinedTrendData = {}


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

        if (machineName) {
          machines[f.name] = machineName
        }

        if (trendData) {
          Object.entries(trendData).forEach(([param, points]) => {
            if (!combinedTrendData[param]) {
              combinedTrendData[param] = []
            }
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
          if (!combinedResults[id]) {
            combinedResults[id] = { entries: [], total: 0 }
          }

          combinedResults[id].total += data.total

          for (const e of data.entries) {
            newInterlocks.push({
              id,
              type: e.Type,
              description: e.description,
              times: e.Times,
              Dates: e.Dates || [],
              file: f.name
            })

            let found = false
            for (const ex of combinedResults[id].entries) {
              if (ex.description === e.description && ex.Type === e.Type) {
                ex.Times = ex.Times.concat(e.Times)
                ex.Dates = ex.Dates
                  ? ex.Dates.concat(e.Dates || [])
                  : (e.Dates || [])
                found = true
                break
              }
            }

            if (!found) {
              combinedResults[id].entries.push({
                ...e,
                file: f.name
              })
            }
          }
        }
      }

      // sorter kronologisk (VELDIG viktig)
      Object.values(combinedTrendData).forEach(arr =>
        arr.sort((a, b) => a.timestamp - b.timestamp)
      )


      setTrendData(combinedTrendData);

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
    }

    normalizeAndProcess().catch(err =>
      console.error("Error while reading files:", err)
    )
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return {
      id: selected,
      entries: data.entries
    }
  }, [selected, results])

  const showDate = rawFiles.length > 1

  // ---------------------------------------------------------
  // STOR FilePicker (ingen filer)
  // ---------------------------------------------------------
if (rawFiles.length === 0) {
  return (
    <div
      className="app-container min-h-screen flex flex-col bg-primary-dark text-primary"
      style={{ backgroundColor: 'var(--color-primary-dark)' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between p-6 max-w-[1400px] mx-auto w-full">
        <img
          src="/interlock-web/bjornlogo.png"
          alt="favicon"
          className="w-56 h-24 rounded-2xl"
        />
      </header>

      {/* Main content */}
      <main className="flex flex-col items-center justify-center flex-1 w-full px-4">
        {/* Søkerfelt */}
        <div className="w-full max-w-xl mx-auto mb-6">
        <InterlockSearch
          onSelect={(idOrObj) => {
            // Hvis onSelect sender hele objektet:
            if (idOrObj && typeof idOrObj === "object") {
              setSearchInterlock(idOrObj);
            } else if (idOrObj && interlockMap[idOrObj]) {
              setSearchInterlock(interlockMap[idOrObj]);
            } else {
              console.warn("Could not find interlock for id:", idOrObj);
            }
          }}
        />

        </div>

        {/* Filvelger */}
        <div className="w-full px-4">
          <div className="w-full max-w-6xl mx-auto">
            <FilePicker onFiles={handleDroppedFiles} height="50vh" />
          </div>
        </div>
      </main>

      {/* Modal for interlock */}
      {searchInterlock && (
        <InterlockActionsModal
          interlock={searchInterlock}
          onClose={() => setSearchInterlock(null)}
        />
      )}
    </div>
  );
}


  // ---------------------------------------------------------
  // NORMAL APP
  // ---------------------------------------------------------
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
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold">Selected files:</p>
        </div>

        <ul className="list-none text-sm mb-6 space-y-3">
          {rawFiles.map((file, i) => (
            <li key={i}>
              {/* ÉN LINJE: fil + maskin + stans */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{file}</span>

                {fileMachines[file] && (
                  <span className="text-orange-500 italic font-bold">
                    | {fileMachines[file]}
                  </span>
                )}

                {showTimeline && fileDowntime[file] && (
                  <span className="text-red-600 font-semibold">
                    | {fileDowntime[file].count} halt (
                    {fileDowntime[file].minutes} min)
                  </span>
                )}
              </div>

              <div
                className={`timeline-wrapper ${
                  showTimeline ? 'open' : 'closed'
                }`}
              >
                <div className="timeline-inner">
                  <DayTimeline
                    downtime={Object.values(fileDowntimeRaw[file] || {}).flat()}
                    systemModes={Object.values(fileSystemModesRaw[file] || {}).flat()}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>



        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          {/* Venstre: StatsBar */}
          <StatsBar
            totalLines={totalLines}
            matches={matchLines}
            uniqueCount={Object.keys(results).length}
            recentInterlocks={recentInterlocks}
            trendData={trendData}
            showTimeline={showTimeline}
            setShowTimeline={setShowTimeline}
          />


          {/* Høyre: Søkefelt */}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search (ID, Type or Description)"
            className="px-4 py-3 rounded-2xl w-80 border border-gray-400"
          />
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel rounded-lg p-2">
          <InterlockTable
            results={results}
            onSelect={setSelected}
            query={query}
          />
        </div>

        <div className="panel rounded-lg p-2">
          <DetailTable data={selectedData} showDate={showDate} fileMachines={fileMachines} showMachineName={showMachineName} />
        </div>
      </div>
        {searchInterlock && (
        <InterlockActionsModal
          interlock={searchInterlock}
          onClose={() => setSearchInterlock(null)}
        />
      )}
    </div>
  )
}
