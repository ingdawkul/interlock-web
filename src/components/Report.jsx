import React, { useMemo, useState } from "react";
import { TREND_CONFIG } from "./TrendConfig";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function classifyPoints(paramName, points = []) {
  const cfg = TREND_CONFIG[paramName];
  if (!cfg || points.length === 0) return "OK";

  let hasWarning = false;
  for (const p of points) {
    const v = p.avg;
    if (v == null) continue;
    if (
      (cfg.max !== undefined && v > cfg.max) ||
      (cfg.min !== undefined && v < cfg.min)
    )
      return "ERROR";
    if (
      (cfg.warningMax !== undefined && v > cfg.warningMax) ||
      (cfg.warningMin !== undefined && v < cfg.warningMin)
    )
      hasWarning = true;
  }
  return hasWarning ? "WARNING" : "OK";
}

function latestAvg(points = []) {
  if (!points.length) return null;
  return [...points].sort((a, b) => b.timestamp - a.timestamp)[0].avg;
}

function formatVal(v, unit) {
  if (v == null) return "–";
  const s = typeof v === "number" ? v.toFixed(3) : String(v);
  return unit ? `${s} ${unit}` : s;
}

// ──────────────────────────────────────────────
// Word / .doc export
// ──────────────────────────────────────────────
async function exportToWord({ machineName, errors, warnings, date, multiMachine }) {
  const escHtml = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const renderRows = (items, color, label) => {
    if (!items.length) return "";
    return `
      <tr>
        <td colspan="${multiMachine ? 4 : 3}" style="background:${color};color:#fff;font-weight:bold;padding:6px 10px;font-size:13px;">
          ${label}
        </td>
      </tr>
      ${items.map((item) => `
        <tr>
          <td style="padding:5px 10px;border-bottom:1px solid #eee;font-family:Courier New,monospace;font-size:11px;${multiMachine ? "width:45%" : "width:55%"}">${escHtml(item.param)}</td>
          ${multiMachine ? `<td style="padding:5px 10px;border-bottom:1px solid #eee;font-size:11px;color:#555;font-weight:bold;">${escHtml(item.machine)}</td>` : ""}
          <td style="padding:5px 10px;border-bottom:1px solid #eee;text-align:center;font-weight:bold;color:${color};">${escHtml(item.status)}</td>
          <td style="padding:5px 10px;border-bottom:1px solid #eee;">${escHtml(item.detail)}</td>
        </tr>`).join("")}`;
  };

  const thRow = multiMachine
    ? `<th style="width:45%">Parameter</th><th>Machine</th><th style="width:10%">Status</th><th>Details</th>`
    : `<th style="width:55%">Parameter</th><th style="width:10%">Status</th><th>Details</th>`;

  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office'
      xmlns:w='urn:schemas-microsoft-com:office:word'
      xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8"/>
  <title>Machine Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1a1a1a; }
    h1 { color: #1d3557; border-bottom: 2px solid #1d3557; padding-bottom: 8px; }
    h2 { color: #457b9d; margin-top: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #1d3557; color: #fff; padding: 8px 10px; text-align: left; }
    td { vertical-align: top; }
    .ok { color: #155724; font-weight: bold; }
    .footer { margin-top: 40px; font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <h1>Machine Report – ${escHtml(machineName)}</h1>
  <p style="color:#555;font-size:13px;">Generated: ${escHtml(date)}</p>

  ${errors.length === 0 && warnings.length === 0
    ? `<p class="ok">✓ All monitored parameters are within normal range.</p>`
    : ""}

  ${errors.length > 0 || warnings.length > 0 ? `
  <h2>Parameter Status Summary</h2>
  <table>
    <tr>${thRow}</tr>
    ${renderRows(errors, "#DC2626", "🔴 ERRORS – Requires immediate action")}
    ${renderRows(warnings, "#D97706", "⚠️ WARNINGS – Monitor closely")}
  </table>` : ""}

  ${errors.length > 0 ? `
  <h2 style="color:#DC2626">Action Items – Errors</h2>
  <ul>
    ${errors.map((e) =>
      `<li><strong>${escHtml(e.param)}</strong>${multiMachine ? ` [${escHtml(e.machine)}]` : ""}: Latest value ${escHtml(e.detail)}. Value is outside acceptable range. Schedule inspection and corrective maintenance.</li>`
    ).join("")}
  </ul>` : ""}

  ${warnings.length > 0 ? `
  <h2 style="color:#D97706">Action Items – Warnings</h2>
  <ul>
    ${warnings.map((w) =>
      `<li><strong>${escHtml(w.param)}</strong>${multiMachine ? ` [${escHtml(w.machine)}]` : ""}: Latest value ${escHtml(w.detail)}. Value is approaching threshold. Monitor trend and plan preventive action.</li>`
    ).join("")}
  </ul>` : ""}

  <div class="footer"><p>© OUS AMF ING – Log Analysis Tool</p></div>
</body>
</html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `report_${machineName.replace(/[\s,]+/g, "_")}_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
export default function Report({ trendData, fileMachines, onClose }) {
  const [exporting, setExporting] = useState(false);

  const machineNames = useMemo(() => {
    const unique = [...new Set(Object.values(fileMachines || {}).filter(Boolean))];
    return unique.length ? unique.join(", ") : "Unknown machine";
  }, [fileMachines]);

  const multiMachine = useMemo(() => {
    const unique = [...new Set(Object.values(fileMachines || {}).filter(Boolean))];
    return unique.length > 1;
  }, [fileMachines]);

  // ── Key change: split each param's points by machine, classify independently ──
  const { errors, warnings, ok } = useMemo(() => {
    const errors = [];
    const warnings = [];
    const ok = [];

    for (const [param, points] of Object.entries(trendData || {})) {
      const cfg = TREND_CONFIG[param] || {};

      // Group points by machine
      const byMachine = points.reduce((acc, p) => {
        const key = p.machine || "UNKNOWN";
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
      }, {});

      for (const [machine, machinePoints] of Object.entries(byMachine)) {
        const status = classifyPoints(param, machinePoints);
        const latest = latestAvg(machinePoints);
        const detail = `Latest: ${formatVal(latest, cfg.unit)}`;
        const entry = { param, machine, status, detail, cfg, points: machinePoints };

        if (status === "ERROR") errors.push(entry);
        else if (status === "WARNING") warnings.push(entry);
        else ok.push(entry);
      }
    }

    // Sort: by machine first, then param name
    const sort = (arr) =>
      arr.sort((a, b) => a.machine.localeCompare(b.machine) || a.param.localeCompare(b.param));

    return { errors: sort(errors), warnings: sort(warnings), ok: sort(ok) };
  }, [trendData]);

  const reportDate = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportToWord({ machineName: machineNames, errors, warnings, date: reportDate, multiMachine });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full p-6 relative flex flex-col"
        style={{ maxWidth: 900, maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Machine Report</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {machineNames}&nbsp;·&nbsp;{reportDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {exporting ? <><span className="animate-spin">⏳</span> Exporting…</> : <>📄 Export to Word</>}
            </button>
            <button
              className="px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 pr-1">
          <div className="flex gap-3 mb-5 flex-wrap">
            <SummaryChip count={errors.length} label="Errors" color="bg-red-100 text-red-700 border-red-300" dot="bg-red-500" />
            <SummaryChip count={warnings.length} label="Warnings" color="bg-yellow-100 text-yellow-700 border-yellow-300" dot="bg-yellow-400" />
            <SummaryChip count={ok.length} label="OK" color="bg-green-100 text-green-700 border-green-300" dot="bg-green-500" />
          </div>

          {errors.length === 0 && warnings.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 mb-4">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold">All parameters within normal range</p>
                <p className="text-sm text-green-600">No action required based on current trend data.</p>
              </div>
            </div>
          )}

          {errors.length > 0 && (
            <Section title="🔴 Errors – Requires immediate action" titleClass="text-red-700" borderClass="border-red-200" bgClass="bg-red-50">
              {errors.map((item) => (
                <ParamRow key={`${item.machine}-${item.param}`} item={item} statusColor="text-red-600" badgeClass="bg-red-100 text-red-700 border-red-300" multiMachine={multiMachine} />
              ))}
            </Section>
          )}

          {warnings.length > 0 && (
            <Section title="⚠️ Warnings – Monitor closely" titleClass="text-yellow-700" borderClass="border-yellow-200" bgClass="bg-yellow-50">
              {warnings.map((item) => (
                <ParamRow key={`${item.machine}-${item.param}`} item={item} statusColor="text-yellow-600" badgeClass="bg-yellow-100 text-yellow-700 border-yellow-300" multiMachine={multiMachine} />
              ))}
            </Section>
          )}

          {ok.length > 0 && (
            <CollapsibleSection title={`✅ OK parameters (${ok.length})`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {ok.map((item) => (
                  <div key={`${item.machine}-${item.param}`} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="font-mono text-xs text-gray-600 truncate flex-1" title={item.param}>{item.param}</span>
                    {multiMachine && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-300 shrink-0">
                        {item.machine}
                      </span>
                    )}
                    <span className="text-gray-400 text-xs shrink-0">{item.detail}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────

function SummaryChip({ count, label, color, dot }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${color}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      {count} {label}
    </div>
  );
}

function Section({ title, titleClass, borderClass, bgClass, children }) {
  return (
    <div className={`mb-5 border rounded-xl overflow-hidden ${borderClass}`}>
      <div className={`px-4 py-2.5 font-bold text-sm ${titleClass} ${bgClass}`}>{title}</div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  );
}

function ParamRow({ item, statusColor, badgeClass, multiMachine }) {
  const cfg = TREND_CONFIG[item.param] || {};
  const unit = cfg.unit || "";

  const thresholdText = [
    cfg.min !== undefined ? `Min: ${cfg.min}${unit ? " " + unit : ""}` : null,
    cfg.warningMin !== undefined ? `Warn↓: ${cfg.warningMin}${unit ? " " + unit : ""}` : null,
    cfg.warningMax !== undefined ? `Warn↑: ${cfg.warningMax}${unit ? " " + unit : ""}` : null,
    cfg.max !== undefined ? `Max: ${cfg.max}${unit ? " " + unit : ""}` : null,
  ].filter(Boolean).join("  /  ");

  return (
    <div className="px-4 py-3 flex flex-col gap-1 bg-white hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono text-xs text-gray-700 truncate" title={item.param}>
            {item.param}
          </span>
          {multiMachine && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-300 shrink-0">
              {item.machine}
            </span>
          )}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}>
          {item.status}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
        <span className={`font-semibold ${statusColor}`}>{item.detail}</span>
        {thresholdText && <span className="text-gray-400">Thresholds: {thresholdText}</span>}
      </div>
    </div>
  );
}

function CollapsibleSection({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-4 border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-600 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="text-gray-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}