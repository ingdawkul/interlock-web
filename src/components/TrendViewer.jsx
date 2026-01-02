import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer
} from "recharts";

export default function TrendViewer({ trendData }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  const parameters = useMemo(() => {
    return Object.keys(trendData || {}).sort();
  }, [trendData]);


  const filteredParams = parameters.filter(p =>
    p.toLowerCase().includes(query.toLowerCase())
  );

  const data = selected ? trendData[selected] : [];

  return (
    <div className="bg-white panel rounded-2xl p-4">
      <h2 className="font-bold text-lg mb-3">Trend / AVG-analyse</h2>

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
            {filteredParams.map(p => (
              <li
                key={p}
                onClick={() => setSelected(p)}
                className={`cursor-pointer p-2 rounded-lg ${
                  selected === p
                    ? "bg-blue-100 font-semibold"
                    : "hover:bg-gray-100"
                }`}
              >
                {p}
              </li>
            ))}
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
              <h3 className="font-semibold mb-2">{selected}</h3>

              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                    dataKey="timestamp"
                    tickFormatter={t =>
                        new Date(t).toLocaleString("no-NO", {
                        hour: "2-digit",
                        minute: "2-digit"
                        })
                    }
                    />
                  <YAxis
                    domain={["auto", "auto"]}
                  />
                    <Tooltip
                    labelFormatter={t =>
                        new Date(t).toLocaleString("no-NO")
                    }
                    formatter={(value, name, props) => [
                        value,
                        `Avg (${props.payload.machine})`
                    ]}
                    />

                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    dot={{ r: 3 }}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
