import React, { useState, useMemo } from 'react'
import FilePicker from './components/FilePicker'
import StatsBar from './components/StatsBar'
import InterlockTable from './components/InterlockTable'
import DetailTable from './components/DetailTable'
import ExportButtons from './components/ExportButtons'
import RecentInterlocks from './components/RecentInterlocks'
import { parseLogText } from './utils/parser'

export default function App() {
  const [rawFiles, setRawFiles] = useState([])
  const [results, setResults] = useState({})
  const [totalLines, setTotalLines] = useState(0)
  const [matchLines, setMatchLines] = useState(0)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [recentInterlocks, setRecentInterlocks] = useState([])

  const meta = { fileCount: rawFiles.length, totalLines, matchLines }

  const handleFiles = (files) => {
    setRawFiles(files.map(f => f.name))
    let combinedResults = {}
    let total = 0
    let matches = 0
    const newInterlocks = []

    for (const f of files) {
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
            Dates: e.Dates || [], // Husk datoer fra parser
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

    // Sorter interlocks etter siste tidspunkt
    const sortedRecent = newInterlocks.sort((a, b) => {
      const lastA = a.times[a.times.length - 1]
      const lastB = b.times[b.times.length - 1]
      return new Date(lastB) - new Date(lastA)
    })
    setRecentInterlocks(sortedRecent)
  }

  const selectedData = useMemo(() => {
    if (!selected) return null
    const data = results[selected]
    if (!data) return null
    return { id: selected, entries: data.entries }
  }, [selected, results])

  // **Definer showDate basert på antall valgte filer**
  const showDate = rawFiles.length > 1

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Interlock Analyzer</h1>
      </header>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <FilePicker onFiles={handleFiles} />
        <div className="flex gap-2 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Søk (ID, Type eller Beskrivelse)"
            className="px-3 py-2 border rounded w-72"
          />
          <ExportButtons results={results} meta={meta} />
        </div>
      </div>

      {/* Viser valgte filer */}
      {rawFiles.length > 0 && (
        <div className="mb-4 bg-white border rounded-lg p-3">
          <p className="font-semibold mb-1">Valgte filer:</p>
          <ul className="list-disc list-inside text-sm">
            {rawFiles.map((file, i) => (
              <li key={i}>{file}</li>
            ))}
          </ul>
          <div className="mb-4">
            <StatsBar
              totalLines={totalLines}
              matches={matchLines}
              uniqueCount={Object.keys(results).length}
            />
          </div>
        </div>
      )}

      <div className="mb-6 max-h-64 overflow-y-auto">
        <RecentInterlocks interlocks={recentInterlocks} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg p-2">
          <InterlockTable results={results} onSelect={setSelected} query={query} />
        </div>

        <div className="bg-white rounded-lg p-2">
          <DetailTable data={selectedData} showDate={showDate} />
        </div>
      </div>

      <footer className="mt-8 text-xs text-gray-500">
        <div></div>
      </footer>
    </div>
  )
}
