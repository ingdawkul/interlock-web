import React from "react";
import { AlertTriangle, Circle, Octagon, Info } from "lucide-react";

export default function RecentInterlocks({ interlocks }) {
  if (!interlocks || interlocks.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-lg">
        <h2 className="text-lg font-semibold text-gray-100 mb-3">Siste Interlocks</h2>
        <p className="text-gray-500 italic text-sm">Ingen interlocks funnet.</p>
      </div>
    );
  }

  // Formatér tid (HH:MM:SS)
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const now = new Date();
    const [h, m, s] = timeStr.split(":");
    now.setHours(h, m, s);
    return now.toTimeString().split(" ")[0];
  };

  // Velg ikon etter type tekst
  const getIcon = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("fault") || lower.includes("error"))
      return <Octagon className="text-red-500 w-5 h-5" />;
    if (lower.includes("alarm"))
      return <AlertTriangle className="text-orange-400 w-5 h-5" />;
    if (lower.includes("warn"))
      return <Circle className="text-yellow-400 w-5 h-5" />;
    return <Info className="text-green-400 w-5 h-5" />;
  };

  // Sorter interlocks fra nyeste til eldste
  const sorted = [...interlocks].sort((a, b) => {
    const lastA = a.times?.[a.times.length - 1];
    const lastB = b.times?.[b.times.length - 1];
    return new Date(`1970-01-01T${lastB}`) - new Date(`1970-01-01T${lastA}`);
  });

  // Begrens til 15 siste
  const recent = sorted.slice(0, 15);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 shadow-lg">
      <h2 className="text-lg font-semibold text-gray-100 mb-4">Siste Interlocks</h2>

      <ul className="space-y-3  overflow-y-auto pr-1">
        {recent.map((entry, i) => (
          <li
            key={i}
            className="bg-gray-800/60 hover:bg-gray-800 border border-gray-700 rounded-xl p-3 transition-all"
          >
            {/* Tid og filnavn */}
            <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
              <span>{formatTime(entry.times?.[entry.times.length - 1])}</span>
              <span className="text-gray-500">{entry.file}</span>
            </div>

            {/* Beskrivelse + Type */}
            <div className="flex items-start gap-3">
              {getIcon(entry.description)}
              <div>
                <p className="text-gray-100 text-base font-medium leading-tight">
                  {entry.description}
                </p>
                <p className="text-gray-400 text-sm mt-0.5">
                  <span className="font-mono text-gray-300">{entry.id}</span>
                  <span className="text-gray-500"> • </span>
                  <span className="text-gray-300 font-semibold">{entry.type}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
