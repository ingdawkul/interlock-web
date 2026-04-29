// utils/logViewerParser.js
//
// Parses raw log file text into categorised activity events for the LogViewer.
// Each event: { time, ms, level, source, category, message, kind }

// ── Event kinds (color coding) ────────────────────────────────────────────────

export const EVENT_KINDS = {
  ERROR:     { label: "Error",        color: "#dc2626", bg: "rgba(220,38,38,0.06)",  border: "#fca5a5" },
  FAULT:     { label: "Fault",        color: "#b91c1c", bg: "rgba(185,28,28,0.07)",  border: "#fca5a5" },
  WARNING:   { label: "Warning",      color: "#d97706", bg: "rgba(217,119,6,0.06)",  border: "#fcd34d" },
  INTERLOCK: { label: "Interlock",    color: "#7c3aed", bg: "rgba(124,58,237,0.06)", border: "#c4b5fd" },
  BEAM:      { label: "Beam",         color: "#0891b2", bg: "rgba(8,145,178,0.06)",  border: "#67e8f9" },
  DOOR:      { label: "Door / Safety",color: "#9f1239", bg: "rgba(159,18,57,0.06)",  border: "#fca5a5" },
  MODE:      { label: "Mode change",  color: "#2563eb", bg: "rgba(37,99,235,0.06)",  border: "#93c5fd" },
  POWER:     { label: "Power",        color: "#15803d", bg: "rgba(21,128,61,0.06)",  border: "#86efac" },
  STATE:     { label: "State change", color: "#6b7280", bg: "rgba(107,114,128,0.05)", border: "#d1d5db" },
};

// ── Detection patterns ────────────────────────────────────────────────────────

const PATTERNS = [
  // Order matters: first match wins
  { kind: "INTERLOCK", test: /assertInterlock|releaseInterlock|Interlock\s+\(\d+/i,
    extract: (msg) => {
      const m = msg.match(/Interlock\s+\((\d+):\s*[^)]*?:\s*([^)]+)\)/i);
      const action = /assertInterlock/i.test(msg) ? "asserted" : /releaseInterlock/i.test(msg) ? "released" : "";
      if (m) return `${action} #${m[1]} — ${m[2].trim()}`;
      return msg.slice(0, 150);
    }
  },
  { kind: "BEAM", test: /BeamOnEnter|BeamOnToOff|Beam off state/,
    extract: (msg) => {
      const enter = msg.match(/BeamOn state in (\w+) mode, energy ([^,]+), dose rate ([\d.]+)/);
      if (enter) return `Beam ON — ${enter[2].trim()}, ${enter[1]} mode, ${parseFloat(enter[3])} MU/min`;
      const exit = msg.match(/last beam pulse counter is (\d+)/);
      if (exit) return `Beam OFF — ${exit[1]} pulses`;
      return msg.slice(0, 150);
    }
  },
  { kind: "DOOR", test: /Door open|Door closed|CollisionSensor|emergency|estop/i,
    extract: (msg) => {
      if (/Door open/i.test(msg)) return "🚪 Treatment room door OPENED";
      if (/Door closed/i.test(msg)) return "🚪 Treatment room door CLOSED";
      return msg.replace(/.*?::/, "").slice(0, 150);
    }
  },
  { kind: "MODE", test: /switching to \w+(?:\s+app)?\s+mode|onCommandParserSetOpMode/,
    extract: (msg) => {
      const m = msg.match(/switching to (\w+)(?:\s+app)?\s+mode/i);
      if (m) return `🔄 Mode → ${m[1].toUpperCase()}`;
      return msg.slice(0, 150);
    }
  },
  { kind: "POWER", test: /Input Power is lost or instable|Standby command|Standby>exit|onCommandParserStandby/i,
    extract: (msg) => {
      if (/Input Power is lost.*asserted/i.test(msg))  return "⚡ Power LOST / unstable";
      if (/Input Power is lost.*released/i.test(msg))  return "⚡ Power restored";
      if (/Standby>exit|Command to go ON/i.test(msg))  return "🔌 Exit standby — system ON";
      if (/Standby command received/i.test(msg))       return "🔌 Standby command received";
      return msg.slice(0, 150);
    }
  },
  { kind: "STATE", test: /state changed from \w+ to \w+|StateEnter|StateExit|enter \w+ state/i,
    extract: (msg) => {
      const m = msg.match(/Subnode (\w+) state changed from (\w+) to (\w+)/);
      if (m) return `${m[1]}: ${m[2]} → ${m[3]}`;
      const m2 = msg.match(/(\w+::\w+).*State.*?(enter|exit)\s+(\w+)/i);
      if (m2) return `${m2[1]} ${m2[2]} ${m2[3]}`;
      return msg.replace(/.*?::/, "").slice(0, 150);
    }
  },
];

// Generic extractor for Fault category lines (used when no pattern above matches)
function extractFault(msg) {
  const m = msg.match(/\((\d+):\s*[A-Z\s]+:?\s*([^)]+)\)/);
  if (m) {
    const action = /raise/.test(msg) ? "raised" : /ack/.test(msg) ? "cleared" : "";
    return `${action} #${m[1]} — ${m[2].trim()}`;
  }
  return msg.slice(0, 200);
}

