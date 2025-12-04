import React from 'react';

export default function DetailTable({ data, showDate }) {
  if (!data) {
    return (
      <div className="text-sm text-gray-500">
        Velg en Interlock ID for detaljer
      </div>
    );
  }

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
      // Hent første dato/tid i hvert entry
      const aDate = a.Dates?.[0] || "";
      const aTime = a.Times?.[0] || "";
      const bDate = b.Dates?.[0] || "";
      const bTime = b.Times?.[0] || "";

      // Kombiner til ett tall for sortering
      const aDT = new Date(`${aDate} ${aTime}`);
      const bDT = new Date(`${bDate} ${bTime}`);

      return aDT - bDT;
    });
  }

  return (
    <div className="bg-white border rounded-2xl p-4 shadow-lg">
      <div className="text-sm text-gray-600 mb-2">
        Detaljer for <strong>{data.id}</strong>
      </div>

      <table className="w-full table-auto">
        <thead>
          <tr>
            <th className="text-left py-1">
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
    </div>
  );
}
