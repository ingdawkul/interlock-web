import React, { useState } from "react"
import { getEnergyColor } from "../utils/parser"

// High-contrast, well-separated hues so adjacent mode segments are easy to tell
// apart (previously SERVICE amber and QA yellow looked almost identical).
const MODE_COLORS = {
  CLINICAL: "#2563eb",  // blue
  SERVICE:  "#f97316",  // orange
  QA:       "#7c3aed",  // violet
  SMC:      "#ec4899",  // pink
  PMI:      "#0d9488",  // teal
  INSTALL:  "#475569",  // slate
}

// Any mode we don't have an explicit colour for renders in this neutral tone and
// is grouped under "Other / unknown" in the legend, so nothing is silently missed.
export const OTHER_MODE_COLOR = "#94a3b8"
export const KNOWN_MODES = Object.keys(MODE_COLORS)

export function getModeColor(mode) {
  return MODE_COLORS[mode] ?? OTHER_MODE_COLOR
}

// Stable colour per login-app/user name — shared by the main bar, the session
// strip and the legend so they always agree. Known apps get a fixed, vivid colour
// (no gray/muddy tones); anything else hashes over a gray-free palette.
const APP_COLOR_MAP = {
  "Treatment":           "#2563eb",  // blue
  "Service":             "#ea580c",  // orange
  "Machine QA":          "#16a34a",  // green
  "MPC":                 "#9333ea",  // purple
  "PMI":                 "#0891b2",  // cyan
  "Imager Calibration":  "#db2777",  // pink
  "Adv. Reconstruction": "#ca8a04",  // gold
  "Restart":             "#4f46e5",  // indigo
}
const APP_PALETTE = [
  "#2563eb", "#ea580c", "#16a34a", "#9333ea", "#0891b2", "#db2777",
  "#ca8a04", "#65a30d", "#0d9488", "#c026d3", "#4f46e5", "#f43f5e",
]
export function appColor(name) {
  if (APP_COLOR_MAP[name]) return APP_COLOR_MAP[name]
  let h = 0
  for (let i = 0; i < (name || "").length; i++) h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  return APP_PALETTE[Math.abs(h) % APP_PALETTE.length]
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

function formatHM(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function durationPct(startSec, endSec) {
  const dur = Math.max(0, endSec - startSec)
  return `max(3px, ${(dur / DAY_SEC) * 100}%)`
}

// Machine-state colours (Module 3)
const STATE_COLORS = {
  ON:       "#16a34a",
  STANDBY:  "#d97706",
  POWEROFF: "#dc2626",
}

export default function DayTimeline({
  downtime       = [],
  systemModes    = [],
  powerRawEvents = [],
  beamEvents     = [],
  machineStates  = [],
  logins         = [],
  faultEvents    = [],
  planLoads      = [],
  dayEnd,
  onOpenSessions,
}) {
  const [faultView, setFaultView] = useState("heatmap")   // "heatmap" | "sparkline"

  // End-of-day cap (parked time) — keeps open segments from running to midnight.
  const dayEndSec = dayEnd ? toSec(dayEnd) : DAY_SEC

  const validBeams = beamEvents.filter(b => b.startTime)
  const mvBeams    = validBeams.filter(b => b.isMV)
  const kvBeams    = validBeams.filter(b => !b.isMV)

  const hasMV = mvBeams.length > 0
  const hasKV = kvBeams.length > 0
  const hasState = machineStates.length > 0   // auto-hide row when no transitions
  const hasFaults = faultEvents.length > 0
  const hasLabelCol = hasMV || hasKV || hasState || hasFaults || planLoads.length > 0

  // Main bar = login-app sessions when the machine logs them (newer software);
  // otherwise it falls back to system modes (older software shows what it can).
  const appSessions = logins.filter(l => l.source === "task")
  const sessionSegments = appSessions.map((l, i) => ({
    app:   l.app,
    start: toSec(l.time),
    end:   i + 1 < appSessions.length ? toSec(appSessions[i + 1].time) : dayEndSec,
  }))
  const showSessions = sessionSegments.length > 0
  const hasPlans = planLoads.length > 0

  // ── Fault density bins (96 × 15-min buckets over the day) ─────────────────
  const FAULT_BINS = 96
  const faultBins = (() => {
    if (!hasFaults) return null
    const bins = new Array(FAULT_BINS).fill(0)
    const byBin = {}
    for (const e of faultEvents) {
      const sec = toSec(e.time)
      const idx = clamp(Math.floor((sec / DAY_SEC) * FAULT_BINS), 0, FAULT_BINS - 1)
      bins[idx]++
      ;(byBin[idx] ??= {})[e.id] = (byBin[idx]?.[e.id] || 0) + 1
    }
    const max = Math.max(...bins, 1)
    const binSec = DAY_SEC / FAULT_BINS
    const topIds = (idx) =>
      Object.entries(byBin[idx] || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([id, n]) => `${id}×${n}`).join(", ")
    return { bins, max, binSec, topIds }
  })()

  return (
    <div className="w-full relative select-none">

      {/* ── Time ticks ──────────────────────────────────────────────────────── */}
      {/*
          The tick row must be offset by the same label width used in the beam
          rows so all ticks line up with the bars below them.
          Label col = 28px (w-7). When no beams exist the offset is 0.
      */}
      <div className="flex mb-1">
        {hasLabelCol && <div style={{ width: 28, flexShrink: 0 }} />}
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
          {hasLabelCol && <div style={{ width: 28, flexShrink: 0 }} />}
          <div className="relative flex-1 h-12 rounded-full overflow-hidden bg-gray-300">

            {/* Gray base */}
            <div className="absolute inset-0" style={{ backgroundColor: "#9ca3af", zIndex: 1 }} />

            {/* Main bar: login-app sessions (preferred) or system modes (fallback) */}
            {showSessions
              ? sessionSegments.map((s, i) => (
                  <div key={`sess-${i}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left:  toPct(s.start),
                      width: durationPct(s.start, s.end),
                      backgroundColor: appColor(s.app),
                      zIndex: 3,
                    }}
                    title={`${s.app}  ${formatHM(s.start)}–${formatHM(s.end)}`}
                  />
                ))
              : systemModes.map((m, i) => {
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

            {/* Login markers — only in the mode-fallback case; when the bar already
                shows app sessions the segment boundaries are the logins. */}
            {!showSessions && logins.map((l, i) => (
              <div key={`login-${i}`}
                onClick={onOpenSessions}
                style={{
                  position: "absolute", left: toPct(toSec(l.time)), transform: "translateX(-50%)",
                  top: 0, height: "28%", width: "2px", backgroundColor: "#16a34a",
                  zIndex: 6, cursor: onOpenSessions ? "pointer" : "default",
                }}
                title={`👤 ${l.app} ${l.time}`}
              />
            ))}
          </div>
        </div>

        {/* Machine-state row (Module 3) — raw min-width slivers, auto-hidden when empty */}
        {hasState && (
          <div className="flex items-center">
            <span className="text-[9px] text-gray-400 text-right shrink-0" style={{ width: 28 }}>
              State
            </span>
            <div className="relative flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
              {machineStates.map((s, i) => {
                const start = toSec(s.start)
                const end   = s.end ? toSec(s.end) : dayEndSec
                const cause = s.cause
                  ? `\n${s.cause.category === "power-loop-open" ? "Power loop open" : "Power interlock"}`
                  : ""
                return (
                  <div key={`state-${i}`}
                    className="absolute top-0 bottom-0"
                    style={{
                      left:  toPct(start),
                      width: durationPct(start, end),
                      backgroundColor: STATE_COLORS[s.state] ?? "#9ca3af",
                      zIndex: 2,
                    }}
                    title={`${s.state}  ${s.start}–${s.end ?? "?"}${cause}`}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* Plan-loads row (under State) — one marker per plan load */}
        {hasPlans && (
          <div className="flex items-center">
            <span className="text-[9px] text-gray-400 text-right shrink-0" style={{ width: 28 }}>
              Plans
            </span>
            <div className="relative flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
              {planLoads.map((p, i) => (
                <div key={`plan-${i}`}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: toPct(toSec(p.time)), transform: "translateX(-50%)",
                    width: "3px", backgroundColor: "#2563eb", zIndex: 2,
                  }}
                  title={`📄 Plan loaded ${p.time}${p.planUid ? ` · …${p.planUid.slice(-10)}` : ""}`}
                />
              ))}
            </div>
          </div>
        )}

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

        {/* Faults row — click toggles heatmap ⇄ sparkline (Module 6 / corrections) */}
        {hasFaults && faultBins && (
          <div className="flex items-center">
            <span className="text-[9px] text-gray-400 text-right shrink-0" style={{ width: 28 }}>
              Faults
            </span>
            <div
              onClick={() => setFaultView(v => (v === "heatmap" ? "sparkline" : "heatmap"))}
              title={`${faultEvents.length} fault events · click to switch to ${faultView === "heatmap" ? "sparkline" : "heatmap"}`}
              className="relative flex-1 rounded-md bg-gray-100 overflow-hidden cursor-pointer"
              style={{ height: faultView === "sparkline" ? 56 : 14 }}
            >
              {faultView === "heatmap" ? (
                faultBins.bins.map((c, i) => {
                  if (!c) return null
                  const op = 0.15 + 0.85 * (c / faultBins.max)
                  const s  = Math.round(i * faultBins.binSec)
                  const e  = Math.round((i + 1) * faultBins.binSec)
                  return (
                    <div key={`fb-${i}`}
                      className="absolute top-0 bottom-0"
                      style={{
                        left:  `${(i / FAULT_BINS) * 100}%`,
                        width: `${(1 / FAULT_BINS) * 100}%`,
                        backgroundColor: `rgba(220,38,38,${op})`,
                      }}
                      title={`${formatHM(s)}–${formatHM(e)}  ·  ${c} fault${c !== 1 ? "s" : ""}\n${faultBins.topIds(i)}`}
                    />
                  )
                })
              ) : (
                <svg viewBox={`0 0 ${FAULT_BINS} 56`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
                  <polygon
                    points={`0,56 ${faultBins.bins.map((c, i) => `${i},${(56 - (c / faultBins.max) * 48).toFixed(1)}`).join(" ")} ${FAULT_BINS - 1},56`}
                    fill="rgba(220,38,38,0.2)" stroke="#dc2626" strokeWidth="1.25"
                    vectorEffect="non-scaling-stroke" strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}