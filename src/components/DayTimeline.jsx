import React, { useMemo } from "react";

/**
 * DayTimeline
 * Visualiserer ett døgn (00:00–24:00) horisontalt
 *
 * Props:
 * - date: string (YYYY-MM-DD)
 * - downtime: [{ start: "HH:MM:SS", end: "HH:MM:SS", reason }]
 * - service: [{ start: "HH:MM:SS", end: "HH:MM:SS", reason }]
 * - workHours: { start: "HH:MM", end: "HH:MM" } (default 06:30–21:00)
 * - height: number (px)
 */
export default function DayTimeline({
  date,
  downtime = [],
  service = [],
  workHours = { start: "06:30", end: "21:00" },
  height = 18
}) {
  const minutesInDay = 1440;

  const toMinutes = (t) => {
    const [h, m, s] = t.split(":").map(Number);
    return h * 60 + m + (s ? s / 60 : 0);
  };

  const durationMinutes = (start, end) => {
    const s = toMinutes(start);
    const e = toMinutes(end);
    return Math.max(0, Math.round(e - s));
  };

  const segments = useMemo(() => {
    const segs = [];

    // Off-hours before work
    segs.push({
      start: 0,
      end: toMinutes(workHours.start + ":00"),
      type: "off"
    });

    // Work hours base
    segs.push({
      start: toMinutes(workHours.start + ":00"),
      end: toMinutes(workHours.end + ":00"),
      type: "work"
    });

    // Off-hours after work
    segs.push({
      start: toMinutes(workHours.end + ":00"),
      end: minutesInDay,
      type: "off"
    });

    // Service overlays (oransje)
    for (const s of service) {
      segs.push({
        start: toMinutes(s.start),
        end: toMinutes(s.end),
        type: "service",
        reason: s.reason
      });
    }

    // Downtime overlays (rød)
    for (const d of downtime) {
      segs.push({
        start: toMinutes(d.start),
        end: toMinutes(d.end),
        type: "fault",
        reason: d.reason,
        duration: durationMinutes(d.start, d.end)
      });
    }

    return segs;
  }, [downtime, service, workHours]);

  const colorFor = (type) => {
    switch (type) {
      case "off":
        return "bg-gray-300";
      case "work":
        return "bg-green-500";
      case "fault":
        return "bg-red-600";
      case "service":
        return "bg-orange-500";
      default:
        return "bg-gray-200";
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {date && (
        <span className="text-xs text-gray-500 w-[90px] shrink-0">
          {date}
        </span>
      )}

      <div
        className="relative flex w-full rounded-full overflow-hidden"
        style={{ height }}
      >
        {segments.map((s, i) => {
          const left = (s.start / minutesInDay) * 100;
          const width = ((s.end - s.start) / minutesInDay) * 100;

          const title =
            s.type === "fault"
              ? `${s.reason} – ${s.duration} min`
              : s.type === "service"
              ? s.reason || "Service"
              : undefined;

          return (
            <div
              key={i}
              title={title}
              className={`absolute top-0 h-full ${colorFor(s.type)}`}
              style={{ left: `${left}%`, width: `${width}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
