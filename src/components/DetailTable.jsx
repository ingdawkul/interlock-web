import React, { useState } from "react";
import InterlockActionsModal from "./InterlockActionsModal";
import { interlockMap } from "../utils/interlockLookup";

export default function DetailTable({ data, showDate }) {
  if (!data) {
    return (
      <div className="text-sm text-gray-500">
        Velg en Interlock ID for detaljer
      </div>
    );
  }
  
  const [showActions, setShowActions] = useState(false);

  const interlockInfo = data?.id
    ? interlockMap[data.id]
    : null;

  const formatDateTime = (date, time) => {
    if (!showDate || !date) return time;
    return (
      <>
        <span className="font-bold">{date}</span> {time}
      </>
    );
  };

  // ---------------------------
  // 🔥 SORTERING NÅR DATO SKAL VISES
  // ---------------------------
  let sortedEntries = data.entries;

  if (showDate) {
    sortedEntries = [...data.entries].sort((a, b) => {
      const aDate = a.Dates?.[0] || "";
      const aTime = a.Times?.[0] || "";
      const bDate = b.Dates?.[0] || "";
      const bTime = b.Times?.[0] || "";

      const aDT = new Date(`${aDate} ${aTime}`);
      const bDT = new Date(`${bDate} ${bTime}`);

      return aDT - bDT;
    });
  }

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-lg relative">
      <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div class="text-xl leading-tight font-semibold">
            <span>
              Detaljer for <strong class="font-bold text-blue-500">{data.id}</strong>
            </span>
          </div>
          {interlockInfo && (
            <button
              onClick={() => setShowActions(true)}
              className="px-3 py-1 rounded-2xl border bg-orange-500 text-white text-xs hover:bg-blue-600"
            >
              Vis tiltak
            </button>
          )}
        </div>


        {/* Tooltip trigger */}
        <div className="relative group">
          <button className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs hover:bg-gray-300">
            ?
          </button>

          {/* Tooltip innhold */}
          <div className="absolute z-10 hidden group-hover:block top-full right-0 mt-2 w-72 border border-gray-400 bg-white rounded-lg shadow-lg text-xs">
            <table className="table-fixed w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-1 w-16">Kode</th>
                  <th className="border border-gray-300 px-2 py-1">Beskrivelse</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border px-2 py-1">A</td><td className="border px-2 py-1">Ack</td></tr>
                <tr><td className="border px-2 py-1">Maj</td><td className="border px-2 py-1">Major fault</td></tr>
                <tr><td className="border px-2 py-1">L</td><td className="border px-2 py-1">Latched</td></tr>
                <tr><td className="border px-2 py-1">B</td><td className="border px-2 py-1">Beam inhibit</td></tr>
                <tr><td className="border px-2 py-1">M</td><td className="border px-2 py-1">Motion inhibit</td></tr>
                <tr><td className="border px-2 py-1">K</td><td className="border px-2 py-1">Kill (stoppet behandling)</td></tr>
                <tr><td className="border px-2 py-1">W</td><td className="border px-2 py-1">Warning</td></tr>
                <tr><td className="border px-2 py-1">O</td><td className="border px-2 py-1">Override</td></tr>
                <tr><td className="border px-2 py-1">P</td><td className="border px-2 py-1">Power inhibit</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <table className="w-full table-fixed">
        <thead>
          <tr>
            <th className="text-left py-1 w-40">
              {showDate ? "Dato & Klokkeslett" : "Klokkeslett"}
            </th>
            <th className="text-center py-1">Beskrivelse</th>
          </tr>
        </thead>
        <tbody>
          {sortedEntries.map((e, idx) => (
            <tr key={idx} className="align-top">
              <td className="py-2">
                {e.Times.map((time, i) => {
                  const date = e.Dates?.[i];
                  return (
                    <div key={i}>
                      {formatDateTime(date, time)}
                    </div>
                  );
                })}
              </td>
              <td className="py-2">
                {e.description}
                <div className="text-xs text-gray-400 mt-1">{e.Type}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {showActions && interlockInfo && (
      <InterlockActionsModal
        interlock={interlockInfo}
        onClose={() => setShowActions(false)}
      />
    )}
    </div>
  );
}