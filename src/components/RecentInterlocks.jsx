import React from "react";
import { AlertTriangle, Circle, Octagon, Info } from "lucide-react";

export default function RecentInterlocks({ interlocks }) {
  if (!interlocks || interlocks.length === 0) {
    return (
      <div
        className="bg-card border border-border-soft rounded-2xl p-4 shadow-lg"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
      >
        <h2 className="text-lg font-semibold mb-3">Siste Interlocks</h2>
        <p className="italic text-sm text-text-secondary">Ingen interlocks funnet.</p>
      </div>
    );
  }

  const files = [...new Set(interlocks.map((i) => i.file))];

  let filteredInterlocks = interlocks;
  if (files.length > 1) {
    const newest = files.sort().reverse()[0];
    filteredInterlocks = interlocks.filter((i) => i.file === newest);
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const now = new Date();
    const [h, m, s] = timeStr.split(":");
    now.setHours(h, m, s);
    return now.toTimeString().split(" ")[0];
  };

  const getIcon = (text) => {
    const lower = text.toLowerCase();
    if (lower.includes("fault") || lower.includes("error"))
      return <Octagon className="w-5 h-5" style={{ color: '#D32F2F' }} />;
    if (lower.includes("alarm"))
      return <AlertTriangle className="w-5 h-5" style={{ color: '#FF9800' }} />;
    if (lower.includes("warn"))
      return <Circle className="w-5 h-5" style={{ color: '#FFC107' }} />;
    return <Info className="w-5 h-5" style={{ color: '#4CAF50' }} />;
  };

  const sorted = [...filteredInterlocks].sort((a, b) => {
    const lastA = a.times?.[a.times.length - 1];
    const lastB = b.times?.[b.times.length - 1];
    return new Date(`1970-01-01T${lastB}`) - new Date(`1970-01-01T${lastA}`);
  });

  const recent = sorted.slice(0, 15);

  return (
    <div
      className="bg-card border border-border-soft rounded-2xl p-4 shadow-lg"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-soft)', color: 'var(--text-primary)' }}
    >
      <h2 className="text-lg font-semibold mb-4">Siste Interlocks</h2>

      <ul className="space-y-3 overflow-y-auto pr-1">
        {recent.map((entry, i) => (
          <li
            key={i}
            className="rounded-xl p-3 transition-all border"
            style={{
              backgroundColor: i % 2 === 0 ? '#2C3E50' : '#34495E',
              borderColor: '#333A47',
              cursor: 'pointer'
            }}
          >
            <div className="flex justify-between items-center text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
              <span>{formatTime(entry.times?.[entry.times.length - 1])}</span>
              <span>{entry.file}</span>
            </div>

            <div className="flex items-start gap-3">
              {getIcon(entry.description)}
              <div>
                <p className="text-base font-medium leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {entry.description}
                </p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <span className="font-mono">{entry.id}</span>
                  <span className="text-text-secondary"> • </span>
                  <span className="font-semibold">{entry.type}</span>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
