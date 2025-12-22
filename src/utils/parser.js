// utils/parser.js

// -----------------------------
// Maskin / serienummer mapping
// -----------------------------
const SERIAL_TO_MACHINE = {
  "2595": "SB3U",
  "4522": "SB6U",
  "3988": "SB7U",
  "1679": "SB5R",
  "1680": "SB6R",
  "3758": "SB8R",
  "3213": "SB9R",
  "3215": "SB10R",
  "5503": "SB12R",
  "5724": "SB13R",
  "6252": "SB14R",
  "5011": "SB15R",
  "6635": "SB16R"
};

function mapSerialToMachine(sn) {
  return SERIAL_TO_MACHINE[sn] || null;
}

function detectMachineFromLine(line) {
  const snMatch = line.match(
    /\b(?:SN|SN#|Serial(?:\s+Number)?)\s*[:=]?\s*(\d{4})\b/i
  );
  if (snMatch) return mapSerialToMachine(snMatch[1]);

  const hMatch = line.match(/\bH(\d{6})\b/);
  if (hMatch) {
    const last4 = hMatch[1].slice(-4);
    return mapSerialToMachine(last4);
  }

  return null;
}

// -----------------------------
// Maskinstans-deteksjon
// -----------------------------
const DOWNTIME_GAP_MINUTES = 5;
const spvFaultRegex = /\bSPV\b.*\bFault\b|\bFault\b.*\bSPV\b/i;

// -----------------------------
// SystemMode-deteksjon
// -----------------------------
const systemModeRegex = /switching\s+to\s+(service|clinical)\s+mode/i;

function timeToDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}

// ✅ Sørger for alltid "HH:MM"
function formatTime(dateObj) {
  return dateObj.toTimeString().slice(0, 5); // "HH:MM"
}

// ----------------------------------------------------

