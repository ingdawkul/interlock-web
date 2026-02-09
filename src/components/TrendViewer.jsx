import React, { useState, useMemo, useEffect } from "react";
import { TREND_CONFIG } from "./TrendConfig";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine
} from "recharts";

export default function TrendViewer({ trendData }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [showRange, setShowRange] = useState(true);
  const [showThresholds, setShowThresholds] = useState(true);
  const [xAxisMode, setXAxisMode] = useState("time"); // "time" eller "index"
  const [visibleMachines, setVisibleMachines] = useState({});
  

  const MACHINE_COLORS = [
    "#0072B2","#D55E00","#009E73","#CC79A7","#E69F00","#56B4E9",
    "#000000","#F0E442","#4E79A7","#59A14F","#E15759","#B07AA1",
    "#76B7B2","#FF9DA7","#9C755F","#BAB0AC"
  ];

  const thresholdConfig = selected ? TREND_CONFIG[selected] : null;
  const unit = thresholdConfig?.unit ?? "";

  const parameters = useMemo(() => Object.keys(trendData || {}).sort(), [trendData]);
  const filteredParams = parameters.filter(p => p.toLowerCase().includes(query.toLowerCase()));
  const data = selected ? trendData[selected] : [];

  // Sorter og gi index for hver datapunkt (for index-modus)
  const indexedData = useMemo(() => {
    return data
      .slice()
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((d, i) => ({ ...d, index: i }));
  }, [data]);

  // Del data på maskiner
  const dataByMachine = useMemo(() => {
    if (!selected) return {};
    return indexedData.reduce((acc, point) => {
      const m = point.machine || "UNKNOWN";
      if (!acc[m]) acc[m] = [];
      acc[m].push(point);
      return acc;
    }, {});
  }, [indexedData, selected]);

  const visibleDataByMachine = useMemo(() => {
  return Object.fromEntries(
    Object.entries(dataByMachine).filter(
      ([machine]) => visibleMachines[machine] !== false
    )
  );
}, [dataByMachine, visibleMachines]);


  // X-akse: 0 -> lengste maskin
const xDomain = useMemo(() => {
  const lengths = Object.values(visibleDataByMachine).map(arr => arr.length);
  const maxLength = lengths.length ? Math.max(...lengths) : 0;
  return [0, maxLength - 1];
}, [visibleDataByMachine]);


const TimeTick = ({ x, y, payload }) => {
const d = new Date(payload.value);
return (
    <g transform={`translate(${x},${y})`}>
    <text y={0} dy={12} textAnchor="middle" fontSize={11} fill="#555">
        {d.toLocaleDateString("no-NO")}
    </text>
    <text y={0} dy={26} textAnchor="middle" fontSize={10} fill="#777">
        {d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" })}
    </text>
    </g>
);
};

const machineCount = Object.keys(visibleDataByMachine).length;

  // Lag “uniform indexed data” for index-modus
const uniformIndexedData = useMemo(() => {
  const machines = Object.entries(visibleDataByMachine);
  if (!machines.length) return [];

  const maxLen = Math.max(...machines.map(([, arr]) => arr.length));

  return Array.from({ length: maxLen }, (_, i) => {
    const point = { index: i };
    for (const [machine, points] of machines) {
      point[machine] = points[i] ?? null;
    }
    return point;
  });
}, [visibleDataByMachine]);



  // Tooltip som viser kun relevante punkter
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  // Filtrer bort min/max-linjer
   const avgPayloads = payload.filter(
    p => p.name && visibleMachines[p.name] !== false
    );


  if (!avgPayloads.length) return null;

  // ================= TIME-MODUS =================
  if (xAxisMode === "time") {
    const item = avgPayloads[0];
    const p = item.payload;
    if (!p || p.avg == null) return null;

    const date = p.timestamp ? new Date(p.timestamp) : null;

    return (
      <div className="bg-gray-100 border rounded p-2 text-sm">
        {date && (
          <div className="font-semibold mb-1">
            {date.toLocaleString("no-NO")}
          </div>
        )}

        <div style={{ color: item.stroke }}>
          <div className="font-semibold">{item.name}</div>
          <div>Avg: {p.avg}</div>
          <div>Min: {p.min}</div>
          <div>Max: {p.max}</div>
        </div>
      </div>
    );
  }

  // ================= INDEX-MODUS =================
  const row = avgPayloads[0].payload;

  let date = null;
  for (const item of avgPayloads) {
    const p = row[item.name];
    if (p?.timestamp) {
      date = new Date(p.timestamp);
      break;
    }
  }

  return (
    <div className="bg-gray-100 border rounded p-2 text-sm">
      {date && (
        <div className="font-semibold mb-1">
          {date.toLocaleString("no-NO")}
        </div>
      )}

      <div className="text-xs text-gray-500 mb-1">
        Index #{row.index}
      </div>

      {avgPayloads.map((item, idx) => {
        const p = row[item.name];
        if (!p || p.avg == null) return null;

        return (
          <div key={idx} style={{ color: item.stroke }}>
            <div className="font-semibold">{item.name}</div>
            <div>Avg: {p.avg}</div>
            <div>Min: {p.min}</div>
            <div>Max: {p.max}</div>
          </div>
        );
      })}
    </div>
  );
};

useEffect(() => {
if (!selected) return;

const machines = Object.keys(dataByMachine);
const map = {};
machines.forEach(m => (map[m] = true));
setVisibleMachines(map);
}, [selected, dataByMachine]);


function getThresholdState(paramName, data = []) {
const cfg = TREND_CONFIG[paramName];
if (!cfg || data.length === 0) return "OK";

let hasWarning = false;

for (const point of data) {
    const avg = point.avg;
    if (avg == null) continue;

    if ((cfg.max !== undefined && avg > cfg.max) || (cfg.min !== undefined && avg < cfg.min)) {
    return "ERROR";
    }

    if ((cfg.warningMax !== undefined && avg > cfg.warningMax) || (cfg.warningMin !== undefined && avg < cfg.warningMin)) {
    hasWarning = true;
    }
}

return hasWarning ? "WARNING" : "OK";
}

function getYDomain() {
  if (!selected) return ["auto", "auto"];

  let allValues = [];

  for (const points of Object.values(visibleDataByMachine)) {
    for (const d of points) {
      if (d.avg != null) allValues.push(d.avg);
      if (showRange) {
        if (d.min != null) allValues.push(d.min);
        if (d.max != null) allValues.push(d.max);
      }
    }
  }

  if (showThresholds && thresholdConfig) {
    const { min, max, warningMin, warningMax } = thresholdConfig;
    if (min !== undefined) allValues.push(min);
    if (max !== undefined) allValues.push(max);
    if (warningMin !== undefined) allValues.push(warningMin);
    if (warningMax !== undefined) allValues.push(warningMax);
  }

  return allValues.length
    ? [Math.min(...allValues), Math.max(...allValues)]
    : ["auto", "auto"];
}

const [yMin, yMax] = getYDomain();

const machineColorMap = useMemo(() => {
  const map = {};
  Object.keys(dataByMachine).forEach((m, i) => {
    map[m] = MACHINE_COLORS[i % MACHINE_COLORS.length];
  });
  return map;
}, [dataByMachine]);

const chartKey = useMemo(() => {
  const visible = Object.entries(visibleMachines)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .join("|");

  return `${selected}-${xAxisMode}-${visible}`;
}, [visibleMachines, xAxisMode, selected]);

const chartData = useMemo(() => {
  if (xAxisMode === "index") {
    return uniformIndexedData;
  }

  // time-modus → flatten synlige maskiner
  return Object.values(visibleDataByMachine).flat();
}, [xAxisMode, uniformIndexedData, visibleDataByMachine]);

function TimeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const item = payload[0];
  const data = item.payload;
  if (!data) return null;

  const date = data.timestamp ? new Date(data.timestamp) : null;

  return (
    <div style={{
      background: "#111",
      padding: "10px",
      borderRadius: "6px",
      color: "#fff"
    }}>
      {/* Bruk maskinnavnet fra item.payload.machine som fallback */}
      {item.name && (
        <div style={{ fontSize: 18, fontWeight: 700, color: item.stroke, marginBottom: 4 }}>
          {item.payload.machine || item.name}  {/* Her er fallbacken */}
        </div>
      )}

      {date && (
        <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.85, marginBottom: 4 }}>
          {date.toLocaleDateString("no-NO")}{" "}
          {date.toLocaleTimeString("no-NO", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
          })}
        </div>
      )}

      <div style={{ fontSize: 16 }}>
        Avg: {data.avg}
        {showRange && data.min != null && data.max != null && (
          <>
            <div>Min: {data.min}</div>
            <div>Max: {data.max}</div>
          </>
        )}
      </div>
    </div>
  );
}


function IndexTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div style={{
      background: "#111",
      padding: "10px",
      borderRadius: "6px",
      color: "#fff"
    }}>
      {payload.map((entry, i) => {
        const machine = entry.name;
        const data = entry.payload[machine];
        if (!data) return null;

        const date = data.timestamp ? new Date(data.timestamp) : null;

        return (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: entry.stroke }}>
              {machine}
            </div>

            {date && (
              <div style={{ fontSize: 14, fontWeight: 500, opacity: 0.85 }}>
                {date.toLocaleDateString("no-NO")}{" "}
                {date.toLocaleTimeString("no-NO", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </div>
            )}

            <div style={{ fontSize: 16 }}>
              Avg: {data.avg}
              {showRange && data.min != null && data.max != null && (
                <>
                  <div>Min: {data.min}</div>
                  <div>Max: {data.max}</div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

  return (
    <div className="bg-white panel rounded-2xl p-4">
      <h2 className="font-bold text-lg mb-3">Trend analysis</h2>
      <div className="flex gap-4">
        {/* Parameterliste */}
        <div className="w-1/3 max-h-[600px] overflow-y-auto border rounded-xl p-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search parameters..."
            className="w-full mb-2 px-3 py-2 border rounded-xl"
          />
          <ul className="space-y-1 text-sm">
            {filteredParams.map(p => {
              const state = getThresholdState(p, trendData[p]);
              return (
                <li
                  key={p}
                  onClick={() => setSelected(p)}
                  className={`cursor-pointer p-2 rounded-lg flex justify-between items-center ${
                    selected === p
                      ? "bg-blue-100 font-semibold"
                      : state === "ERROR"
                      ? "bg-red-100 text-red-800 font-semibold"
                      : state === "WARNING"
                      ? "bg-yellow-100 text-yellow-800 font-semibold"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <span>{p}</span>
                  {state !== "OK" && (
                    <span
                      className={`text-xs text-white px-2 py-0.5 rounded-full ${
                        state === "ERROR" ? "bg-red-500" : "bg-yellow-500"
                      }`}
                    >
                      {state}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {/* Graf */}
        <div className="w-2/3 h-[600px]">
          {!selected && (
            <div className="h-full flex items-center justify-center text-gray-500">
              Select a parameter to view the trend
            </div>
          )}
          {selected && (
            <>
              <h3 className="font-semibold mb-2 flex items-center gap-4">
                {selected}
                <button
                  onClick={() => setShowRange(v => !v)}
                  aria-pressed={showRange}
                  className={`px-3 py-1 rounded-2xl border border-orange-500 ${
                    showRange ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {showRange ? "Hide min / max" : "Show min / max"}
                </button>

                <button
                  onClick={() => setShowThresholds(v => !v)}
                  aria-pressed={showThresholds}
                  className={`px-3 py-1 rounded-2xl border border-orange-500 ${
                    showThresholds ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {showThresholds ? "Hide threshold lines" : "Show threshold lines"}
                </button>

                <button
                  onClick={() => setXAxisMode(v => (v === "time" ? "index" : "time"))}
                  className={`px-3 py-1 rounded-2xl border border-orange-500 ${
                    xAxisMode === "time" ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {xAxisMode === "time" ? "Show evenly distributed axis" : "Show time-based axis"}
                </button>
              </h3>

              <ResponsiveContainer width="100%" height="100%">
                {Object.keys(visibleDataByMachine).length === 0 && (
                <div className="h-full flex items-center justify-center text-gray-400">
                    None machines selected
                </div>
                )}

                <LineChart key={chartKey} data={chartData}>


                  <CartesianGrid strokeDasharray="3 3" />

                  {/* Terskler */}
                  {showThresholds && thresholdConfig && (
                    <>
                      {thresholdConfig.max !== undefined && (
                        <ReferenceArea y1={thresholdConfig.max} y2={yMax} fill="#DC2626" fillOpacity={0.16} />
                      )}
                      {thresholdConfig.warningMax !== undefined && thresholdConfig.max !== undefined && (
                        <ReferenceArea y1={thresholdConfig.warningMax} y2={thresholdConfig.max} fill="#F59E0B" fillOpacity={0.22} />
                      )}
                      {thresholdConfig.warningMin !== undefined && thresholdConfig.min !== undefined && (
                        <ReferenceArea y1={thresholdConfig.min} y2={thresholdConfig.warningMin} fill="#F59E0B" fillOpacity={0.22} />
                      )}
                      {thresholdConfig.min !== undefined && (
                        <ReferenceArea y1={yMin} y2={thresholdConfig.min} fill="#DC2626" fillOpacity={0.16} />
                      )}

                      {["min", "max"].map(k =>
                        thresholdConfig[k] !== undefined && (
                          <ReferenceLine
                            key={k}
                            y={thresholdConfig[k]}
                            stroke="#DC2626"
                            strokeWidth={3}
                            className="threshold-error"
                            label={{
                              value: `${k.charAt(0).toUpperCase() + k.slice(1)} ${thresholdConfig[k]}${unit ? " " + unit : ""}`,
                              position: "right",
                              fill: "#DC2626",
                              fontSize: 12
                            }}
                          />
                        )
                      )}
                      {["warningMin", "warningMax"].map(k =>
                        thresholdConfig[k] !== undefined && (
                          <ReferenceLine
                            key={k}
                            y={thresholdConfig[k]}
                            stroke="#F59E0B"
                            strokeWidth={3}
                            className="threshold-warning"
                            label={{
                              value: `Warn ${thresholdConfig[k]}${unit ? " " + unit : ""}`,
                              position: "right",
                              fill: "#F59E0B",
                              fontSize: 11
                            }}
                          />
                        )
                      )}
                    </>
                  )}

                  {xAxisMode === "time" ? (
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      scale="time"
                      domain={["auto", "auto"]}
                      tick={<TimeTick />}
                      allowDataOverflow={false}
                    />
                  ) : (
                    <XAxis
                      dataKey="index"
                      type="number"
                      scale="linear"
                      domain={xDomain}
                      allowDataOverflow={false}
                      tickFormatter={v => `#${v}`}
                      tick={{ fontSize: 11 }}
                    />
                  )}

                  <YAxis allowDataOverflow={false}
                    domain={[yMin, yMax]}
                    tickFormatter={v => (typeof v === "number" ? v.toFixed(2) : v)}
                    label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#555" } : undefined}
                    />


                <Tooltip
                content={xAxisMode === "index" ? <IndexTooltip /> : <TimeTooltip  />}
                shared={xAxisMode === "index" || machineCount === 1}
                cursor={xAxisMode === "index" ? { stroke: "#999", strokeDasharray: "3 3" } : false}
                />

                <Legend
                onClick={e => {
                const key = e.value;

                setVisibleMachines(prev => {
                  const machines = Object.keys(prev);
                  const isOnlyOneVisible =
                    machines.filter(m => prev[m]).length === 1 && prev[key];

      // SOLO → reset alle
      if (isOnlyOneVisible) {
        const reset = {};
        machines.forEach(m => (reset[m] = true));
        return reset;
      }

      // SOLO hvis klikker på aktiv når flere er synlige
      if (prev[key]) {
        const solo = {};
        machines.forEach(m => (solo[m] = m === key));
        return solo;
      }

      // Normal toggle
      return {
        ...prev,
        [key]: !prev[key]
      };
    });
  }}
/>



{ xAxisMode === "index"
  ? Object.keys(visibleDataByMachine).map((machine, idx) => {
      const color = machineColorMap[machine];

      return (
        <React.Fragment key={machine}>
          {showRange && (
            <>
              <Line
                data={uniformIndexedData}
                type="monotone"
                dataKey={d => d[machine]?.min ?? null}
                stroke={color}
                strokeDasharray="4 4"
                dot={false}
                legendType="none"
                isAnimationActive={true}
                
              />
              <Line
                data={uniformIndexedData}
                type="monotone"
                dataKey={d => d[machine]?.max ?? null}
                stroke={color}
                strokeDasharray="4 4"
                dot={false}
                legendType="none"
                isAnimationActive={true}
              />
            </>
          )}
          <Line
            data={uniformIndexedData}
            type="monotone"
            dataKey={d => d[machine]?.avg ?? null}
            name={machine}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
            isAnimationActive={true}
          />
        </React.Fragment>
      );
    })
  : Object.entries(visibleDataByMachine).map(([machine, points], idx) => {
      const pointsWithIndex = points.map((p, i) => ({ ...p, index: i }));
      const color = machineColorMap[machine];

      return (
        <React.Fragment key={machine}>
          {showRange && (
            <>
              <Line data={pointsWithIndex} type="monotone" dataKey="min" stroke={color} strokeDasharray="4 4" dot={false} legendType="none" isAnimationActive={true} />
              <Line data={pointsWithIndex} type="monotone" dataKey="max" stroke={color} strokeDasharray="4 4" dot={false} legendType="none" isAnimationActive={true} />
            </>
          )}
          <Line
            data={pointsWithIndex}
            type="monotone"
            dataKey="avg"
            name={machine}
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            connectNulls={false}
            isAnimationActive={true}
          />
        </React.Fragment>
      );
    })
}


                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
