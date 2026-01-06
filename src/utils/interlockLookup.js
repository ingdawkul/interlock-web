import interlocks from "../data/InterlockTableV1.json";

export const Severity = {
  CRITICAL: "CRITICAL",
  STOP: "STOP",
  FOLLOW_UP: "FOLLOW_UP",
  INFO: "INFO"
};

export const severityLabel = {
  [Severity.CRITICAL]: "Critical",
  [Severity.STOP]: "Stop",
  [Severity.FOLLOW_UP]: "Follow-up",
  [Severity.INFO]: "Info"
};


export const severityColor = {
  [Severity.CRITICAL]: "bg-red-500",
  [Severity.STOP]: "bg-orange-400",
  [Severity.FOLLOW_UP]: "bg-yellow-300",
  [Severity.INFO]: "bg-blue-400"
};

export const interlockMap = Object.fromEntries(
  interlocks.map(i => [
    i.Interlock,
    {
      ...i,
      severity: i.Severity ?? Severity.INFO
    }
  ])
);

export const interlockList = Object.values(interlockMap);