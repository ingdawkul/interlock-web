import React, { useState, useMemo } from "react";
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

  const dataByMachine = useMemo(() => {
    if (!selected) return {};
    return data.reduce((acc, point) => {
      const m = point.machine || "UNKNOWN";
      if (!acc[m]) acc[m] = [];
      acc[m].push(point);
      return acc;
    }, {});
  }, [data, selected]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    const date = new Date(point.timestamp);

    return (
      <div className="bg-gray-100 border rounded p-2 text-sm">
        <div className="font-semibold mb-1">{date.toLocaleString("no-NO")}</div>
        {payload.map((item, idx) => {
          if (item.dataKey !== "avg") return null;
          const p = item.payload;
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

  function getThresholdState(paramName, data = []) {
    const cfg = TREND_CONFIG[paramName];
    if (!cfg || data.length === 0) return "OK";

    const last = data[data.length - 1];
    const { avg, min, max } = last;

    if ((cfg.max !== undefined && avg > cfg.max) || (cfg.min !== undefined && avg < cfg.min))
      return "ERROR";

    if ((cfg.warningMax !== undefined && max > cfg.warningMax) || (cfg.warningMin !== undefined && min < cfg.warningMin))
      return "WARNING";

    return "OK";
  }

  function getYDomain() {
    if (!selected || !data.length) return ["auto", "auto"];

    let allValues = data.flatMap(d => [d.min, d.avg, d.max]);

    if (showThresholds && thresholdConfig) {
      const { min, max, warningMin, warningMax } = thresholdConfig;
      if (min !== undefined) allValues.push(min);
      if (max !== undefined) allValues.push(max);
      if (warningMin !== undefined) allValues.push(warningMin);
      if (warningMax !== undefined) allValues.push(warningMax);
    }

    return [Math.min(...allValues), Math.max(...allValues)];
  }

  return (
    <div className="bg-white panel rounded-2xl p-4">
      <h2 className="font-bold text-lg mb-3">Trend-analyse</h2>
      <div className="flex gap-4">
        {/* Parameterliste */}
        <div className="w-1/3 max-h-[600px] overflow-y-auto border rounded-xl p-2">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Søk parameter..."
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
              Velg en parameter for å vise trend
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
                  {showRange ? "Skjul min / max" : "Vis min / max"}
                </button>

                <button
                  onClick={() => setShowThresholds(v => !v)}
                  aria-pressed={showThresholds}
                  className={`px-3 py-1 rounded-2xl border border-orange-500 ${
                    showThresholds ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {showThresholds ? "Skjul terskellinjer" : "Vis terskellinjer"}
                </button>

                <button
                  onClick={() => setXAxisMode(v => (v === "time" ? "index" : "time"))}
                  className={`px-3 py-1 rounded-2xl border border-orange-500 ${
                    xAxisMode === "time" ? "bg-orange-500 text-white" : "bg-gray-100 hover:bg-gray-200"
                  }`}
                >
                  {xAxisMode === "time" ? "Vis jevnt fordelt akse" : "Vis tidsbasert akse"}
                </button>
              </h3>

              <ResponsiveContainer width="100%" height="100%">
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" />

                  {/* Terskler */}
                  {showThresholds && thresholdConfig && (
                    <>
                      {thresholdConfig.max !== undefined && (
                        <ReferenceArea y1={thresholdConfig.max} y2={getYDomain()} fill="#DC2626" fillOpacity={0.16} />
                      )}
                      {thresholdConfig.warningMax !== undefined && thresholdConfig.max !== undefined && (
                        <ReferenceArea y1={thresholdConfig.warningMax} y2={thresholdConfig.max} fill="#F59E0B" fillOpacity={0.22} />
                      )}
                      {thresholdConfig.warningMin !== undefined && thresholdConfig.min !== undefined && (
                        <ReferenceArea y1={thresholdConfig.min} y2={thresholdConfig.warningMin} fill="#F59E0B" fillOpacity={0.22} />
                      )}
                      {thresholdConfig.min !== undefined && (
                        <ReferenceArea y1={getYDomain()} y2={thresholdConfig.min} fill="#DC2626" fillOpacity={0.16} />
                      )}

                      {/* HARD og WARNING LIMITS */}
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

                  <XAxis
                    dataKey={xAxisMode === "time" ? "timestamp" : "index"}
                    type="number"
                    scale={xAxisMode === "time" ? "time" : "linear"}
                    domain={["auto", "auto"]}
                    tickFormatter={v => {
                      if (xAxisMode === "time") {
                        const first = data[0]?.timestamp;
                        const last = data[data.length - 1]?.timestamp;
                        const span = new Date(last) - new Date(first);
                        const d = new Date(v);

                        if (span < 24 * 60 * 60 * 1000)
                          return d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
                        if (span <= 3 * 24 * 60 * 60 * 1000)
                          return d.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" }) +
                                 " " + d.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" });
                        return d.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" });
                      } else {
                        const firstMachine = Object.values(dataByMachine)[0];
                        if (!firstMachine) return "";
                        const d = new Date(firstMachine[v]?.timestamp);
                        return d.toLocaleDateString("no-NO", { day: "2-digit", month: "2-digit" });
                      }
                    }}
                  />

                  <YAxis
                    domain={getYDomain()}
                    tickFormatter={v => (typeof v === "number" ? v.toFixed(2) : v)}
                    label={unit ? { value: unit, angle: -90, position: "insideLeft", fill: "#555" } : undefined}
                  />

                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  {Object.entries(dataByMachine).map(([machine, points], idx) => {
                    const pointsWithIndex = xAxisMode === "index" ? points.map((p, i) => ({ ...p, index: i })) : points;
                    const color = MACHINE_COLORS[idx % MACHINE_COLORS.length];

                    return (
                      <React.Fragment key={machine}>
                        {showRange && (
                          <>
                            <Line data={pointsWithIndex} type="monotone" dataKey="min" stroke={color} strokeDasharray="4 4" dot={false} legendType="none" isAnimationActive />
                            <Line data={pointsWithIndex} type="monotone" dataKey="max" stroke={color} strokeDasharray="4 4" dot={false} legendType="none" isAnimationActive />
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
                          isAnimationActive
                          connectNulls={false}
                        />
                      </React.Fragment>
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
