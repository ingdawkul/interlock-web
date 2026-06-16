import React, { useState, useMemo, useEffect } from "react";
import { X, Network, Power, LogIn, HeartCrack, RotateCcw, Activity, Zap, Timer, Flame, AlertTriangle } from "lucide-react";
import { CB_SIGNATURES } from "../utils/parser";
import { interlockMap } from "../utils/interlockLookup";
import { appColor } from "./DayTimeline";

// Short human description for a fault id, from the interlock database. Strips the
// leading status-flag tokens (A L B M K W O P / Maj) and truncates.
function faultLabel(id) {
  const d = interlockMap[id]?.Description?.[0];
  if (!d) return null;
  const cleaned = d.replace(/^((?:Maj|[ABLMKWOP])\s+)+/i, "").trim();
  return cleaned.length > 72 ? cleaned.slice(0, 72) + "…" : cleaned;
}

const STATE_COLORS = { ON: "#16a34a", STANDBY: "#d97706", POWEROFF: "#dc2626" };
// Interlock IDs that are power/CB-relevant for the flapping list.
const POWER_CB_FLAP_IDS = new Set([
  ...Object.keys(CB_SIGNATURES), "3017", "3021", "3026", "3027", "3010"
]);
// Fixed breaker panel — shown in order; events drop in if present in the log.
const BREAKER_CATALOG = [
  { cb: "CB1",     name: "CB1 (PFN)" },
  { cb: "CB2",     name: "CB2 (Pump)" },
  { cb: "CB3",     name: "CB3 (Stand)" },
  { cb: "CB6",     name: "CB6 (Motors)" },
  { cb: "CB7",     name: "CB7 (Line2)" },
  { cb: "CB8",     name: "CB8 (MAINS)" },
  { cb: "CB9",     name: "CB9 (REG)" },
  { cb: "CB12",    name: "CB12" },
  { cb: "DQTHY",   name: "DQ THY" },
  { cb: "MAINTHY", name: "MAIN THY" },
  { cb: "CONT",    name: "CONT Power" },
  { cb: "KVGEN",   name: "kV Gen" },
];
const CB_COLORS = {
  CB1: "#993556", CB2: "#185FA5", CB3: "#0F6E56", CB6: "#0891b2", CB7: "#b45309",
  CB8: "#854F0B", CB9: "#15803d", CB12: "#6d28d9", DQTHY: "#be185d",
  MAINTHY: "#7c3aed", CONT: "#993C1D", KVGEN: "#534AB7",
};

// Fixed node lane order (top → bottom). "ALL" = the 120001 "all nodes disconnected".
// SPV is not a disconnecting node — it's shown in the Infrastructure section below.
const NODE_ORDER = ["ALL", "BGM", "STN", "COL", "XI", "MVD", "CCHU", "CCHL", "KVD", "KVS"];

// A silence gap counts as "significant" (real syslog-chain-down, not idle) when the
// workstation kept logging through it. Idle gaps have wkstLines 0–1.
const SIGNIFICANT_WKST = 50;

const PAD_SEC = 10 * 60; // auto-zoom padding on each side

