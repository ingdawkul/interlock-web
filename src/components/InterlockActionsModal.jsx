import React, { useState, useEffect } from "react";
import {
  X,
  ChevronDown,
  ListChecks,
  ScrollText,
  StickyNote,
  Stethoscope,
  Cpu,
} from "lucide-react";
import {
  severityColor,
  severityLabel,
  Severity,
  normalizeSeverity,
  CODE_LEGEND,
} from "../utils/interlockLookup";

const MESSAGES_PREVIEW = 4;

export default function InterlockActionsModal({ interlock, onClose }) {
  const [showFirstCheck, setShowFirstCheck] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!interlock) return null;

  const {
    Interlock,
    Controller,
    Description,
    FirstStep,
    SecondStep,
    Notes,
  } = interlock;

  const severity = normalizeSeverity(interlock.Severity ?? interlock.severity);
  const descriptions = Array.isArray(Description)
    ? Description
    : Description
    ? [Description]
    : [];
  const visibleMessages = showAllMessages
    ? descriptions
    : descriptions.slice(0, MESSAGES_PREVIEW);
  const hiddenCount = descriptions.length - visibleMessages.length;
  const hasActions = !!(FirstStep || SecondStep);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl
                   max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Interlock ${Interlock}`}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
              Interlock
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <h2 className="text-2xl font-bold text-gray-900 leading-none">
                {Interlock}
              </h2>
              {Controller && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-700 ring-1 ring-slate-200">
                  <Cpu size={12} />
                  {Controller}
                </span>
              )}
            </div>
            <div className="mt-2">
              <span
                className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm
                  ${severity === Severity.UNKNOWN ? "text-gray-700" : "text-white"}
                  ${severityColor[severity]}`}
              >
                {severityLabel[severity]}
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-gray-400
                       hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div className="overflow-y-auto px-5 py-5 space-y-6">
          {/* Suggested actions */}
          <section>
            <SectionTitle icon={<ListChecks size={16} />} title="Suggested actions" />
            {hasActions ? (
              <ol className="space-y-2.5">
                {FirstStep && <ActionStep n={1} text={FirstStep} />}
                {SecondStep && <ActionStep n={2} text={SecondStep} />}
              </ol>
            ) : (
              <p className="text-sm text-gray-400 italic">
                No actions registered for this interlock yet.
              </p>
            )}
          </section>

          {/* Known log messages */}
          {descriptions.length > 0 && (
            <section>
              <div className="flex items-center justify-between">
                <SectionTitle
                  icon={<ScrollText size={16} />}
                  title={`Known log messages (${descriptions.length})`}
                />
                <button
                  onClick={() => setShowCodes((v) => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showCodes ? "Hide codes" : "Code reference"}
                </button>
              </div>

              {showCodes && (
                <div className="mb-3 grid grid-cols-2 sm:grid-cols-3 gap-1.5 rounded-lg bg-gray-50 ring-1 ring-gray-100 p-3">
                  {CODE_LEGEND.map(({ code, label }) => (
                    <div key={code} className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-mono font-bold text-gray-700 bg-white ring-1 ring-gray-200 rounded px-1.5 py-0.5 min-w-[2rem] text-center">
                        {code}
                      </span>
                      <span className="text-gray-500 truncate">{label}</span>
                    </div>
                  ))}
                </div>
              )}

              <ul className="space-y-2">
                {visibleMessages.map((msg, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 bg-gray-50 ring-1 ring-gray-100 rounded-lg px-3 py-2 leading-snug break-words"
                  >
                    {msg}
                  </li>
                ))}
              </ul>

              {hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllMessages(true)}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Show {hiddenCount} more variant{hiddenCount !== 1 ? "s" : ""}
                </button>
              )}
              {showAllMessages && descriptions.length > MESSAGES_PREVIEW && (
                <button
                  onClick={() => setShowAllMessages(false)}
                  className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Show fewer
                </button>
              )}
            </section>
          )}

          {/* Notes */}
          {Notes && (
            <section>
              <SectionTitle icon={<StickyNote size={16} />} title="Notes" />
              <p className="text-sm text-gray-600 whitespace-pre-line">{Notes}</p>
            </section>
          )}

          {/* First check during fault diagnostics (generic guidance) */}
          <section>
            <button
              onClick={() => setShowFirstCheck((v) => !v)}
              className="w-full flex items-center justify-between text-left"
              aria-expanded={showFirstCheck}
            >
              <SectionTitle
                icon={<Stethoscope size={16} />}
                title="First check during fault diagnostics"
                noMargin
              />
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform ${
                  showFirstCheck ? "rotate-180" : ""
                }`}
              />
            </button>

            {showFirstCheck && (
              <div className="mt-3 rounded-xl bg-blue-50/60 ring-1 ring-blue-100 p-4 text-sm">
                <ul className="space-y-2 text-gray-700">
                  <li>
                    <strong className="text-gray-900">Machine ON:</strong> Use ID
                    list for further fault diagnosis.
                  </li>
                  <li>
                    <strong className="text-gray-900">Standby:</strong> Start basic
                    startup before ID list is relevant.
                  </li>
                  <li>
                    <strong className="text-gray-900">PEL:</strong> Start basic
                    startup before ID list is relevant.
                    <span className="block text-gray-500 italic mt-0.5">
                      How long has the machine been off? Check temperature, flow,
                      and water.
                    </span>
                  </li>
                  <li>
                    <strong className="text-gray-900">UNKNOWN:</strong> Start basic
                    startup before ID list is relevant.
                  </li>
                  <li>
                    <strong className="text-gray-900">Power Off:</strong> Start
                    basic startup before ID list is relevant.
                  </li>
                </ul>
                <p className="text-xs text-gray-500 mt-3">
                  Always begin by clearing errors.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function SectionTitle({ icon, title, noMargin }) {
  return (
    <h3
      className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500 ${
        noMargin ? "" : "mb-2.5"
      }`}
    >
      <span className="text-gray-400">{icon}</span>
      {title}
    </h3>
  );
}

function ActionStep({ n, text }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <span className="text-sm text-gray-800 leading-snug pt-0.5">{text}</span>
    </li>
  );
}
