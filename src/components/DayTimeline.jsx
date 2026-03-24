import React from "react"

const WORK_START = "07:00"
const WORK_END = "15:00"

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/* ================================
   Bygg Power OFF intervaller
================================ */
function buildPowerIntervals(events) {
  const sorted = [...events].sort(
    (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time)
  )

  const intervals = []
  let active = null

  for (const e of sorted) {
    if (e.type === "OFF") {
      active = { start: e.time }
    }

    if (e.type === "ON" && active) {
      intervals.push({
        start: active.start,
        end: e.time
      })
      active = null
    }
  }

  return intervals
}

export default function DayTimeline({
  downtime = [],
  systemModes = [],
  powerRawEvents = []
}) {
  const DAY_MINUTES = 24 * 60
  const toPct = (min) => `${(clamp(min, 0, DAY_MINUTES) / DAY_MINUTES) * 100}%`
  const workStartMin = timeToMinutes(WORK_START)
  const workEndMin = timeToMinutes(WORK_END)

  const powerIntervals = buildPowerIntervals(powerRawEvents)

  return (
    <div className="w-full relative select-none">
      {/* === TIME TICKS === */}
      <div className="relative h-5 mb-1 text-[10px] text-gray-500">
        {[0, 6, 12, 18, 24].map((h) => {
          const isFirst = h === 0
          const isLast = h === 24

          return (
            <div
              key={h}
              className={`absolute ${
                isFirst
                  ? "translate-x-0"
                  : isLast
                  ? "-translate-x-full"
                  : "-translate-x-1/2"
              }`}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          )
        })}
      </div>

      {/* === TIMELINE === */}
      <div className="relative h-12 rounded-full overflow-hidden bg-gray-300 z-0">

        {/* Off-hours */}
        <div
          className="absolute top-0 bottom-0 bg-gray-400"
          style={{ left: 0, width: toPct(workStartMin) }}
        />
        <div
          className="absolute top-0 bottom-0 bg-gray-400"
          style={{
            left: toPct(workEndMin),
            width: toPct(DAY_MINUTES - workEndMin)
          }}
        />

        {/* Work hours */}
        <div
          className="absolute top-0 bottom-0 bg-green-500"
          style={{
            left: toPct(workStartMin),
            width: toPct(workEndMin - workStartMin)
          }}
        />

        {/* =============================
            SYSTEM MODES
        ============================= */}
        {systemModes.map((m, i) => {
          const startMin = timeToMinutes(m.start)
          const endMin = timeToMinutes(m.end)
          const durationMin = Math.max(0.5, endMin - startMin)
          const isService = m.mode === "SERVICE"

          return (
            <div
              key={`mode-${i}`}
              className="absolute top-0 bottom-0"
              style={{
                left: toPct(startMin),
                width: toPct(durationMin),
                backgroundColor: isService ? "#fb923c" : "#3b82f6",
                opacity: isService ? 0.9 : 0.6,
                zIndex: 1
              }}
              title={`${m.mode} ${m.start}–${m.end}`}
            />
          )
        })}

        {/* =============================
            DOWNTIME
        ============================= */}
        {downtime.map((d, i) => {
          const startMin = timeToMinutes(d.start)
          const endMin = timeToMinutes(d.end)
          const durationMin = Math.max(0.5, endMin - startMin)

          return (
            <div
              key={`down-${i}`}
              className="absolute top-0 bottom-0"
              style={{
                left: toPct(startMin),
                width: toPct(durationMin),
                backgroundColor: "#dc2626",
                zIndex: 2
              }}
              title={`⛔ ${d.start}–${d.end}\nInterlocks:\n${(d.interlocks || []).join("\n")}`}
            />
          )
        })}

        {/* =============================
            POWER ON / OFF SPLIT MARKERS
        ================================ */}
        {powerRawEvents.map((e, i) => {
          const min = timeToMinutes(e.time)
          const isOff = e.type === "OFF"

          return (
            <div
              key={`power-marker-${i}`}
              style={{
                position: "absolute",
                left: toPct(min),
                transform: "translateX(-50%)",

                width: "4px", // litt bredere = mer synlig

                top: isOff ? "0%" : "50%",
                height: "50%",

                // 🔥 NYE FARGER
                backgroundColor: isOff ? "#7c3aed" : "#facc15",

                // 🔥 OUTLINE for ekstra kontrast
                border: "1px solid rgba(0,0,0,0.6)",

                zIndex: 6,
                opacity: 1,

                // 🔥 STRONG GLOW
                boxShadow: isOff
              ? "0 0 8px #7c3aed, 0 0 12px #7c3aed"
              : "0 0 8px #facc15, 0 0 12px #facc15"
              }}
              title={`🔌 Power ${e.type} ${e.time}`}
            />
          )
        })}
      </div>
    </div>
  )
}