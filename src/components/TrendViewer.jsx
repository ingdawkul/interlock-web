import React, { useState, useMemo, useEffect, useCallback } from "react";
import { TREND_CONFIG } from "./TrendConfig";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  CartesianGrid, ResponsiveContainer, ReferenceArea, ReferenceLine
} from "recharts";

// ── Constants outside component (never recreated) ────────────────────────────

const MACHINE_COLORS = [
  "#0072B2","#D55E00","#009E73","#CC79A7","#E69F00","#56B4E9",
  "#F0E442","#4E79A7","#59A14F","#E15759","#B07AA1",
  "#76B7B2","#FF9DA7","#9C755F","#BAB0AC","#000000",
];

// Human-readable short names for parameter display in the list
const PARAM_LABELS = {
  "NDCMotor::X1 primSecDevStats":           "X1 deviation",
  "NDCMotor::X2 primSecDevStats":           "X2 deviation",
  "NDCMotor::Y1 primSecDevStats":           "Y1 deviation",
  "NDCMotor::Y2 primSecDevStats":           "Y2 deviation",
  "NDCMotor::KVBladeX1 primSecDevStats":    "kV Blade X1",
  "NDCMotor::KVBladeX2 primSecDevStats":    "kV Blade X2",
  "NDCMotor::KVBladeY1 primSecDevStats":    "kV Blade Y1",
  "NDCMotor::KVBladeY2 primSecDevStats":    "kV Blade Y2",
  "NDCMotor::KVFilterFoil primSecDevStats": "kV Filter Foil",
  "NDCMotor::KVFilterShape primSecDevStats":"kV Filter Shape",
  "NDCMotor::PosTarget primSecDevStats":    "Pos Target",
  "NDCMotor::PosRotation primSecDevStats":  "Pos Rotation",
  "NDCMotor::PosIonChamber primSecDevStats":"Pos Ion Chamber",
  "NDCMotor::PosY primSecDevStats":         "Pos Y",
  "NDCMotor::PosEnergySwitch primDriftStats":"Energy Switch drift",
  "MLCController::logStatistics MLCCarriage_BankA_primSecDevStats": "MLC Bank A",
  "MLCController::logStatistics MLCCarriage_BankB_primSecDevStats": "MLC Bank B",
  "STNSF6GasCtrl::logStatistics SF6GaswaveGuidePressureStatistics": "SF6 Gas Pressure",
  "BGMSubNodeCntrl::logStatistics EGN_boardTemperature":             "EGN Board Temp",
  "STNPwrHandlerBase::logStatistics PowerAPD_Temperature":  "APD Temperature",
  "STNPwrHandlerBase::logStatistics PowerSPD_Temperature":  "SPD Temperature",
  "STNPwrHandlerBase::logStatistics PowerGPD_Temperature":  "GPD Temperature",
  "STNPwrHandlerBase::logStatistics GPD_ACFanStatistics":   "GPD Fan",
  "STNPwrHandlerBase::logStatistics SPD_ACFanStatistics":   "SPD Fan",
  "STNCoolingCtrl::logStatistics CoolingbendMagFlowHighStatistics":              "Bend Mag Flow",
  "STNCoolingCtrl::logStatistics CoolingcityWaterFlowHighStatistics":            "City Water Flow",
  "STNCoolingCtrl::logStatistics CoolingcityWaterTempStatistics":                "City Water Temp",
  "STNCoolingCtrl::logStatistics CoolingguideFlowFlowHighStatistics":            "Guide Flow",
  "STNCoolingCtrl::logStatistics CoolingklystronFlowHighStatistics":             "Klystron Flow",
  "STNCoolingCtrl::logStatistics CoolingklystronSolenoidFlowHighStatistics":     "Klystron Solenoid Flow",
  "STNCoolingCtrl::logStatistics CoolingprimaryCollimatorFlowHighStatistics":    "Primary Collimator Flow",
  "STNCoolingCtrl::logStatistics CoolingpumpOutletTempStatistics":               "Pump Outlet Temp",
  "STNCoolingCtrl::logStatistics CoolingtankInputTempStatistics":                "Tank Input Temp",
  "STNCoolingCtrl::logStatistics CoolingtargetFlowHighStatistics":               "Target Flow",
  "STNCoolingCtrl::logStatistics SlimcombineGuideSolenoidFlowHighStatistics":    "Slim Guide Solenoid Flow",
};

