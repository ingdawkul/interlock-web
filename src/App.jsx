import React, { useState, useMemo, useEffect, useCallback } from 'react'
import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import ExportButtons from './components/ExportButtons'
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

  const meta = { fileCount: rawFiles.length, totalLines, matchLines }

  // ---------------------------------------------------------
  // GLOBAL DROP-HÅNDTERING (fungerer uansett skjermmodus)
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
    // `files` forventes å være et array av { name, text } (som handleDroppedFiles sender),
    // eller et FileList / Array<File> fra FilePicker (hvor FilePicker sender File objects).
    // Vi normaliserer begge tilfeller: hvis element har `text` bruker vi det, ellers leser med .text()
    const normalizeAndProcess = async () => {
      const arr = await Promise.all(Array.from(files).map(async (f) => {
        if (f && typeof f.text === 'function' && f.name && !('text' in f)) {
          // File object fra input/drop — konverter til { name, text }
          const txt = await f.text();
          return { name: f.name, text: txt };
        }
        // Hvis allerede i format { name, text }
        return f;
      }));

      setRawFiles(arr.map(f => f.name))

      let combinedResults = {}
      let total = 0
      let matches = 0
      const newInterlocks = []

      for (const f of arr) {
        const { results: r, totalLines: t, matchLines: m } = parseLogText(f.text)
        total += t
        matches += m

        for (const [id, data] of Object.entries(r)) {
          if (!combinedResults[id]) combinedResults[id] = { entries: [], total: 0 }

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
                ex.Dates = ex.Dates ? ex.Dates.concat(e.Dates || []) : (e.Dates || [])
                found = true
                break
              }
            }

            if (!found) combinedResults[id].entries.push({ ...e })
          }
        }
      }

      setResults(combinedResults)
      setTotalLines(total)
      setMatchLines(matches)
      setSelected(null)

      // Sorter recent interlocks
      const sortedRecent = newInterlocks.sort((a, b) => {
        const lastA = a.times[a.times.length - 1]
        const lastB = b.times?.[b.times.length - 1]
        // safer date parse (time-only)
        const dateA = lastA ? new Date(`1970-01-01T${lastA}`) : new Date(0)
        const dateB = lastB ? new Date(`1970-01-01T${lastB}`) : new Date(0)
        return dateB - dateA
      })

      setRecentInterlocks(sortedRecent)
    }

    normalizeAndProcess().catch(err => {
      console.error("Feil ved lesing av filer:", err)
    })
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return { id: selected, entries: data.entries }
  }, [selected, results])

  const showDate = rawFiles.length > 1

  // ------------------------------
  // Render: dersom ingen filer er lastet, vis stor FilePicker-skjerm
  // ellers vis vanlig app-layout med liten FilePicker
  // ------------------------------
  if (!rawFiles || rawFiles.length === 0) {
    return (
       <div className="app-container p-6 max-w-[1400px] mx-auto text-primary" style={{ backgroundColor: "var(--color-primary-dark)" }}>
        {/* Header med logo */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
          <img
            src="/interlock-web/bjorn.png"
            alt="favicon"
            className="w-48 h-20 rounded-2xl"
          />
        </h1>
      </header>

        {/* Drop/velg-område begrenset til container */}
        <main
          className="flex items-center justify-center"
          style={{ minHeight: "calc(100vh - 96px)", padding: "1rem" }}
        >
          <div
            className="w-full h-full rounded-lg flex items-center justify-center"
          >
            <div style={{ width: "100%" }}>
              <FilePicker onFiles={handleDroppedFiles} height="50vh" />
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ------------------------------
  // Når filer er handlet inn: normal appvisning (med liten FilePicker i toppen)
  // ------------------------------
  return (
    <div className="app-container p-6 max-w-[1400px] mx-auto text-primary" style={{ backgroundColor: "var(--color-primary-dark)" }}>
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-primary">
          <img
            src="/interlock-web/bjorn.png"
            alt="favicon"
            className="w-48 h-20 rounded-2xl"
          />
        </h1>

        {/* Liten FilePicker og søk/eksport oppe i header-området */}
        <div className="flex items-center gap-4">
          <div style={{ minWidth: 320 }}>
            <FilePicker onFiles={handleDroppedFiles} />
          </div>
        </div>
      </header>

      {/* Valgte filer + stats */}
{rawFiles.length > 0 && (
  <div className="bg-white panel mb-4 border rounded-2xl p-4">
    {/* Topp-linje med valgte filer til venstre og søkefelt til høyre */}
    <div className="flex justify-between items-center mb-2">
      <p className="font-semibold">Valgte filer:</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Søk (ID, Type eller Beskrivelse)"
        className="px-4 py-3 rounded-2xl p-4 min-w-96 border border-gray-400 focus:border-gray-600 focus:ring-1 focus:ring-gray-600 outline-none"
      />
    </div>

    <ul className="list-disc list-inside text-sm mb-6">
      {rawFiles.map((file, i) => (
        <li key={i}>{file}</li>
      ))}
    </ul>

    <div className="mt-6">
      <StatsBar
        totalLines={totalLines}
        matches={matchLines}
        uniqueCount={Object.keys(results).length}
      />
    </div>
  </div>
)}

      <div className="mb-6 max-h-64 overflow-y-auto panel">
        <RecentInterlocks interlocks={recentInterlocks} />
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

      <footer className="mt-8 text-xs text-secondary panel"></footer>
    </div>
  )
}
