import React, { useState } from "react";
import {
  interlockList,
  severityColor,
  severityLabel
} from "../utils/interlockLookup";

export default function InterlockSearch({ onSelect }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);

  const matches = interlockList.filter(i =>
    i.Interlock.includes(value)
  ).slice(0, 8);

  return (
    <div className="relative w-full max-w-md mx-auto">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        placeholder="Søk interlock ID"
        className="w-full px-4 py-3 rounded-2xl border border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {open && value && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-xl shadow">
          {matches.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-400">
              No matches
            </div>
          )}

          {matches.map(i => (
            <div
              key={i.Interlock}
              onClick={() => {
                onSelect(i);
                setOpen(false);
                setValue("");
              }}
              className="flex justify-between items-center px-3 py-2 cursor-pointer hover:bg-gray-100"
            >
              <span>{i.Interlock}</span>
              <span
                className={`text-xs text-white px-2 py-1 rounded-full ${severityColor[i.severity]}`}
              >
                {severityLabel[i.severity]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}