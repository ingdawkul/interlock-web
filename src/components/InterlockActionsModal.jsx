import React from "react";
import { severityColor } from "../utils/interlockLookup";

export default function InterlockActionsModal({ interlock, onClose }) {
  if (!interlock) return null;

  const { Interlock, FirstStep, SecondStep, Severity, Notes } = interlock;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 relative">
        {/* Lukk-knapp */}
        <button
            className="absolute top-4 right-4 px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 text-xl font-bold shadow-md"
            onClick={() => onClose()}
        >
            ✕
        </button>

        <h2 className="text-lg font-semibold mb-2">
        Tiltak for interlock
        {Interlock && (
            <span className="text-lg font-semibold mb-2">
            <strong></strong> {Interlock}
            </span>
        )}
        </h2>


        {/* Severity */}
        <div className="flex items-center gap-2 mb-4 font-semibold">
          <span className="text-sm">Alvorlighet:</span>
          <span
            className={`text-sm px-3 py-1 rounded-full text-white ${severityColor[Severity]}`}
          >
            {Severity}
          </span>
        </div>

        {/* Steps */}
        <div className="space-y-3 text-sm">
          {FirstStep && (
            <div>
              <div className="font-semibold">Tiltak 1</div>
              <div>{FirstStep}</div>
            </div>
          )}

          {SecondStep && (
            <div>
              <div className="font-semibold">Tiltak 2</div>
              <div>{SecondStep}</div>
            </div>
          )}

          {!FirstStep && !SecondStep && (
            <div className="text-gray-500 italic">
              Ingen tiltak registrert
            </div>
          )}

          {Notes && (
            <div className="text-xs text-gray-400 mt-2">
              {Notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
