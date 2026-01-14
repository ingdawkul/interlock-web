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

export default function DayTimeline({
  date,
  downtime = [],        // [{ start, end, reason, interlocks }]
  systemModes = []      // [{ start, end, mode }]
}) {
  const DAY_MINUTES = 24 * 60

  const toPct = (min) =>
    `${(clamp(min, 0, DAY_MINUTES) / DAY_MINUTES) * 100}%`

  const workStartMin = timeToMinutes(WORK_START)
  const workEndMin = timeToMinutes(WORK_END)

  return (
    <div className="w-full relative select-none">
      {/* === TICKS === */}
      <div className="relative h-5 mb-1 text-[10px] text-gray-500">
        {[0, 6, 12, 18, 24].map((h) => (
          <div
            key={h}
            className="absolute -translate-x-1/2"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}:00
          </div>
        ))}
      </div>

      {/* === TIMELINE === */}
      <div className="relative h-5 rounded-full overflow-hidden bg-gray-300">

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

        {/* Default work hours */}
        <div
          className="absolute top-0 bottom-0 bg-green-500"
          style={{
            left: toPct(workStartMin),
            width: toPct(workEndMin - workStartMin)
          }}
        />

        {/* === SYSTEM MODES LAYER === */}
        {systemModes.map((m, i) => {
          const startMin = timeToMinutes(m.start)
          const endMin = timeToMinutes(m.end)
          const durationMin = Math.max(0, endMin - startMin)

          const isService = m.mode === "SERVICE"

          return (
            <div
              key={`mode-${i}`}
              className={`absolute top-0 bottom-0 ${
                isService ? "bg-orange-400" : "bg-blue-500"
              }`}
              style={{
                left: toPct(startMin),
                width: toPct(durationMin),
                opacity: isService ? 0.9 : 0.6
              }}
              title={
                isService
                  ? `🛠 SERVICE ${m.start}–${m.end}`
                  : `🏥 CLINICAL ${m.start}–${m.end}`
              }
            />
          )
        })}

        {/* === DOWNTIME LAYER (TOP) === */}
        {downtime.map((d, i) => {
          const startMin = timeToMinutes(d.start)
          const endMin = timeToMinutes(d.end)
          const durationMin = Math.max(0, endMin - startMin)

          return (
            <div
              key={`down-${i}`}
              className="absolute top-0 bottom-0 bg-red-600"
              style={{
                left: toPct(startMin),
                width: toPct(durationMin)
              }}
              title={`⛔ ${d.start}–${d.end}
Varighet: ${durationMin} min

Interlocks:
${(d.interlocks || []).join("\n")}`}
            />
          )
        })}
      </div>
    </div>
  )
}