// Group params for structured list display
const PARAM_GROUPS = [
  { label: "Motors",    prefix: "NDCMotor::" },
  { label: "MLC",       prefix: "MLCController::" },
  { label: "Gas",       prefix: "STNSF6GasCtrl::" },
  { label: "BGM",       prefix: "BGMSubNodeCntrl::" },
  { label: "Power",     prefix: "STNPwrHandlerBase::" },
  { label: "Cooling",   prefix: "STNCoolingCtrl::" },
];

function getGroup(param) {
  for (const g of PARAM_GROUPS) {
    if (param.startsWith(g.prefix)) return g.label;
  }
  return "Other";
}

function getLabel(param) {
  return PARAM_LABELS[param] ?? param.split("::").pop();
}

function getThresholdState(paramName, dataPoints) {
  const cfg = TREND_CONFIG[paramName];
  if (!cfg || !dataPoints?.length) return "OK";
  let hasWarning = false;
  for (const point of dataPoints) {
    const avg = point.avg;
    if (avg == null) continue;
    if ((cfg.max !== undefined && avg > cfg.max) || (cfg.min !== undefined && avg < cfg.min))
      return "ERROR";
    if ((cfg.warningMax !== undefined && avg > cfg.warningMax) || (cfg.warningMin !== undefined && avg < cfg.warningMin))
      hasWarning = true;
  }
  return hasWarning ? "WARNING" : "OK";
}