// ── Main parser ───────────────────────────────────────────────────────────────

export function parseLogForViewer(text, opts = {}) {
  const {
    startTime = null,
    endTime   = null,
    kinds     = null,        // null = all kinds
    sources   = null,        // null = all sources (filter on parts[6])
    categories= null,        // null = all categories (filter on parts[7])
    maxEvents = 5000,
  } = opts;

  const lines  = text.split(/\r?\n/);
  const events = [];
  let firstTime = null;
  let lastTime  = null;
  let scanned   = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 30) continue;

    const parts = line.split("\t", 9);
    if (parts.length < 9) continue;

    const time = parts[1];
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) continue;

    if (startTime && time < startTime) continue;
    if (endTime   && time > endTime)   continue;

    scanned++;

    const level    = parts[3];
    const ms       = parts[4];
    const source   = parts[6];
    const category = (parts[7] || "").trim();
    const message  = parts[8] ?? "";

    // ── Classify ─────────────────────────────────────────────────────────────
    let kind = null;
    let summary = null;

    // 1. Try pattern match in message first (highest priority)
    for (const p of PATTERNS) {
      if (p.test.test(message)) {
        kind = p.kind;
        summary = p.extract(message);
        break;
      }
    }

    // 2. If still unclassified, use the log's category column as a fallback.
    //    "Fault" is its own category in the Varian log (column 8).
    if (!kind) {
      if (category === "Fault") {
        kind = "FAULT";
        summary = extractFault(message);
      } else if (category === "Interlock") {
        kind = "INTERLOCK";
        summary = message.slice(0, 200);
      } else if (level === "Error") {
        kind = "ERROR";
        summary = message.slice(0, 200);
      } else if (level === "Warning") {
        kind = "WARNING";
        summary = message.slice(0, 200);
      }
    }

    if (!kind) continue;

    // ── Apply filters ────────────────────────────────────────────────────────
    if (kinds      && !kinds.has(kind))         continue;
    if (sources    && !sources.has(source))     continue;
    if (categories && !categories.has(category))continue;

    if (!firstTime) firstTime = time;
    lastTime = time;

    events.push({
      time, ms, level, source, category, kind, summary, raw: message,
    });

    if (events.length >= maxEvents) {
      return { events, totalScanned: scanned, truncated: true,
               allTimes: { first: firstTime, last: lastTime } };
    }
  }

  return { events, totalScanned: scanned, truncated: false,
           allTimes: { first: firstTime, last: lastTime } };
}

// ── Anchors for jump-to ───────────────────────────────────────────────────────
export function findInterestingMoments(text) {
  const anchors = [];
  const lines   = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 30) continue;
    const parts = line.split("\t", 9);
    if (parts.length < 9) continue;
    const time = parts[1];
    if (!/^\d{2}:\d{2}:\d{2}$/.test(time)) continue;

    const level = parts[3];
    const msg   = parts[8] ?? "";

    if (level === "Error")                                        anchors.push({ time, label: "Error",          kind: "ERROR" });
    else if (/stopped the treatment/i.test(msg))                  anchors.push({ time, label: "Treatment stop", kind: "INTERLOCK" });
    else if (/Input Power is lost.*asserted/i.test(msg))          anchors.push({ time, label: "Power loss",     kind: "POWER" });
    else if (/Door open/i.test(msg))                              anchors.push({ time, label: "Door opened",    kind: "DOOR" });
    else if (/switching to (clinical|service|qa|smc)/i.test(msg)) {
      const m = msg.match(/switching to (\w+)/i);
      anchors.push({ time, label: `→ ${m[1].toUpperCase()}`,      kind: "MODE" });
    }
  }

  // Deduplicate adjacent anchors with same time + kind
  const uniq = [];
  for (const a of anchors) {
    const last = uniq[uniq.length - 1];
    if (!last || last.time !== a.time || last.kind !== a.kind) uniq.push(a);
  }
  return uniq;
}

// ── Discover sources and categories present in a log file ────────────────────
// Used to populate the filter dropdowns. Lightweight scan — only reads the
// fields we need.
export function discoverFacets(text) {
  const sources = new Map();    // source → count
  const categories = new Map(); // category → count
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 30) continue;
    const parts = line.split("\t", 9);
    if (parts.length < 9) continue;
    if (!/^\d{2}:\d{2}:\d{2}$/.test(parts[1])) continue;

    const src = parts[6];
    const cat = (parts[7] || "").trim();
    if (src) sources.set(src,   (sources.get(src)   || 0) + 1);
    if (cat) categories.set(cat,(categories.get(cat)|| 0) + 1);
  }

  // Sort by count descending
  const sortByCount = (a, b) => b[1] - a[1];
  return {
    sources:    [...sources.entries()].sort(sortByCount).map(([name, count]) => ({ name, count })),
    categories: [...categories.entries()].sort(sortByCount).map(([name, count]) => ({ name, count })),
  };
}