import React from "react"
import { getEnergyColor } from "../utils/parser"

// Known mode colours. Any mode not in this map gets a hash-based colour
// from MODE_PALETTE, so future Varian modes always render visibly.
const MODE_COLORS = {
  SERVICE:  "#C57A1C", // brown/orange
  CLINICAL: "#3b82f6", // blue
  QA:       "#eab308", // yellow
  SMC:      "#ec4899", // pink  (Safe Mode Control – service/troubleshooting)
}

const MODE_PALETTE = [
  "#0891b2", "#15803d", "#7c3aed",
  "#c2410c", "#0f766e", "#4f46e5", "#b45309",
]

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function getModeColor(mode) {
  return MODE_COLORS[mode] ?? MODE_PALETTE[hashString(mode) % MODE_PALETTE.length]
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function timeToSeconds(t) {
  const [h, m, s = 0] = t.split(":").map(Number)
  return h * 3600 + m * 60 + s
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

export default function DayTimeline({
  downtime       = [],
  systemModes    = [],
  powerRawEvents = [],
  beamEvents     = [],
}) {
  const DAY_SEC     = 24 * 3600
  const DAY_MINUTES = 24 * 60

  const toPctMin = (min) =>
    `${(clamp(min, 0, DAY_MINUTES) / DAY_MINUTES) * 100}%`

  const toPctSec = (sec) =>
    `${(clamp(sec, 0, DAY_SEC) / DAY_SEC) * 100}%`

  const validBeams = beamEvents.filter(b => b.startTime)
  const mvBeams    = validBeams.filter(b => b.isMV)
  const kvBeams    = validBeams.filter(b => !b.isMV)

  return (
    <div className="w-full relative select-none">

      {/* === TIME TICKS === */}
      <div className="relative h-5 mb-1 text-[10px] text-gray-500">
        {[0, 6, 12, 18, 24].map((h) => {
          const isFirst = h === 0
          const isLast  = h === 24
          return (
            <div key={h}
              className={`absolute ${isFirst ? "translate-x-0" : isLast ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          )
        })}
      </div>

      {/* === MAIN TIMELINE BAR === */}
      <div className="relative h-12 rounded-full overflow-hidden bg-gray-300 z-0">

        {/* Layer 1 – default background (gray = no active mode) */}
        <div className="absolute top-0 bottom-0"
          style={{ left: 0, width: "100%", backgroundColor: "#9ca3af", zIndex: 1 }} />

        {/* Layer 3 – system modes */}
        {systemModes.map((m, i) => {
          const startMin    = timeToMinutes(m.start)
          const endMin      = timeToMinutes(m.end)
          const durationMin = Math.max(0.5, endMin - startMin)
          return (
            <div key={`mode-${i}`} className="absolute top-0 bottom-0"
              style={{
                left: toPctMin(startMin),
                width: toPctMin(durationMin),
                backgroundColor: getModeColor(m.mode),
                zIndex: 3,
              }}
              title={`${m.mode} ${m.start}–${m.end}`}
            />
          )
        })}

        {/* Layer 4 – downtime */}
        {downtime.map((d, i) => {
          const startMin    = timeToMinutes(d.start)
          const endMin      = timeToMinutes(d.end)
          const durationMin = Math.max(0.5, endMin - startMin)
          return (
            <div key={`down-${i}`} className="absolute top-0 bottom-0"
              style={{
                left: toPctMin(startMin),
                width: toPctMin(durationMin),
                backgroundColor: "#dc2626",
                zIndex: 4,
              }}
              title={`⛔ ${d.start}–${d.end}\nInterlocks:\n${(d.interlocks || []).join("\n")}`}
            />
          )
        })}

        {/* Layer 5 – power event markers */}
        {powerRawEvents.map((e, i) => {
          const min   = timeToMinutes(e.time)
          const isOff = e.type === "OFF"
          return (
            <div key={`power-${i}`}
              style={{
                position: "absolute",
                left: toPctMin(min),
                transform: "translateX(-50%)",
                width: "4px",
                top: isOff ? "0%" : "50%",
                height: "50%",
                backgroundColor: isOff ? "#7c3aed" : "#4EDFAF",
                border: "1px solid rgba(0,0,0,0.6)",
                zIndex: 5,
                boxShadow: isOff
                  ? "0 0 8px #7c3aed, 0 0 12px #7c3aed"
                  : "0 0 8px #4EDFAF, 0 0 12px #4EDFAF",
              }}
              title={`🔌 Power ${e.type} ${e.time}`}
            />
          )
        })}
      </div>

      {/* === BEAM ROWS === */}
      {validBeams.length > 0 && (
        <div className="mt-1.5 space-y-1">

          {mvBeams.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-5 shrink-0 text-right">MV</span>
              <div className="relative flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                {mvBeams.map((b, i) => {
                  const startSec    = timeToSeconds(b.startTime)
                  const durationSec = Math.max(b.durationSec ?? 20, DAY_SEC / 800)
                  return (
                    <div key={`mv-${i}`}
                      className="absolute top-0 bottom-0"
                      style={{
                        left: toPctSec(startSec),
                        width: `max(3px, ${toPctSec(durationSec)})`,
                        backgroundColor: getEnergyColor(b.energy),
                        zIndex: 2,
                      }}
                      title={[
                        `⚡ ${b.energy}`,
                        `${b.startTime} → ${b.endTime ?? "?"}`,
                        b.durationSec != null ? `${b.durationSec}s` : null,
                        b.pulseCount  != null ? `${b.pulseCount} pulses` : null,
                        `${b.doseRate} MU/min`,
                      ].filter(Boolean).join("  |  ")}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {kvBeams.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-400 w-5 shrink-0 text-right">kV</span>
              <div className="relative flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
                {kvBeams.map((b, i) => (
                  <div key={`kv-${i}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: toPctSec(timeToSeconds(b.startTime)),
                      width: "max(3px, 0.15%)",
                      backgroundColor: "#64748b",
                      zIndex: 2,
                      opacity: 0.7,
                    }}
                    title={`📷 kV imaging ${b.startTime}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}