export function parseLogText(text, progressCallback) {
  const startDateTimeRegex = /^\s*(\d{4}-\d{2}-\d{2})[\t ]+(\d{2}:\d{2}:\d{2})(?=[\t ]|$)/;
  const lineRegex = /(\d{2}:\d{2}:\d{2}).*?\((\d{6,7}):\s(.*?)\),/;
  const faultTypeRegex = /\b([A-Z]{3,4})\b\s+Fault/;

  const lines = text.split(/\r?\n/);
  let total = 0;
  let matches = 0;
  const results = {};

  let currentDate = null;
  let machineName = null;

  // -----------------------------
  // Downtime state
  // -----------------------------
  const downtimeByDate = {};
  let activeDowntime = null;

  // -----------------------------
  // SystemMode state
  // -----------------------------
  const systemModesByDate = {};
  let activeSystemMode = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;

    // Maskindeteksjon
    if (!machineName) {
      const detected = detectMachineFromLine(line);
      if (detected) machineName = detected;
    }

    let dateStr = null;
    let timeStr = null;

    const dtMatch = startDateTimeRegex.exec(line);
    if (dtMatch) {
      dateStr = dtMatch[1];
      timeStr = dtMatch[2];
      currentDate = dateStr;
    } else {
      const m = lineRegex.exec(line);
      if (m) {
        timeStr = m[1];
        dateStr = currentDate;
      }
    }

    if (!timeStr && currentDate) {
      const timeMatch = line.match(/\b(\d{2}:\d{2}:\d{2})\b/);
      if (timeMatch) {
        timeStr = timeMatch[1];
        dateStr = currentDate;
      }
    }

    // -----------------------------
    // SystemMode parsing
    // -----------------------------
    if (dateStr && timeStr) {
      const modeMatch = systemModeRegex.exec(line);
      if (modeMatch) {
        const mode = modeMatch[1].toUpperCase(); // SERVICE / CLINICAL
        const now = timeToDate(dateStr, timeStr);

        if (!activeSystemMode || activeSystemMode.mode !== mode) {
          if (activeSystemMode) {
            if (!systemModesByDate[activeSystemMode.date]) {
              systemModesByDate[activeSystemMode.date] = [];
            }

            systemModesByDate[activeSystemMode.date].push({
              start: formatTime(activeSystemMode.startTime),
              end: formatTime(activeSystemMode.lastSeenTime),
              mode: activeSystemMode.mode
            });
          }

          activeSystemMode = {
            date: dateStr,
            startTime: now,
            lastSeenTime: now,
            mode
          };
        } else {
          activeSystemMode.lastSeenTime = now;
        }
      }
    }

    // Kun linjer med raise/ack
    if (!/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line))
      continue;

    matches++;

    // -----------------------------
    // Downtime parsing
    // -----------------------------
    if (dateStr && timeStr && spvFaultRegex.test(line)) {
      const now = timeToDate(dateStr, timeStr);
      if (!activeDowntime) {
        activeDowntime = {
          date: dateStr,
          startTime: timeStr,
          lastSeenTime: now,
          reason: "SPV Fault",
          interlocks: []
        };
      } else {
        activeDowntime.lastSeenTime = now;
      }
    } else if (activeDowntime && dateStr && timeStr) {
      const now = timeToDate(dateStr, timeStr);
      const diffMin = (now - activeDowntime.lastSeenTime) / 1000 / 60;

      if (diffMin >= DOWNTIME_GAP_MINUTES) {
        if (!downtimeByDate[activeDowntime.date]) {
          downtimeByDate[activeDowntime.date] = [];
        }

        downtimeByDate[activeDowntime.date].push({
          start: activeDowntime.startTime,
          end: formatTime(activeDowntime.lastSeenTime),
          reason: activeDowntime.reason,
          interlocks: activeDowntime.interlocks
        });

        activeDowntime = null;
      }
    }

    // -----------------------------
    // Interlock parsing
    // -----------------------------
    const fallbackMatch = lineRegex.exec(line);
    let interlockId = null;
    let description = null;

    if (fallbackMatch) {
      interlockId = fallbackMatch[2];
      description = fallbackMatch[3].trim();
    } else {
      const idMatch = line.match(/\b(\d{6,7})\b/);
      interlockId = idMatch ? idMatch[1] : "UNKNOWN";
      description = line.trim();
    }

    const typeMatch = faultTypeRegex.exec(line);
    const typeField = typeMatch ? typeMatch[1] : "N/A";

    if (activeDowntime && interlockId && description) {
      const label = `${interlockId} – ${description}`;
      if (!activeDowntime.interlocks.includes(label)) {
        activeDowntime.interlocks.push(label);
      }
    }

    if (!results[interlockId]) {
      results[interlockId] = { entries: [], total: 0 };
    }

    let found = false;
    for (const entry of results[interlockId].entries) {
      if (entry.description === description && entry.Type === typeField) {
        entry.Times.push(timeStr);
        entry.Dates.push(dateStr || null);
        found = true;
        break;
      }
    }

    if (!found) {
      results[interlockId].entries.push({
        Type: typeField,
        description,
        Times: [timeStr],
        Dates: [dateStr || null]
      });
    }

    results[interlockId].total += 1;

    if (progressCallback && i % 5000 === 0) {
      progressCallback(i, lines.length);
    }
  }

  // -----------------------------
  // Flush åpen downtime
  // -----------------------------
  if (activeDowntime) {
    if (!downtimeByDate[activeDowntime.date]) downtimeByDate[activeDowntime.date] = [];

    downtimeByDate[activeDowntime.date].push({
      start: activeDowntime.startTime,
      end: formatTime(activeDowntime.lastSeenTime),
      reason: activeDowntime.reason,
      interlocks: activeDowntime.interlocks
    });
  }

  // -----------------------------
  // Flush åpen SystemMode
  // -----------------------------
  if (activeSystemMode) {
    if (!systemModesByDate[activeSystemMode.date]) systemModesByDate[activeSystemMode.date] = [];

    systemModesByDate[activeSystemMode.date].push({
      start: formatTime(activeSystemMode.startTime),
      end: formatTime(activeSystemMode.lastSeenTime),
      mode: activeSystemMode.mode
    });
  }

  return {
    results,
    totalLines: total,
    matchLines: matches,
    machineName,
    downtimeByDate,
    systemModesByDate
  };
}
