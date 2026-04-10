import React, { useMemo, useState } from "react"
import { getEnergyColor } from "../utils/parser"
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"

function timeToMinutes(t) {
  if (!t) return 0
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function formatMinutes(m) {
  const h   = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

function BeamTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const b = payload[0]?.payload
  if (!b) return null
  return (
    <div style={{ background: "#111", padding: "10px", borderRadius: "8px", color: "#fff", fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: getEnergyColor(b.energy), marginBottom: 4 }}>
        {b.energy}
      </div>
      <div>{b.startTime} → {b.endTime ?? "?"}</div>
      {b.durationSec != null && <div>Duration: {b.durationSec}s</div>}
      {b.pulseCount  != null && <div>Pulses: {b.pulseCount.toLocaleString()}</div>}
      <div>Dose rate: {b.doseRate} MU/min</div>
      {b.machine && <div className="mt-1 opacity-70">{b.machine}</div>}
    </div>
  )
}

function Chip({ label, color }) {
  return (
    <div className={`flex items-center px-3 py-1.5 rounded-full border text-xs font-semibold ${color}`}>
      {label}
    </div>
  )
}

export default function BeamViewer({ beamEventsByFile, fileMachines, onClose }) {
  const [showKV,            setShowKV]            = useState(false)
  const [selectedEnergies,  setSelectedEnergies]  = useState(null) // null = all

  // Flatten all beams, attach machine name
  const allBeams = useMemo(() => {
    const result = []
    for (const [file, beams] of Object.entries(beamEventsByFile || {})) {
      const machine = fileMachines?.[file] ?? file
      for (const b of beams) result.push({ ...b, machine })
    }
    return result
  }, [beamEventsByFile, fileMachines])

  const mvBeams = useMemo(() => allBeams.filter(b => b.isMV),  [allBeams])
  const kvBeams = useMemo(() => allBeams.filter(b => !b.isMV), [allBeams])
  const displayed = showKV ? allBeams : mvBeams

  // All unique energies in current view, sorted with 0k last
  const allEnergies = useMemo(() => {
    const s = new Set(displayed.map(b => b.energy))
    return [...s].sort((a, b) => {
      if (a === "0k") return 1
      if (b === "0k") return -1
      return a.localeCompare(b)
    })
  }, [displayed])

  const activeEnergies = selectedEnergies ?? allEnergies

  const filteredBeams = useMemo(() =>
    displayed.filter(b => activeEnergies.includes(b.energy)),
    [displayed, activeEnergies]
  )

  // Scatter data grouped by energy
  const byEnergy = useMemo(() => {
    const map = {}
    for (const b of filteredBeams) {
      if (b.pulseCount == null) continue
      if (!map[b.energy]) map[b.energy] = []
      map[b.energy].push({ ...b, xMin: timeToMinutes(b.startTime), y: b.pulseCount })
    }
    return map
  }, [filteredBeams])

  const hasScatterData = Object.keys(byEnergy).length > 0

  // Statistics
  const stats = useMemo(() => {
    const energyCount = {}
    let totalDuration = 0, beamsWithDuration = 0, totalPulses = 0

    for (const b of filteredBeams) {
      energyCount[b.energy] = (energyCount[b.energy] ?? 0) + 1
      if (b.durationSec != null) { totalDuration += b.durationSec; beamsWithDuration++ }
      if (b.pulseCount  != null)   totalPulses   += b.pulseCount
    }
    return {
      total: filteredBeams.length,
      mv: mvBeams.length,
      kv: kvBeams.length,
      energyCount,
      totalDuration,
      totalPulses,
    }
  }, [filteredBeams, mvBeams, kvBeams])

  const multiMachine = Object.keys(beamEventsByFile || {}).length > 1

  function toggleEnergy(energy) {
    const current = selectedEnergies ?? allEnergies
    if (current.includes(energy) && current.length === 1) {
      setSelectedEnergies(null)
      return
    }
    if (current.includes(energy)) {
      setSelectedEnergies(current.filter(e => e !== energy))
    } else {
      setSelectedEnergies([...current, energy])
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full p-6 relative flex flex-col"
        style={{ maxWidth: 1000, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Beam Activity</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {stats.mv} MV beams · {stats.kv} kV imaging events
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pr-1">

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Chip label={`${stats.total} beams shown`}      color="bg-blue-100 text-blue-700 border-blue-300" />
            <Chip label={`${stats.mv} MV`}                  color="bg-indigo-100 text-indigo-700 border-indigo-300" />
            <Chip label={`${stats.kv} kV`}                  color="bg-gray-100 text-gray-600 border-gray-300" />
            {stats.totalDuration > 0 && (
              <Chip label={`${Math.round(stats.totalDuration / 60)} min beam-on`} color="bg-green-100 text-green-700 border-green-300" />
            )}
            {stats.totalPulses > 0 && (
              <Chip label={`${stats.totalPulses.toLocaleString()} total pulses`}  color="bg-purple-100 text-purple-700 border-purple-300" />
            )}
          </div>

          {/* Energy filter buttons – generated dynamically */}
          <div className="flex flex-wrap gap-2 mb-5">
            {allEnergies.map(energy => {
              const count  = stats.energyCount[energy] ?? 0
              const active = activeEnergies.includes(energy)
              const color  = getEnergyColor(energy)
              return (
                <button
                  key={energy}
                  onClick={() => toggleEnergy(energy)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold transition-opacity ${active ? "opacity-100" : "opacity-35"}`}
                  style={{ borderColor: color, color }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  {energy} ({count})
                </button>
              )
            })}
            <button
              onClick={() => setShowKV(v => !v)}
              className={`px-3 py-1.5 rounded-full border text-sm font-semibold transition-colors ${
                showKV ? "bg-gray-200 border-gray-400 text-gray-700" : "bg-gray-50 border-gray-300 text-gray-400"
              }`}
            >
              {showKV ? "Hide kV" : "Show kV"}
            </button>
          </div>

          {/* Scatter chart */}
          {hasScatterData ? (
            <div className="mb-6">
              <p className="text-xs text-gray-400 mb-1">
                X = time of day · Y = pulse count (relative MU) · hover for details
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 10, right: 30, bottom: 24, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="xMin"
                    type="number"
                    domain={[0, 1440]}
                    tickCount={13}
                    tickFormatter={formatMinutes}
                    label={{ value: "Time of day", position: "insideBottom", offset: -12, fontSize: 11 }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    label={{ value: "Pulse count", angle: -90, position: "insideLeft", fontSize: 11 }}
                  />
                  <Tooltip content={<BeamTooltip />} />
                  {Object.entries(byEnergy).map(([energy, points]) => (
                    <Scatter
                      key={energy}
                      name={energy}
                      data={points}
                      fill={getEnergyColor(energy)}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-28 text-gray-400 text-sm mb-6 border rounded-xl bg-gray-50">
              No beams with pulse count data available
            </div>
          )}

          {/* Beam table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-left">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Energy</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Pulses</th>
                  <th className="px-3 py-2">Dose rate</th>
                  {multiMachine && <th className="px-3 py-2">Machine</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredBeams.map((b, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-mono">
                      {b.startTime}{b.endTime ? `–${b.endTime}` : ""}
                    </td>
                    <td className="px-3 py-1.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-white text-[10px] font-bold"
                        style={{ backgroundColor: getEnergyColor(b.energy) }}
                      >
                        {b.energy}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {b.durationSec != null ? `${b.durationSec}s` : "–"}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {b.pulseCount != null ? b.pulseCount.toLocaleString() : "–"}
                    </td>
                    <td className="px-3 py-1.5 text-gray-600">
                      {b.doseRate > 0 ? `${b.doseRate} MU/min` : "–"}
                    </td>
                    {multiMachine && (
                      <td className="px-3 py-1.5 text-gray-500">{b.machine}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  )
}