// Pad a y-domain so min never equals max (chart would collapse)
function padDomain(min, max) {
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("no-NO");
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleString("no-NO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

// ── Stable sub-components (defined outside to prevent remount) ───────────────

const TimeTick = ({ x, y, payload }) => {
  const d = new Date(payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text y={0} dy={13} textAnchor="middle" fontSize={11} fill="#555">
        {d.toLocaleDateString("no-NO")}
      </text>
      <text y={0} dy={26} textAnchor="middle" fontSize={10} fill="#888">
        {d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
      </text>
    </g>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export default function TrendViewer({ trendData, initialParam }) {
  const [selected,       setSelected]       = useState(initialParam ?? null);
  const [query,          setQuery]          = useState("");
  const [showRange,      setShowRange]      = useState(true);
  const [showThresholds, setShowThresholds] = useState(true);
  const [xAxisMode,      setXAxisMode]      = useState("time");
  const [visibleMachines,setVisibleMachines]= useState({});

  // ── Sync with external open-from-Report trigger ──────────────────────────
  useEffect(() => { if (initialParam) setSelected(initialParam); }, [initialParam]);

  // ── Scroll param into view in list ──────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    document.getElementById(`param-${CSS.escape(selected)}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  // ── Sorted parameter keys ────────────────────────────────────────────────
  const parameters = useMemo(() => Object.keys(trendData || {}).sort(), [trendData]);

  // ── Per-param threshold states (computed once, not on every render) ──────
  const paramStates = useMemo(() => {
    const map = {};
    for (const p of parameters) map[p] = getThresholdState(p, trendData[p]);
    return map;
  }, [parameters, trendData]);

  // ── Filtered + grouped params for the list ───────────────────────────────
  const filteredGroups = useMemo(() => {
    const q = query.toLowerCase();
    const filtered = parameters.filter(p =>
      getLabel(p).toLowerCase().includes(q) || p.toLowerCase().includes(q)
    );
    const groups = {};
    for (const p of filtered) {
      const g = getGroup(p);
      if (!groups[g]) groups[g] = [];
      groups[g].push(p);
    }
    return groups;
  }, [parameters, query]);

  // ── Data pipeline ────────────────────────────────────────────────────────
  const rawData = selected ? (trendData[selected] ?? []) : [];

  const indexedData = useMemo(() =>
    [...rawData]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d, i) => ({ ...d, index: i }))
  , [rawData]);

  const dataByMachine = useMemo(() => {
    if (!selected) return {};
    return indexedData.reduce((acc, pt) => {
      const m = pt.machine || "UNKNOWN";
      if (!acc[m]) acc[m] = [];
      acc[m].push(pt);
      return acc;
    }, {});
  }, [indexedData, selected]);

  // Reset visible machines when param changes
  useEffect(() => {
    if (!selected) return;
    const map = {};
    Object.keys(dataByMachine).forEach(m => (map[m] = true));
    setVisibleMachines(map);
  }, [selected, dataByMachine]);

  const visibleDataByMachine = useMemo(() =>
    Object.fromEntries(
      Object.entries(dataByMachine).filter(([m]) => visibleMachines[m] !== false)
    )
  , [dataByMachine, visibleMachines]);

  const machineColorMap = useMemo(() => {
    const map = {};
    Object.keys(dataByMachine).forEach((m, i) => { map[m] = MACHINE_COLORS[i % MACHINE_COLORS.length]; });
    return map;
  }, [dataByMachine]);

  // Uniform index mode data
  const uniformData = useMemo(() => {
    const machines = Object.entries(visibleDataByMachine);
    if (!machines.length) return [];
    const maxLen = Math.max(...machines.map(([, arr]) => arr.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const pt = { index: i };
      for (const [m, pts] of machines) pt[m] = pts[i] ?? null;
      return pt;
    });
  }, [visibleDataByMachine]);

  const xDomain = useMemo(() => {
    const maxLen = Math.max(0, ...Object.values(visibleDataByMachine).map(a => a.length));
    return [0, Math.max(0, maxLen - 1)];
  }, [visibleDataByMachine]);

  // Y domain (memoised, padded)
  const thresholdConfig = selected ? TREND_CONFIG[selected] : null;
  const unit = thresholdConfig?.unit ?? "";

  const [yMin, yMax] = useMemo(() => {
    if (!selected) return [0, 1];
    const vals = [];
    for (const pts of Object.values(visibleDataByMachine)) {
      for (const d of pts) {
        if (d.avg != null) vals.push(d.avg);
        if (showRange) {
          if (d.min != null) vals.push(d.min);
          if (d.max != null) vals.push(d.max);
        }
      }
    }
    if (showThresholds && thresholdConfig) {
      const { min, max, warningMin, warningMax } = thresholdConfig;
      [min, max, warningMin, warningMax].forEach(v => { if (v !== undefined) vals.push(v); });
    }
    if (!vals.length) return [0, 1];
    return padDomain(Math.min(...vals), Math.max(...vals));
  }, [selected, visibleDataByMachine, showRange, showThresholds, thresholdConfig]);

  // Date range summary for selected param
  const dateRange = useMemo(() => {
    const all = Object.values(visibleDataByMachine).flat();
    if (!all.length) return null;
    const ts = all.map(d => d.timestamp).filter(Boolean);
    if (!ts.length) return null;
    const lo = Math.min(...ts), hi = Math.max(...ts);
    return lo === hi ? formatDate(lo) : `${formatDate(lo)} – ${formatDate(hi)}`;
  }, [visibleDataByMachine]);

  const totalPoints = useMemo(() =>
    Object.values(visibleDataByMachine).reduce((s, a) => s + a.length, 0)
  , [visibleDataByMachine]);

  // Chart key — force remount only when truly necessary
  const chartKey = useMemo(() => {
    const vis = Object.entries(visibleMachines).filter(([,v]) => v).map(([k]) => k).sort().join("|");
    return `${selected}|${xAxisMode}|${vis}`;
  }, [selected, xAxisMode, visibleMachines]);

  // ── Legend click: first click = solo, click again = reset all ───────────
  const handleLegendClick = useCallback(e => {
    const key = e.value;
    setVisibleMachines(prev => {
      const all = Object.keys(prev);
      const visible = all.filter(m => prev[m]);
      // If this machine is already solo → reset all
      if (visible.length === 1 && visible[0] === key) {
        return Object.fromEntries(all.map(m => [m, true]));
      }
      // Otherwise solo this machine
      return Object.fromEntries(all.map(m => [m, m === key]));
    });
  }, []);

  // ── Tooltips (stable inline render props, not component instances) ────────
  const renderTimeTooltip = useCallback(({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    if (!pt) return null;
    return (
      <div style={{ background: "#1e293b", padding: "10px 14px", borderRadius: 8, color: "#f1f5f9", minWidth: 180 }}>
        {pt.machine && (
          <div style={{ fontSize: 13, fontWeight: 700, color: payload[0].stroke, marginBottom: 4 }}>
            {pt.machine}
          </div>
        )}
        {pt.timestamp && (
          <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{formatDateTime(pt.timestamp)}</div>
        )}
        <div style={{ fontSize: 15, fontWeight: 600 }}>avg: {pt.avg}{unit ? " " + unit : ""}</div>
        {showRange && pt.min != null && pt.max != null && (
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>
            min: {pt.min}  max: {pt.max}
          </div>
        )}
      </div>
    );
  }, [unit, showRange]);

  const renderIndexTooltip = useCallback(({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: "#1e293b", padding: "10px 14px", borderRadius: 8, color: "#f1f5f9", minWidth: 200 }}>
        {payload.map((entry, i) => {
          const pt = entry.payload?.[entry.name];
          if (!pt) return null;
          return (
            <div key={i} style={{ marginBottom: i < payload.length - 1 ? 8 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: entry.stroke }}>{entry.name}</div>
              {pt.timestamp && (
                <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 2 }}>{formatDateTime(pt.timestamp)}</div>
              )}
              <div style={{ fontSize: 15, fontWeight: 600 }}>avg: {pt.avg}{unit ? " " + unit : ""}</div>
              {showRange && pt.min != null && pt.max != null && (
                <div style={{ fontSize: 12, opacity: 0.8 }}>min: {pt.min}  max: {pt.max}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [unit, showRange]);

  // ─────────────────────────────────────────────────────────────────────────

  const machineCount = Object.keys(visibleDataByMachine).length;

  return (
    <div className="bg-white rounded-2xl p-4">
      <h2 className="font-bold text-lg mb-4">Trend analysis</h2>

      <div className="flex gap-4" style={{height: "min(calc(100vh - 120px), 900px)" }}>

        {/* ── Parameter list ─────────────────────────────────────────────── */}
        <div className="w-80 shrink-0 flex flex-col border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search parameters…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="overflow-y-auto flex-1 p-1.5">
            {Object.entries(filteredGroups).map(([group, params]) => (
              <div key={group} className="mb-2">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {group}
                </div>
                {params.map(p => {
                  const state = paramStates[p];
                  const count = trendData[p]?.length ?? 0;
                  const isSelected = selected === p;
                  return (
                    <div
                      id={`param-${CSS.escape(p)}`}
                      key={p}
                      onClick={() => setSelected(p)}
                      className={`cursor-pointer px-2.5 py-2 rounded-lg flex justify-between items-center gap-2 mb-0.5 transition-colors ${
                        isSelected
                          ? "bg-blue-100 text-blue-900"
                          : state === "ERROR"   ? "bg-red-50 text-red-800 hover:bg-red-100"
                          : state === "WARNING" ? "bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                          : "hover:bg-gray-100 text-gray-800"
                      }`}
                    >
                      <span className="text-sm font-medium leading-tight">{getLabel(p)}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {count > 0 && (
                          <span className="text-[10px] text-gray-400">{count}</span>
                        )}
                        {state === "ERROR" && (
                          <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full">ERR</span>
                        )}
                        {state === "WARNING" && (
                          <span className="text-[10px] font-bold text-white bg-yellow-500 px-1.5 py-0.5 rounded-full">WARN</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* ── Chart panel ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
              Select a parameter to view the trend
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-3 shrink-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-800">{getLabel(selected)}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 font-mono leading-tight">{selected}</p>
                  </div>
                  {dateRange && (
                    <div className="text-right shrink-0">
                      <div className="text-xs text-gray-500">{dateRange}</div>
                      <div className="text-xs text-gray-400">{totalPoints} data points</div>
                    </div>
                  )}
                </div>

                {/* Toolbar */}
                <div className="flex gap-2 mt-2 flex-wrap">
                  {[
                    { label: "Min / Max",        active: showRange,      toggle: () => setShowRange(v => !v) },
                    { label: "Thresholds",        active: showThresholds, toggle: () => setShowThresholds(v => !v) },
                    { label: xAxisMode === "time" ? "Even axis" : "Time axis",
                                                  active: xAxisMode === "index",
                                                  toggle: () => setXAxisMode(v => v === "time" ? "index" : "time") },
                  ].map(({ label, active, toggle }) => (
                    <button
                      key={label}
                      onClick={toggle}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart */}
              <div className="flex-1 min-h-0">
                {machineCount === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                    No machines selected
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      key={chartKey}
                      data={xAxisMode === "index" ? uniformData : undefined}
                      margin={{ top: 0, right: 75, left: 10, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

                      {/* Threshold zones */}
                      {showThresholds && thresholdConfig && (() => {
                        const { min, max, warningMin, warningMax } = thresholdConfig;
                        return (
                          <>
                            {max     !== undefined && <ReferenceArea y1={max}        y2={yMax}        fill="#dc2626" fillOpacity={0.10} />}
                            {warningMax !== undefined && max !== undefined && <ReferenceArea y1={warningMax} y2={max}         fill="#f59e0b" fillOpacity={0.12} />}
                            {warningMin !== undefined && min !== undefined && <ReferenceArea y1={min}        y2={warningMin}  fill="#f59e0b" fillOpacity={0.12} />}
                            {min     !== undefined && <ReferenceArea y1={yMin}        y2={min}         fill="#dc2626" fillOpacity={0.10} />}

                            {max !== undefined && (
                              <ReferenceLine y={max} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 3"
                                label={{ value: `Max ${max}${unit ? " "+unit : ""}`, position: "right", fill: "#dc2626", fontSize: 11 }} />
                            )}
                            {min !== undefined && (
                              <ReferenceLine y={min} stroke="#dc2626" strokeWidth={2} strokeDasharray="6 3"
                                label={{ value: `Min ${min}${unit ? " "+unit : ""}`, position: "right", fill: "#dc2626", fontSize: 11 }} />
                            )}
                            {warningMax !== undefined && (
                              <ReferenceLine y={warningMax} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3"
                                label={{ value: `Warn ${warningMax}${unit ? " "+unit : ""}`, position: "right", fill: "#d97706", fontSize: 11 }} />
                            )}
                            {warningMin !== undefined && (
                              <ReferenceLine y={warningMin} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3"
                                label={{ value: `Warn ${warningMin}${unit ? " "+unit : ""}`, position: "right", fill: "#d97706", fontSize: 11 }} />
                            )}
                          </>
                        );
                      })()}

                      {xAxisMode === "time" ? (
                        <XAxis dataKey="timestamp" type="number" scale="time" domain={["auto", "auto"]}
                          tick={<TimeTick />} height={44} allowDataOverflow={false} />
                      ) : (
                        <XAxis dataKey="index" type="number" scale="linear" domain={xDomain}
                          allowDataOverflow={false} tickFormatter={v => `#${v}`}
                          tick={{ fontSize: 11 }} height={28} />
                      )}

                      <YAxis
                        domain={[yMin, yMax]}
                        allowDataOverflow={false}
                        tickFormatter={v => typeof v === "number" ? v.toFixed(2) : v}
                        label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#666", fontSize: 12 } : undefined}
                        tick={{ fontSize: 11 }}
                        width={60}
                      />

                      <Tooltip
                        content={xAxisMode === "index" ? renderIndexTooltip : renderTimeTooltip}
                        isAnimationActive={false}
                        cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }}
                      />

                      <Legend
                        onClick={handleLegendClick}
                        wrapperStyle={{ paddingTop: 8, fontSize: 12 }}
                        formatter={(value) => (
                          <span style={{ color: visibleMachines[value] === false ? "#ccc" : "#374151" }}>
                            {value}
                          </span>
                        )}
                      />

                      {/* Lines */}
                      {xAxisMode === "index"
                        ? Object.keys(visibleDataByMachine).map(machine => {
                            const color = machineColorMap[machine];
                            return (
                              <React.Fragment key={machine}>
                                {showRange && (
                                  <>
                                    <Line data={uniformData} type="monotone"
                                      dataKey={d => d[machine]?.min ?? null}
                                      stroke={color} strokeDasharray="3 3" strokeWidth={1}
                                      dot={false} legendType="none" isAnimationActive={false} />
                                    <Line data={uniformData} type="monotone"
                                      dataKey={d => d[machine]?.max ?? null}
                                      stroke={color} strokeDasharray="3 3" strokeWidth={1}
                                      dot={false} legendType="none" isAnimationActive={false} />
                                  </>
                                )}
                                <Line data={uniformData} type="monotone"
                                  dataKey={d => d[machine]?.avg ?? null}
                                  name={machine} stroke={color} strokeWidth={2}
                                  dot={{ r: 3, strokeWidth: 0, fill: color }}
                                  activeDot={{ r: 5 }}
                                  connectNulls={false} isAnimationActive={false} />
                              </React.Fragment>
                            );
                          })
                        : Object.entries(visibleDataByMachine).map(([machine, points]) => {
                            const color = machineColorMap[machine];
                            const pts = points.map((p, i) => ({ ...p, index: i }));
                            return (
                              <React.Fragment key={machine}>
                                {showRange && (
                                  <>
                                    <Line data={pts} type="monotone" dataKey="min"
                                      stroke={color} strokeDasharray="3 3" strokeWidth={1}
                                      dot={false} legendType="none" isAnimationActive={false} />
                                    <Line data={pts} type="monotone" dataKey="max"
                                      stroke={color} strokeDasharray="3 3" strokeWidth={1}
                                      dot={false} legendType="none" isAnimationActive={false} />
                                  </>
                                )}
                                <Line data={pts} type="monotone" dataKey="avg"
                                  name={machine} stroke={color} strokeWidth={2}
                                  dot={{ r: 3, strokeWidth: 0, fill: color }}
                                  activeDot={{ r: 5 }}
                                  connectNulls={false} isAnimationActive={false} />
                              </React.Fragment>
                            );
                          })
                      }
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}