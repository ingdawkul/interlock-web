import interlocks from "../data/interlock_database.json";

export const Severity = {
  CRITICAL: "CRITICAL",
  STOP: "STOP",
  FOLLOW_UP: "FOLLOW_UP",
  INFO: "INFO",
  UNKNOWN: "UNKNOWN"
};

export const severityLabel = {
  [Severity.CRITICAL]: "Critical",
  [Severity.STOP]: "Stop",
  [Severity.FOLLOW_UP]: "Follow-up",
  [Severity.INFO]: "Info",
  [Severity.UNKNOWN]: "Unclassified"
};

// Background colour (solid badges)
export const severityColor = {
  [Severity.CRITICAL]: "bg-red-500",
  [Severity.STOP]: "bg-orange-500",
  [Severity.FOLLOW_UP]: "bg-amber-400",
  [Severity.INFO]: "bg-blue-400",
  [Severity.UNKNOWN]: "bg-gray-300"
};

// Normalise an interlock's severity: the new database leaves it blank for
// interlocks that have not been classified yet.
export function normalizeSeverity(value) {
  return value && Severity[value] ? value : Severity.UNKNOWN;
}

// Reference for the status-code prefixes that appear in raw log descriptions
// (e.g. "L B K KVS node disconnected").
export const CODE_LEGEND = [
  { code: "A", label: "Ack" },
  { code: "Maj", label: "Major fault" },
  { code: "L", label: "Latched" },
  { code: "B", label: "Beam inhibit" },
  { code: "M", label: "Motion inhibit" },
  { code: "K", label: "Kill (process stopped)" },
  { code: "W", label: "Warning" },
  { code: "O", label: "Override" },
  { code: "P", label: "Power inhibit" }
];

export const interlockMap = Object.fromEntries(
  interlocks.map(i => [
    i.Interlock,
    {
      ...i,
      Description: Array.isArray(i.Description)
        ? i.Description
        : i.Description
        ? [i.Description]
        : [],
      severity: normalizeSeverity(i.Severity)
    }
  ])
);

export const interlockList = Object.values(interlockMap);
