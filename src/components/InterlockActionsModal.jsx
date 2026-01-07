import React, { useState } from "react";
import { severityColor } from "../utils/interlockLookup";

export default function InterlockActionsModal({ interlock, onClose }) {
  if (!interlock) return null;

  const { Interlock, FirstStep, SecondStep, Severity, Notes } = interlock;
  const [open, setOpen] = useState(false);

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
        <div className="relative inline-block">
            {/* Toggle-knapp */}
            <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls="first-check-tooltip"
            className={`px-2 py-1 rounded-md border transition-colors
            ${open
            ? "bg-orange-500 text-white border-orange-600 hover:bg-orange-600"
            : "bg-white text-blue-600 border-gray-300 hover:bg-gray-100"}`}
            title="Vis/skjul Første sjekk"
            >
            ℹ️
            </button>
            {/* Backdrop for click-outside */}
            {open && (
            <div
            className="fixed inset-0 z-20 bg-black/10"
            onClick={() =>
            setOpen(false)}
            aria-hidden="true"
            />
            )}
            {/* Tooltip under knappen */}
            {open && (
            <div
                id="first-check-tooltip"
                role="dialog"
                aria-label="Maskinstatus ved feildiagnostisering"
                className="absolute left-0 top-full mt-2 w-80 max-w-[90vw] bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-sm z-30"
                >
                <div className="absolute -top-2 left-4 w-3 h-3 bg-white border-l border-t border-gray-300 rotate-45"></div>
                <h3 className="font-semibold text-gray-800 mb-2">
                    Første sjekk ved feildiagnostisering
                </h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                    <li><strong>Maskin PÅ:</strong> Bruk ID-liste for videre feilsøking.</li>
                    <li><strong>Standby:</strong> Start grunnleggende oppstart før ID-liste er relevant.</li>
                    <li>
                        <strong>PEL:</strong> Start grunnleggende oppstart før ID-liste er relevant.
                        <br />
                        <em className="text-gray-600">
                        Hvor lenge har maskinen vært av?<br />
                        Sjekk temperatur, flow og vann.
                        </em>
                    </li>
                    <li><strong>UNKNOWN:</strong> Start grunnleggende oppstart før ID-liste er relevant.</li>
                    <li><strong>Power Off:</strong> Start grunnleggende oppstart før ID-liste er relevant.</li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                    Begynn alltid med å cleare feil. 
                </p>
            </div>
            )}
            </div>

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