function toSec(t) {
  if (!t) return null;
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
function toHHMM(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmtDur(sec) {
  if (sec == null) return "";
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function NetworkEventsModal({ fileNetwork, onClose, initialTab, initialFile }) {
  const fileNames = useMemo(() => Object.keys(fileNetwork || {}), [fileNetwork]);
  const [tab, setTab] = useState(initialTab || "network");
  const [selectedFile, setSelectedFile] = useState(initialFile || fileNames[0] || null);
  const [showIdle, setShowIdle] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = selectedFile ? fileNetwork[selectedFile] : null;

  // ── Build the auto-zoomed window + lanes for the Network tab ────────────────
  const view = useMemo(() => {
    if (!data) return null;
    const { nodeEvents, nodeDisconnects, coldStarts, heartbeatLosses, silenceGaps } = data;

    const sigGaps = silenceGaps.filter(g => g.wkstLines >= SIGNIFICANT_WKST);

    // Size the window from the actual node-disconnect activity (node events +
    // heartbeat losses), not from isolated night-time gaps or all-day cold-starts.
    const anchor = [];
    nodeEvents.forEach(e => anchor.push(toSec(e.time)));
    nodeDisconnects.forEach(d => { if (d.disconnect) anchor.push(toSec(d.disconnect)); if (d.reconnect) anchor.push(toSec(d.reconnect)); });
    heartbeatLosses.forEach(h => anchor.push(toSec(h.time)));
    let basis = anchor.filter(s => s != null);
    // Fallback: no node activity → size from cold-starts + significant gaps
    if (basis.length === 0) {
      coldStarts.forEach(c => basis.push(toSec(c.time)));
      sigGaps.forEach(g => { basis.push(toSec(g.start.time)); basis.push(toSec(g.end.time)); });
      basis = basis.filter(s => s != null);
    }
    if (basis.length === 0) return { empty: true, idleCount: silenceGaps.length, gapCount: 0 };

    let winStart = Math.max(0, Math.min(...basis) - PAD_SEC);
    let winEnd = Math.min(86400, Math.max(...basis) + PAD_SEC);
    if (winEnd - winStart < 600) winEnd = winStart + 600; // min 10 min span
    const span = winEnd - winStart;
    const pct = (sec) => Math.max(0, Math.min(100, ((sec - winStart) / span) * 100));

    // Clip gaps + cold-starts to the visible window
    const inWin = (t) => { const s = toSec(t); return s != null && s >= winStart && s <= winEnd; };
    const visibleSig = sigGaps.filter(g => inWin(g.start.time) || inWin(g.end.time));
    const allGapsInWin = silenceGaps.filter(g => inWin(g.start.time) || inWin(g.end.time));
    const idleCount = allGapsInWin.length - visibleSig.length;
    const shownGaps = showIdle ? allGapsInWin : visibleSig;
    const visibleColdStarts = coldStarts.filter(c => inWin(c.time));

    // Node lanes
    const lanes = NODE_ORDER.map(node => {
      const intervals = nodeDisconnects.filter(d => d.node === node);
      const allHb = heartbeatLosses.filter(h => h.node === node);
      return (intervals.length || allHb.length) ? { node, intervals, heartbeats: allHb } : null;
    }).filter(Boolean);

    // Infrastructure / PC lanes (shown under the nodes). Each lane has down
    // intervals (bars) and/or point events (ticks). Clipped to the window.
    const clip = (sec) => sec != null && sec >= winStart && sec <= winEnd;
    const infra = [];
    // SPV: silent windows (lost log) as down-intervals + cold-starts as recovery
    const spvIntervals = shownGaps.map(g => ({ start: toSec(g.start.time), end: toSec(g.end.time), label: `SPV/syslog silent ${g.start.time}–${g.end.time} (${g.durationMin} min)` }));
    const spvMarkers = visibleColdStarts.map(c => ({ sec: toSec(c.time), label: `SPV cold-start ${c.time}`, up: true }));
    if (spvIntervals.length || spvMarkers.length) infra.push({ name: "SPV", down: "#7c3aed", intervals: spvIntervals, markers: spvMarkers });
    // CBCT: disconnect intervals
    const cbctIv = (data.cbctDowns || []).filter(d => clip(toSec(d.start)) || (d.end && clip(toSec(d.end))))
      .map(d => ({ start: toSec(d.start), end: d.end ? toSec(d.end) : winEnd, label: `CBCT disconnected ${d.start}–${d.end ?? "(open)"}` }));
    if (cbctIv.length) infra.push({ name: "CBCT", down: "#dc2626", intervals: cbctIv, markers: [] });
    // EXIO: comms-fault events
    const exioM = (data.exioEvents || []).filter(e => clip(toSec(e.time))).map(e => ({ sec: toSec(e.time), label: `EXIO comms fault ${e.time}` }));
    if (exioM.length) infra.push({ name: "EXIO", down: "#dc2626", intervals: [], markers: exioM });
    // Imaging PSU: comms-error events
    const psuM = (data.imagingPsuEvents || []).filter(e => clip(toSec(e.time))).map(e => ({ sec: toSec(e.time), label: `Imaging PSU comms error ${e.time}` }));
    if (psuM.length) infra.push({ name: "Imaging PSU", down: "#dc2626", intervals: [], markers: psuM });
    // IRM: reconnect events (recovery → green)
    const irmM = (data.irmEvents || []).filter(e => clip(toSec(e.time))).map(e => ({ sec: toSec(e.time), label: `${e.which || "IRM"} reconnected ${e.time}`, up: true }));
    if (irmM.length) infra.push({ name: "IRM", down: "#16a34a", intervals: [], markers: irmM });

    // Axis ticks
    const stepCandidates = [300, 600, 900, 1800, 3600, 7200];
    const step = stepCandidates.find(s => span / s <= 8) || 7200;
    const ticks = [];
    for (let t = Math.ceil(winStart / step) * step; t <= winEnd; t += step) ticks.push(t);

    return { winStart, winEnd, span, pct, lanes, infra, ticks, gaps: shownGaps, coldStarts: visibleColdStarts, idleCount, gapCount: visibleSig.length };
  }, [data, showIdle]);

  const tabs = [
    { id: "network", label: "Network", icon: Network },
    { id: "state", label: "State", icon: Activity },
    { id: "power", label: "Power & EMO", icon: Power },
    { id: "faults", label: "Faults", icon: AlertTriangle },
    { id: "session", label: "Sessions", icon: LogIn },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:w-[95vw] sm:max-w-[1400px] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[94vh] sm:max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Diagnostics"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-0 border-b border-gray-100">
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Diagnostics</h2>
              <button
                onClick={onClose} aria-label="Close"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            {fileNames.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {fileNames.map((fn) => (
                  <button key={fn} onClick={() => setSelectedFile(fn)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      fn === selectedFile
                        ? "bg-gray-800 text-white border-gray-800"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}>
                    {fn}
                  </button>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 -mb-px">
              {tabs.map(({ id, label, icon: Icon, disabled }) => (
                <button
                  key={id}
                  disabled={disabled}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors
                    ${tab === id
                      ? "border-blue-600 text-blue-700"
                      : disabled
                      ? "border-transparent text-gray-300 cursor-not-allowed"
                      : "border-transparent text-gray-500 hover:text-gray-700"}`}
                >
                  <Icon size={15} />
                  {label}
                  {disabled && <span className="text-[9px] uppercase tracking-wide text-gray-300">soon</span>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4">
          {tab === "network" && (
            <NetworkTab view={view} showIdle={showIdle} setShowIdle={setShowIdle} />
          )}
          {tab === "state" && <StateTab data={data} />}
          {tab === "power" && <PowerTab data={data} />}
          {tab === "faults" && <FaultsTab data={data} />}
          {tab === "session" && <SessionTab data={data} />}
        </div>
      </div>
    </div>
  );
}

// ── Network tab ───────────────────────────────────────────────────────────────
function NetworkTab({ view, showIdle, setShowIdle }) {
  if (!view) return <p className="text-sm text-gray-400">No data for this file.</p>;
  if (view.empty) {
    return <p className="text-sm text-gray-400">No node or network events in this window.</p>;
  }
  const { pct, lanes, ticks, gaps, coldStarts, idleCount, gapCount } = view;
  const LABEL_W = 56;

  return (
    <div>
      {/* Chart */}
      <div className="relative" style={{ paddingTop: 18 }}>
        {/* overlay layer aligned to the track area */}
        <div className="absolute pointer-events-none" style={{ left: LABEL_W, right: 8, top: 0, bottom: 0 }}>
          {ticks.map((t, i) => (
            <div key={i} className="absolute text-[10px] text-gray-400" style={{ top: 0, left: `${pct(t)}%`, transform: "translateX(-50%)" }}>
              {toHHMM(t)}
            </div>
          ))}
          {ticks.map((t, i) => (
            <div key={"g" + i} className="absolute" style={{ top: 18, bottom: 0, left: `${pct(t)}%`, borderLeft: "0.5px solid rgba(0,0,0,0.06)" }} />
          ))}
          {/* significant silence gaps */}
          {gaps.map((g, i) => {
            const l = pct(toSec(g.start.time));
            const w = Math.max(0.4, pct(toSec(g.end.time)) - l);
            return (
              <div key={"s" + i} title={`Silence ${g.start.time}–${g.end.time} (${g.durationMin} min, ${g.wkstLines} wkst lines — log may be lost)`}
                className="absolute" style={{
                  top: 18, bottom: 0, left: `${l}%`, width: `${w}%`,
                  background: "repeating-linear-gradient(45deg,rgba(136,135,128,0.10),rgba(136,135,128,0.10) 4px,rgba(136,135,128,0.22) 4px,rgba(136,135,128,0.22) 8px)",
                  borderLeft: "1px dashed #888780", borderRight: "1px dashed #888780"
                }} />
            );
          })}
          {/* cold-start vertical markers */}
          {coldStarts.map((c, i) => (
            <div key={"c" + i} title={`SPV cold-start ${c.time} (${c.kind})`}
              className="absolute" style={{ top: 14, bottom: 0, left: `${pct(toSec(c.time))}%`, borderLeft: "1.5px dashed #BA7517" }} />
          ))}
        </div>

        {/* lanes */}
        <div className="relative">
          {lanes.map(({ node, intervals, heartbeats }) => (
            <div key={node} className="flex items-center" style={{ height: 22 }}>
              <div className="text-[11px] font-semibold text-gray-600 shrink-0" style={{ width: LABEL_W }} title={node === "ALL" ? "120001 — all nodes disconnected (network switch)" : node}>
                {node === "ALL" ? "All nodes" : node}
              </div>
              <div className="relative flex-1 mr-2" style={{ height: 22, borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
                {intervals.map((iv, i) => {
                  if (iv.orphanReconnect) {
                    const x = pct(toSec(iv.reconnect));
                    return (
                      <div key={i} title={`Reconnect ${iv.reconnect} — disconnect lost in silence gap`}
                        className="absolute" style={{ top: 6, left: `${x}%`, width: 9, height: 9, background: "#D85A30", transform: "translateX(-50%) rotate(45deg)" }} />
                    );
                  }
                  const startSec = toSec(iv.disconnect);
                  const endSec = iv.reconnect ? toSec(iv.reconnect) : view.winEnd;
                  const l = pct(startSec);
                  const w = Math.max(0.6, pct(endSec) - l);
                  const dur = iv.durationSec != null ? fmtDur(iv.durationSec) : (iv.stillOpen ? "still down" : "");
                  return (
                    <div key={i} title={`${node} disconnected ${iv.disconnect}${iv.reconnect ? ` → ${iv.reconnect}` : " (open)"}${dur ? ` · ${dur}` : ""}`}
                      className="absolute rounded-sm" style={{
                        top: 6, height: 11, left: `${l}%`, width: `${w}%`,
                        background: iv.stillOpen ? "#993C1D" : "#D85A30"
                      }} />
                  );
                })}
                {heartbeats.map((h, i) => (
                  <div key={"h" + i} title={`Heartbeat loss ${h.time} (socket ${h.socket}, ${h.ms} ms)`}
                    className="absolute" style={{ top: 3, left: `${pct(toSec(h.time))}%`, transform: "translateX(-50%)", color: "#185FA5" }}>
                    <HeartCrack size={13} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Infrastructure / PC lanes (under the nodes, not part of them) */}
          {view.infra.length > 0 && (
            <>
              <div className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold mt-1.5 mb-0.5">
                PCs
              </div>
              {view.infra.map((lane) => (
                <div key={lane.name} className="flex items-center" style={{ height: 22 }}>
                  <div className="text-[11px] font-semibold text-gray-600 shrink-0" style={{ width: LABEL_W }}>{lane.name}</div>
                  <div className="relative flex-1 mr-2" style={{ height: 22, borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
                    {lane.intervals.map((iv, i) => {
                      const l = pct(iv.start);
                      const w = Math.max(0.6, pct(iv.end) - l);
                      return <div key={i} title={iv.label} className="absolute rounded-sm"
                        style={{ top: 6, height: 11, left: `${l}%`, width: `${w}%`, background: lane.down, opacity: 0.85 }} />;
                    })}
                    {lane.markers.map((m, i) => (
                      <div key={"m" + i} title={m.label} className="absolute"
                        style={{ top: 4, left: `${pct(m.sec)}%`, transform: "translateX(-50%)", borderLeft: `2px solid ${m.up ? "#16a34a" : lane.down}`, height: 13 }} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Legend + controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span style={{ width: 18, height: 9, background: "#D85A30", borderRadius: 2 }} /> Disconnected</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 9, height: 9, background: "#D85A30", transform: "rotate(45deg)" }} /> Reconnect (raise lost)</span>
        <span className="flex items-center gap-1.5">
          <span style={{ width: 14, height: 9, background: "repeating-linear-gradient(45deg,rgba(136,135,128,0.15),rgba(136,135,128,0.15) 3px,rgba(136,135,128,0.3) 3px,rgba(136,135,128,0.3) 6px)" }} /> Silence gap
        </span>
        <span className="flex items-center gap-1.5"><span style={{ borderLeft: "1.5px dashed #BA7517", height: 11 }} /> SPV cold-start</span>
        <span className="flex items-center gap-1.5"><HeartCrack size={12} style={{ color: "#185FA5" }} /> Heartbeat loss</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 14, height: 9, background: "#dc2626", borderRadius: 2, opacity: 0.85 }} /> PC/infra down</span>
        <span className="flex items-center gap-1.5"><span style={{ borderLeft: "2px solid #16a34a", height: 11 }} /> Recovery / reconnect</span>
        {idleCount > 0 && (
          <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
            <input type="checkbox" checked={showIdle} onChange={(e) => setShowIdle(e.target.checked)} />
            Show {idleCount} idle gap{idleCount !== 1 ? "s" : ""} ({gapCount} significant)
          </label>
        )}
      </div>
    </div>
  );
}

// ── State tab (Module 3) ───────────────────────────────────────────────────────
function StateTab({ data }) {
  const states = data?.machineStates || [];
  const pel = data?.pelEvents || [];
  const latencies = data?.modeUpLatencies || [];
  const warmups = data?.warmupDelays || [];

  // Auto-zoomed strip window from state activity
  const strip = useMemo(() => {
    const secs = [];
    states.forEach(s => { if (s.start) secs.push(toSec(s.start)); if (s.end) secs.push(toSec(s.end)); });
    const valid = secs.filter(s => s != null);
    if (!valid.length) return null;
    let winStart = Math.max(0, Math.min(...valid));
    let winEnd = Math.min(86400, Math.max(...valid));
    if (winEnd - winStart < 600) winEnd = winStart + 600;
    const span = winEnd - winStart;
    return { winStart, winEnd, span, pct: (s) => Math.max(0, Math.min(100, ((s - winStart) / span) * 100)) };
  }, [states]);

  if (!states.length && !pel.length && !latencies.length) {
    return <p className="text-sm text-gray-400">No machine-state transitions in this file.</p>;
  }

  return (
    <div className="space-y-5">
      {/* State strip */}
      {strip && (
        <div>
          <SectionLabel icon={<Activity size={14} />} text="Machine state" />
          <div className="relative h-6 rounded-md overflow-hidden bg-gray-100">
            {states.map((s, i) => {
              const l = strip.pct(toSec(s.start));
              const end = s.end ? toSec(s.end) : strip.winEnd;
              const w = Math.max(0.5, strip.pct(end) - l);
              const cause = s.cause ? (s.cause.category === "power-loop-open" ? " · power loop open" : " · power interlock") : "";
              return (
                <div key={i} title={`${s.state}  ${s.start}–${s.end ?? "?"}${cause}`}
                  className="absolute top-0 bottom-0" style={{ left: `${l}%`, width: `${w}%`, background: STATE_COLORS[s.state] || "#9ca3af" }} />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{toHHMM(strip.winStart)}</span><span>{toHHMM(strip.winEnd)}</span>
          </div>
          <div className="flex gap-3 mt-2 text-[11px] text-gray-500">
            {["ON", "STANDBY", "POWEROFF"].map(st => (
              <span key={st} className="flex items-center gap-1.5">
                <span style={{ width: 12, height: 9, background: STATE_COLORS[st], borderRadius: 2 }} />{st}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mode-up latencies */}
      {latencies.length > 0 && (
        <div>
          <SectionLabel icon={<Timer size={14} />} text="Mode-up latency" />
          <ul className="space-y-1.5">
            {latencies.map((l, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="font-mono text-xs text-gray-500">{l.firstAttempt} → {l.onTime}</span>
                <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded px-1.5 py-0.5">{fmtDur(l.latencySec)}</span>
                <span className="text-xs text-gray-400">{l.attemptCount} attempt{l.attemptCount !== 1 ? "s" : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PEL events */}
      {pel.length > 0 && (
        <div>
          <SectionLabel icon={<Zap size={14} />} text={`PEL events (${pel.length})`} />
          <ul className="space-y-1.5">
            {pel.map((p, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-gray-500">{p.time}</span>
                <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 ${p.inferred ? "bg-amber-50 text-amber-700" : "bg-purple-50 text-purple-700"}`}>
                  {p.inferred ? "inferred (service)" : "beam-side"}
                </span>
                {p.reason && <span className="text-xs text-gray-500">{p.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warm-up delays */}
      {warmups.length > 0 && (
        <div>
          <SectionLabel icon={<Flame size={14} />} text="Klystron warm-up (3010)" />
          <ul className="space-y-1.5">
            {warmups.map((w, i) => (
              <li key={i} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="font-mono text-xs text-gray-500">{w.start} → {w.end}</span>
                <span className="text-xs font-semibold text-orange-700 bg-orange-50 rounded px-1.5 py-0.5">{fmtDur(w.durationSec)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, text }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">
      <span className="text-gray-400">{icon}</span>{text}
    </h3>
  );
}

// ── Power & EMO tab (Module 4) ──────────────────────────────────────────────
function PowerTab({ data }) {
  const [hovered, setHovered] = useState(null);
  const emo = data?.emoEvents || [];
  const power = data?.powerLossIntervals || [];
  const cb = data?.cbHits || [];
  const flapAll = data?.flappingGroups || [];
  const flap = flapAll
    .filter((g) => POWER_CB_FLAP_IDS.has(g.id))
    .sort((a, b) => b.count - a.count);

  // Shared auto-zoom window across all power/EMO/CB markers
  const strip = useMemo(() => {
    const secs = [];
    emo.forEach((e) => { secs.push(toSec(e.start)); secs.push(toSec(e.end)); });
    power.forEach((p) => { if (p.start) secs.push(toSec(p.start)); if (p.end) secs.push(toSec(p.end)); });
    cb.forEach((h) => { secs.push(toSec(h.first)); secs.push(toSec(h.last)); });
    flap.forEach((g) => { secs.push(toSec(g.start)); secs.push(toSec(g.end)); });
    const valid = secs.filter((s) => s != null);
    if (!valid.length) return null;
    let a = Math.max(0, Math.min(...valid) - 300);
    let b = Math.min(86400, Math.max(...valid) + 300);
    if (b - a < 600) b = a + 600;
    return { a, b, pct: (s) => Math.max(0, Math.min(100, ((s - a) / (b - a)) * 100)) };
  }, [data]);

  if (!emo.length && !power.length && !cb.length && !flap.length) {
    return <p className="text-sm text-gray-400">No power, CB or EMO events in this file.</p>;
  }

  const hl = (key) => hovered === key;

  return (
    <div className="space-y-5">
      {/* Linked timeline strip */}
      {strip && (
        <div className="relative h-9 rounded-md bg-gray-100 overflow-hidden">
          {power.map((p, i) => {
            const l = strip.pct(toSec(p.start));
            const w = Math.max(0.6, strip.pct(p.end ? toSec(p.end) : strip.b) - l);
            return <div key={"p" + i} title={`Power loss ${p.start}–${p.end ?? "?"}`}
              className="absolute" style={{ top: 0, bottom: 0, left: `${l}%`, width: `${w}%`,
                background: "#dc2626", opacity: hl("power-" + i) ? 1 : 0.55 }} />;
          })}
          {cb.map((h) => (
            <div key={"cb" + h.id} title={`${h.id} ${h.label}`}
              className="absolute" style={{ top: "55%", bottom: 2, left: `${strip.pct(toSec(h.first))}%`,
                width: hl("cb-" + (Array.isArray(h.cb) ? h.cb[0] : h.cb)) ? 4 : 2, transform: "translateX(-50%)",
                background: CB_COLORS[Array.isArray(h.cb) ? h.cb[0] : h.cb] || "#888" }} />
          ))}
          {flap.map((g, i) => (
            <div key={"f" + i} title={`${g.id} flapping ×${g.count}`}
              className="absolute" style={{ top: 2, height: "45%", left: `${strip.pct(toSec(g.start))}%`,
                width: hl("flap-" + i) ? 5 : 3, transform: "translateX(-50%)",
                background: "repeating-linear-gradient(45deg,#BA7517,#BA7517 2px,transparent 2px,transparent 4px)" }} />
          ))}
          {emo.map((e, i) => (
            <div key={"e" + i} title={`EMO ${e.start}`}
              className="absolute" style={{ top: -1, left: `${strip.pct(toSec(e.start))}%`,
                transform: "translateX(-50%)", color: "#7c3aed", fontSize: hl("emo-" + i) ? 16 : 13 }}>
              <Zap size={hl("emo-" + i) ? 16 : 13} fill="#7c3aed" />
            </div>
          ))}
        </div>
      )}

      {/* EMO episodes */}
      {emo.length > 0 && (
        <Section icon={<Zap size={14} />} title={`EMO episodes (${emo.length})`}>
          {emo.map((e, i) => (
            <Row key={i} onHover={() => setHovered("emo-" + i)} off={() => setHovered(null)} accent="#7c3aed">
              <div>
                <span className="font-semibold text-sm">EMO opened · {e.start}</span>
                <div className="text-xs text-gray-500">{e.triggers.map((t) => t.name).join(" · ")}</div>
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">{e.eventCount} sub-events</span>
            </Row>
          ))}
        </Section>
      )}

      {/* Power loss */}
      {power.length > 0 && (
        <Section icon={<Power size={14} />} title="Power loss">
          {power.map((p, i) => (
            <Row key={i} onHover={() => setHovered("power-" + i)} off={() => setHovered(null)} accent="#dc2626">
              <span className="font-mono text-xs text-gray-600">{p.start} → {p.end ?? "(open)"}</span>
              <span className="flex items-center gap-2 whitespace-nowrap">
                {p.spansSilenceGap && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5 flex items-center gap-1">
                    <AlertTriangle size={10} /> spans gap
                  </span>
                )}
                {p.durationSec != null && <span className="text-xs font-semibold text-red-700">{fmtDur(p.durationSec)}</span>}
              </span>
            </Row>
          ))}
        </Section>
      )}

      {/* Fixed circuit-breaker panel — events drop under their breaker if present */}
      <div>
        <SectionLabel icon={<Power size={14} />} text="Circuit breakers" />
        <div className="rounded-lg ring-1 ring-gray-100 divide-y divide-gray-100 overflow-hidden">
          {BREAKER_CATALOG.map(({ cb: code, name }) => {
            const hits = cb.filter((h) => (Array.isArray(h.cb) ? h.cb : [h.cb]).includes(code));
            const active = hits.length > 0;
            return (
              <div key={code}
                onMouseEnter={active ? () => setHovered("cb-" + code) : undefined}
                onMouseLeave={active ? () => setHovered(null) : undefined}
                className={`px-3 py-2 ${active ? "hover:bg-gray-50" : "opacity-50"}`}
                style={{ borderLeft: `3px solid ${active ? (CB_COLORS[code] || "#888") : "transparent"}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{name}</span>
                  {active
                    ? <span className="text-xs text-gray-500 whitespace-nowrap">{hits.reduce((s, h) => s + h.count, 0)}× events</span>
                    : <span className="text-xs text-gray-300">no events</span>}
                </div>
                {active && (
                  <ul className="mt-1 space-y-0.5">
                    {hits.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-2 text-xs text-gray-600">
                        <span><span className="font-mono font-semibold text-gray-700">{h.id}</span> <span className="text-gray-400">{h.label}</span></span>
                        <span className="text-gray-400 whitespace-nowrap">{h.count}× · {h.first}–{h.last}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5">Breakers without a known fault-ID mapping show “no events”. Tell me the fault IDs for CB6/CB7/CB9/CB12/DQ THY/MAIN THY and I’ll wire them in.</p>
      </div>

      {/* Flapping (CB/power-relevant only) */}
      {flap.length > 0 && (
        <Section icon={<Activity size={14} />} title="Flapping (power / CB interlocks)">
          {flap.map((g, i) => (
            <Row key={i} onHover={() => setHovered("flap-" + i)} off={() => setHovered(null)} accent="#BA7517">
              <div>
                <span className="font-mono text-sm font-semibold">{g.id}</span>
                {g.description && <span className="text-xs text-gray-400 ml-2 truncate">{g.description}</span>}
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">×{g.count} · {g.start}–{g.end}</span>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div>
      <SectionLabel icon={icon} text={title} />
      <div className="rounded-lg ring-1 ring-gray-100 divide-y divide-gray-100 overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ children, onHover, off, accent }) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={off}
      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
      style={{ borderLeft: `3px solid ${accent || "transparent"}` }}
    >
      {children}
    </div>
  );
}

// ── Faults tab (corrections — density overview) ─────────────────────────────
const FAULT_BINS = 96;
function FaultsTab({ data }) {
  const [view, setView] = useState("heatmap");
  const [selectedId, setSelectedId] = useState(null);
  const faultEvents = data?.faultEvents || [];

  const model = useMemo(() => {
    if (!faultEvents.length) return null;
    const bins = new Array(FAULT_BINS).fill(0);
    const byId = {};
    const idTimes = {};
    for (const e of faultEvents) {
      const sec = toSec(e.time);
      const idx = Math.max(0, Math.min(FAULT_BINS - 1, Math.floor((sec / 86400) * FAULT_BINS)));
      bins[idx]++;
      byId[e.id] = (byId[e.id] || 0) + 1;
      (idTimes[e.id] ??= []).push(sec);
    }
    const max = Math.max(...bins, 1);
    const binSec = 86400 / FAULT_BINS;
    const topIds = Object.entries(byId).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const busiest = bins.map((c, i) => ({ i, c })).filter(b => b.c > 0)
      .sort((a, b) => b.c - a.c).slice(0, 5)
      .map(b => ({ start: toHHMM(Math.round(b.i * binSec)), end: toHHMM(Math.round((b.i + 1) * binSec)), count: b.c }));
    return { bins, max, binSec, topIds, busiest, idTimes, total: faultEvents.length };
  }, [data]);

  if (!model) return <p className="text-sm text-gray-400">No fault events in this file.</p>;

  const selTimes = selectedId ? (model.idTimes[selectedId] || []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionLabel icon={<AlertTriangle size={14} />} text={`Fault density — ${model.total} events`} />
        <button
          onClick={() => setView(v => (v === "heatmap" ? "sparkline" : "heatmap"))}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        >
          {view === "heatmap" ? "Show sparkline" : "Show heatmap"}
        </button>
      </div>

      <div className="relative rounded-md bg-gray-100 overflow-hidden" style={{ height: view === "sparkline" ? 60 : 24 }}>
        {view === "heatmap" ? (
          <div className="relative w-full h-full flex">
            {model.bins.map((c, i) => (
              <div key={i} className="h-full" style={{
                flex: 1,
                background: c ? `rgba(220,38,38,${0.15 + 0.85 * (c / model.max)})` : "transparent",
              }}
                title={c ? `${toHHMM(Math.round(i * model.binSec))}–${toHHMM(Math.round((i + 1) * model.binSec))} · ${c} faults` : ""} />
            ))}
          </div>
        ) : (
          <svg viewBox={`0 0 ${FAULT_BINS} 60`} preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <polygon points={`0,60 ${model.bins.map((c, i) => `${i},${(60 - (c / model.max) * 52).toFixed(1)}`).join(" ")} ${FAULT_BINS - 1},60`}
              fill="rgba(220,38,38,0.2)" stroke="#dc2626" strokeWidth="1.25"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          </svg>
        )}
        {/* Highlight occurrences of the selected interlock */}
        {selTimes.map((sec, i) => (
          <div key={`hl-${i}`} className="absolute top-0 bottom-0"
            style={{ left: `${(sec / 86400) * 100}%`, width: 2, transform: "translateX(-50%)", background: "rgba(17,24,39,0.85)" }} />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 -mt-2">
        <span>00:00</span>
        {selectedId
          ? <span className="text-gray-600 font-medium">{selectedId} · {selTimes.length} marked</span>
          : <span>12:00</span>}
        <span>24:00</span>
      </div>

      <div>
        <SectionLabel icon={<AlertTriangle size={14} />} text="Most frequent interlocks — click to locate on the timeline" />
        <ul className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-100 overflow-hidden">
          {model.topIds.map(([id, n]) => {
            const desc = faultLabel(id);
            const active = selectedId === id;
            return (
              <li key={id}
                onClick={() => setSelectedId(active ? null : id)}
                className={`flex items-center justify-between gap-3 px-3 py-1.5 cursor-pointer transition-colors ${active ? "bg-gray-900/5" : "hover:bg-gray-50"}`}
                style={active ? { borderLeft: "3px solid rgba(17,24,39,0.85)" } : { borderLeft: "3px solid transparent" }}
              >
                <span className="min-w-0">
                  <span className="font-mono text-sm font-semibold">{id}</span>
                  <span className="text-xs text-gray-500 ml-2">{desc || "—"}</span>
                </span>
                <span className="text-xs text-gray-400 whitespace-nowrap">{n}×</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <SectionLabel icon={<Timer size={14} />} text="Busiest 15-min windows" />
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {model.busiest.map((b, i) => (
            <li key={i} className="text-sm text-gray-700">
              <span className="font-mono text-xs text-gray-600">{b.start}–{b.end}</span>
              <span className="text-gray-400 ml-1.5">{b.count}×</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ── Session tab (Module 5) ──────────────────────────────────────────────────
const RESTART_LABELS = { "cms-restart": "CMS restart", "initialize": "Initialize", "login-screen": "→ login screen" };

function SessionTab({ data }) {
  const logins = data?.logins || [];
  const failed = data?.failedLogins || [];
  const restarts = data?.restarts || [];
  const plans = data?.planLoads || [];

  // Session strip: each login → next login (last → window end)
  const strip = useMemo(() => {
    if (!logins.length) return null;
    const times = logins.map((l) => toSec(l.time));
    const extra = [...failed.map((f) => toSec(f.time)), ...restarts.map((r) => toSec(r.time))];
    const a = Math.max(0, Math.min(...times, ...(extra.length ? extra : times)) - 120);
    const b = Math.min(86400, Math.max(...times, ...(extra.length ? extra : times)) + 300);
    const span = Math.max(600, b - a);
    const pct = (s) => Math.max(0, Math.min(100, ((s - a) / span) * 100));
    const segs = logins.map((l, i) => {
      const start = toSec(l.time);
      const end = i + 1 < logins.length ? toSec(logins[i + 1].time) : a + span;
      return { app: l.app, time: l.time, technique: l.technique, left: pct(start), width: Math.max(0.6, pct(end) - pct(start)) };
    });
    return { a, b: a + span, pct, segs };
  }, [data]);

  if (!logins.length && !failed.length && !restarts.length) {
    return <p className="text-sm text-gray-400">No session activity in this file.</p>;
  }

  const restartCounts = restarts.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
  const apps = [...new Set(logins.map((l) => l.app))];

  return (
    <div className="space-y-5">
      {/* Failed logins — warning section at top */}
      {failed.length > 0 && (
        <div className="rounded-lg bg-red-50 ring-1 ring-red-200 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle size={15} /> {failed.length} failed login{failed.length !== 1 ? "s" : ""}
          </div>
          <ul className="mt-2 space-y-1">
            {failed.map((f, i) => (
              <li key={i} className="text-xs text-red-900/80 flex items-center gap-2">
                <span className="font-mono">{f.time}</span>
                <span className="font-semibold">{f.app || "?"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Session strip */}
      {strip && (
        <div>
          <SectionLabel icon={<LogIn size={14} />} text="Login sessions" />
          <div className="relative h-6 rounded-md overflow-hidden bg-gray-100">
            {strip.segs.map((s, i) => (
              <div key={i} title={`${s.app} from ${s.time}`}
                className="absolute top-0 bottom-0" style={{ left: `${s.left}%`, width: `${s.width}%`, background: appColor(s.app), borderRight: "1px solid rgba(255,255,255,0.5)" }} />
            ))}
            {failed.map((f, i) => {
              const l = strip.pct(toSec(f.time));
              if (l < 0 || l > 100) return null;
              return <div key={"f" + i} title={`failed ${f.time} ${f.app}`}
                className="absolute" style={{ top: 0, bottom: 0, left: `${l}%`, width: 2, transform: "translateX(-50%)", background: "#dc2626" }} />;
            })}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>{toHHMM(strip.a)}</span><span>{toHHMM(strip.b)}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-gray-500">
            {apps.map((app) => (
              <span key={app} className="flex items-center gap-1.5">
                <span style={{ width: 12, height: 9, borderRadius: 2, background: appColor(app) }} />{app}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Logins list */}
      {logins.length > 0 && (
        <Section icon={<LogIn size={14} />} title={`Logins (${logins.length})`}>
          {logins.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs text-gray-500">{l.time}</span>
                {l.user && (
                  <span className="text-sm font-medium flex items-center gap-1">
                    <LogIn size={12} className="text-gray-400" />{l.user}
                  </span>
                )}
                {l.app && l.app !== l.user && (
                  <span className="text-xs text-gray-500">{l.user ? "· " : ""}{l.app}</span>
                )}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Restarts + plan loads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {restarts.length > 0 && (
          <div className="rounded-lg ring-1 ring-gray-100 p-3">
            <SectionLabel icon={<RotateCcw size={14} />} text="Restarts" />
            <ul className="text-sm text-gray-700 space-y-1">
              {Object.entries(restartCounts).map(([k, n]) => (
                <li key={k} className="flex justify-between"><span>{RESTART_LABELS[k] || k}</span><span className="text-gray-400">{n}×</span></li>
              ))}
            </ul>
          </div>
        )}
        {plans.length > 0 && (
          <div className="rounded-lg ring-1 ring-gray-100 p-3">
            <SectionLabel icon={<Activity size={14} />} text="Plan loads" />
            <ul className="text-xs text-gray-600 space-y-1">
              {plans.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="font-mono text-gray-500">{p.time}</span>
                  <span className="truncate" title={p.planUid}>…{p.planUid.slice(-12)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ComingSoon({ module, what }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 text-gray-400">
      <RotateCcw size={28} className="mb-3 opacity-50" />
      <p className="text-sm">{module} will add {what} here.</p>
    </div>
  );
}
