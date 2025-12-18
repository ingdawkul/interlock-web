import React, { useState, useMemo, useEffect, useCallback } from 'react'
import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import RecentInterlocks from './components/RecentInterlocks'
import { parseLogText } from './utils/parser'
import "./theme.css";

export default function App() {
  const [rawFiles, setRawFiles] = useState([])
  const [results, setResults] = useState({})
  const [totalLines, setTotalLines] = useState(0)
  const [matchLines, setMatchLines] = useState(0)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [recentInterlocks, setRecentInterlocks] = useState([])
  const [fileMachines, setFileMachines] = useState({})   // ✅ NY

  const meta = { fileCount: rawFiles.length, totalLines, matchLines }

  // ---------------------------------------------------------
  // GLOBAL DROP-HÅNDTERING
  // ---------------------------------------------------------
  const handleDroppedFiles = useCallback(async (fileList) => {
    const fileObjs = await Promise.all(
      Array.from(fileList).map(f =>
        f.text().then(txt => ({ name: f.name, text: txt }))
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
      e.preventDefault()
      e.stopPropagation()
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

      setRawFiles(arr.map(f => f.name))

      let combinedResults = {}
      let total = 0
      let matches = 0
      const newInterlocks = []
      const machines = {}            // ✅ NY

      for (const f of arr) {
        const {
          results: r,
          totalLines: t,
          matchLines: m,
          machineName               // ✅ NY
        } = parseLogText(f.text)

        total += t
        matches += m

        if (machineName) {
          machines[f.name] = machineName
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

            if (!found) combinedResults[id].entries.push({ ...e })
          }
        }
      }

      const sortedRecent = newInterlocks.sort((a, b) => {
        const lastA = a.times[a.times.length - 1]
        const lastB = b.times?.[b.times.length - 1]
        const dateA = lastA ? new Date(`1970-01-01T${lastA}`) : new Date(0)
        const dateB = lastB ? new Date(`1970-01-01T${lastB}`) : new Date(0)
        return dateB - dateA
      })

      setResults(combinedResults)
      setFileMachines(machines)     // ✅ NY
      setTotalLines(total)
      setMatchLines(matches)
      setRecentInterlocks(sortedRecent)
      setSelected(null)
    }

    normalizeAndProcess().catch(err =>
      console.error("Feil ved lesing av filer:", err)
    )
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return { id: selected, entries: data.entries }
  }, [selected, results])

  const showDate = rawFiles.length > 1

  // ---------------------------------------------------------
  // STOR FilePicker (ingen filer)
  // ---------------------------------------------------------
  if (!rawFiles || rawFiles.length === 0) {
    return (
      <div
        className="app-container p-6 max-w-[1400px] mx-auto text-primary"
        style={{ backgroundColor: "var(--color-primary-dark)" }}
      >
        <header className="flex items-center justify-between mb-6">
          <img
            src="/interlock-web/bjorn.png"
            alt="favicon"
            className="w-48 h-20 rounded-2xl"
          />
        </header>

        <main
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 96px)", padding: "1rem" }}
        >
          <div className="w-full h-full flex items-center justify-center">
            <div style={{ width: "100%" }}>
              <FilePicker onFiles={handleDroppedFiles} height="50vh" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------
  // NORMAL APP
  // ---------------------------------------------------------
  return (
    <div
      className="app-container p-6 max-w-[1400px] mx-auto text-primary"
      style={{ backgroundColor: "var(--color-primary-dark)" }}
    >
      <header className="flex items-center justify-between mb-6">
        <button onClick={() => window.location.reload()}>
          <img
            src={import.meta.env.BASE_URL + "bjorn.png"}
            alt="favicon"
            className="w-48 h-20 rounded-2xl"
          />
        </button>

        <div style={{ minWidth: 320 }}>
          <FilePicker onFiles={handleDroppedFiles} />
        </div>
      </header>

      {/* Valgte filer + stats */}
      <div className="bg-white panel mb-4 border rounded-2xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-semibold">Valgte filer:</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk (ID, Type eller Beskrivelse)"
            className="px-4 py-3 rounded-2xl min-w-96 border border-gray-400"
          />
        </div>

        <ul className="list-disc list-inside text-sm mb-6">
          {rawFiles.map((file, i) => (
            <li key={i}>
              {file}
              {fileMachines[file] && (
                <span className="ml-2 text-orange-500 italic font-bold">
                  ➡️ {fileMachines[file]}
                </span>
              )}
            </li>
          ))}
        </ul>

        <StatsBar
          totalLines={totalLines}
          matches={matchLines}
          uniqueCount={Object.keys(results).length}
          recentInterlocks={recentInterlocks}
        />
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
          <DetailTable data={selectedData} showDate={showDate} />
        </div>
      </div>
    </div>
  )
}
