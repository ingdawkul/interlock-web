import React from "react"
import { getEnergyColor } from "../utils/parser"

const MODE_COLORS = {
  SERVICE:  "#C57A1C",
  CLINICAL: "#3b82f6",
  QA:       "#eab308",
  SMC:      "#ec4899",
}
 
const MODE_PALETTE = [
  "#0891b2",
  "#15803d",
  "#7c3aed",
  "#c2410c",
  "#0f766e",
  "#4f46e5",
  "#b45309",
  "#0e7490",
  "#166534",
  "#6d28d9",
]

function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getModeColor(mode) {
  return MODE_COLORS[mode] ?? MODE_PALETTE[hashString(mode) % MODE_PALETTE.length]
}

// Single coordinate system: seconds from midnight (0–86400)
const DAY_SEC = 86400

function toSec(t) {
  const [h, m, s = 0] = t.split(":").map(Number)
  return h * 3600 + m * 60 + s
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function toPct(sec) {
  return `${(clamp(sec, 0, DAY_SEC) / DAY_SEC) * 100}%`
}

function durationPct(startSec, endSec) {
  const dur = Math.max(0, endSec - startSec)
  return `max(3px, ${(dur / DAY_SEC) * 100}%)`
}

export default function DayTimeline({
  downtime       = [],
  systemModes    = [],
  powerRawEvents = [],
  beamEvents     = [],
}) {
  const validBeams = beamEvents.filter(b => b.startTime)
  const mvBeams    = validBeams.filter(b => b.isMV)
  const kvBeams    = validBeams.filter(b => !b.isMV)

  const hasMV = mvBeams.length > 0
  const hasKV = kvBeams.length > 0

  return (
    <div className="w-full relative select-none">

      {/* ── Time ticks ──────────────────────────────────────────────────────── */}
      {/*
          The tick row must be offset by the same label width used in the beam
          rows so all ticks line up with the bars below them.
          Label col = 28px (w-7). When no beams exist the offset is 0.
      */}
      <div className="flex mb-1">
        {(hasMV || hasKV) && <div style={{ width: 28, flexShrink: 0 }} />}
        <div className="relative flex-1 h-5 text-[10px] text-gray-500">
          {[0, 6, 12, 18, 24].map((h) => {
            const isFirst = h === 0
            const isLast  = h === 24
            return (
              <div
                key={h}
                className={`absolute ${
                  isFirst ? "translate-x-0" : isLast ? "-translate-x-full" : "-translate-x-1/2"
                }`}
                style={{ left: `${(h / 24) * 100}%` }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Main timeline bar + beam rows, all sharing the same left edge ─── */}
      <div className="flex flex-col gap-1">

        {/* Main bar row — no label, so it fills full width when beams exist */}
        <div className="flex">
          {(hasMV || hasKV) && <div style={{ width: 28, flexShrink: 0 }} />}
          <div className="relative flex-1 h-12 rounded-full overflow-hidden bg-gray-300">

            {/* Gray base */}
            <div className="absolute inset-0" style={{ backgroundColor: "#9ca3af", zIndex: 1 }} />

            {/* System modes */}
            {systemModes.map((m, i) => {
              const start = toSec(m.start)
              const end   = toSec(m.end)
              return (
                <div key={`mode-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left:  toPct(start),
                    width: durationPct(start, end),
                    backgroundColor: getModeColor(m.mode),
                    zIndex: 3,
                  }}
                  title={`${m.mode} ${m.start}–${m.end}`}
                />
              )
            })}

            {/* Downtime */}
            {downtime.map((d, i) => {
              const start = toSec(d.start)
              const end   = toSec(d.end)
              return (
                <div key={`down-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left:  toPct(start),
                    width: durationPct(start, end),
                    backgroundColor: "#dc2626",
                    zIndex: 4,
                  }}
                  title={`⛔ ${d.start}–${d.end}\nInterlocks:\n${(d.interlocks || []).join("\n")}`}
                />
              )
            })}

            {/* Power markers */}
            {powerRawEvents.map((e, i) => {
              const sec   = toSec(e.time)
              const isOff = e.type === "OFF"
              return (
                <div key={`power-${i}`}
                  style={{
                    position: "absolute",
                    left:      toPct(sec),
                    transform: "translateX(-50%)",
                    width:     "4px",
                    top:       isOff ? "0%" : "50%",
                    height:    "50%",
                    backgroundColor: isOff ? "#7c3aed" : "#4EDFAF",
                    border:    "1px solid rgba(0,0,0,0.6)",
                    zIndex:    5,
                    boxShadow: isOff
                      ? "0 0 8px #7c3aed, 0 0 12px #7c3aed"
                      : "0 0 8px #4EDFAF, 0 0 12px #4EDFAF",
                  }}
                  title={`🔌 Power ${e.type} ${e.time}`}
                />
              )
            })}
          </div>
        </div>

        {/* MV beam row */}
        {hasMV && (
          <div className="flex items-center">
            <span
              className="text-[9px] text-gray-400 text-right shrink-0"
              style={{ width: 28 }}
            >
              MV
            </span>
            <div className="relative flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
              {mvBeams.map((b, i) => {
                const start = toSec(b.startTime)
                const dur   = Math.max(b.durationSec ?? 20, DAY_SEC / 800)
                return (
                  <div key={`mv-${i}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left:  toPct(start),
                      width: `max(3px, ${(dur / DAY_SEC) * 100}%)`,
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

        {/* kV imaging row */}
        {hasKV && (
          <div className="flex items-center">
            <span
              className="text-[9px] text-gray-400 text-right shrink-0"
              style={{ width: 28 }}
            >
              kV
            </span>
            <div className="relative flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
              {kvBeams.map((b, i) => (
                <div key={`kv-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left:            toPct(toSec(b.startTime)),
                    width:           "max(3px, 0.15%)",
                    backgroundColor: "#64748b",
                    zIndex:          2,
                    opacity:         0.7,
                  }}
                  title={`📷 kV imaging ${b.startTime}`}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}