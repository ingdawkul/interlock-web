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

/**
 * Forsøker å detektere maskin fra EN linje.
 * Krever eksplisitt SN / Serial / Hxxxxxx for å unngå falske treff.
 */
function detectMachineFromLine(line) {
  const snMatch = line.match(
    /\b(?:SN|SN#|Serial(?:\s+Number)?)\s*[:=]?\s*(\d{4})\b/i
  );
  if (snMatch) {
    return mapSerialToMachine(snMatch[1]);
  }

  const hMatch = line.match(/\bH(\d{6})\b/);
  if (hMatch) {
    const last4 = hMatch[1].slice(-4);
    return mapSerialToMachine(last4);
  }

  return null;
}

// -----------------------------
// Maskinstans-deteksjon (NYTT)
// -----------------------------
const DOWNTIME_GAP_MINUTES = 5;
const spvFaultRegex = /\bSPV\b.*\bFault\b|\bFault\b.*\bSPV\b/i;

function timeToDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}

// ----------------------------------------------------

export function parseLogText(text, progressCallback) {
  // Tid/dato i starten: 2025-05-13 00:00:00
  const startDateTimeRegex =
    /^\s*(\d{4}-\d{2}-\d{2})[\t ]+(\d{2}:\d{2}:\d{2})(?=[\t ]|$)/;

  // fallback regex: (HH:MM:SS)...(123456: description),
  const lineRegex = /(\d{2}:\d{2}:\d{2}).*?\((\d{6,7}):\s(.*?)\),/;
  const faultTypeRegex = /\b([A-Z]{3,4})\b\s+Fault/;

  const lines = text.split(/\r?\n/);
  let total = 0;
  let matches = 0;
  const results = {};

  let currentDate = null;

  // 🔑 Maskin detekteres kun én gang
  let machineName = null;

  // -----------------------------
  // Downtime state (NYTT)
  // -----------------------------
  const downtimeByDate = {};
  let activeDowntime = null;
  // {
  //   date,
  //   startTime,
  //   lastSeenTime,
  //   reason
  // }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;

    // Maskindeteksjon (én gang)
    if (!machineName) {
      const detected = detectMachineFromLine(line);
      if (detected) machineName = detected;
    }

    // valider interessante linjer
    if (!/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line))
      continue;
    matches++;

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

    // -----------------------------
    // Maskinstans-deteksjon (NYTT)
    // -----------------------------
    if (dateStr && timeStr && spvFaultRegex.test(line)) {
      const now = timeToDate(dateStr, timeStr);

      if (!activeDowntime) {
        activeDowntime = {
          date: dateStr,
          startTime: timeStr,
          lastSeenTime: now,
          reason: "SPV Fault"
        };
      } else {
        activeDowntime.lastSeenTime = now;
      }
    } else if (activeDowntime && dateStr && timeStr) {
      const now = timeToDate(dateStr, timeStr);
      const diffMin =
        (now - activeDowntime.lastSeenTime) / 1000 / 60;

      if (diffMin >= DOWNTIME_GAP_MINUTES) {
        if (!downtimeByDate[activeDowntime.date]) {
          downtimeByDate[activeDowntime.date] = [];
        }

        downtimeByDate[activeDowntime.date].push({
          start: activeDowntime.startTime,
          end: activeDowntime.lastSeenTime
            .toTimeString()
            .slice(0, 8),
          reason: activeDowntime.reason
        });

        activeDowntime = null;
      }
    }

    // -----------------------------
    // Eksisterende interlock-logikk
    // -----------------------------
    if (
      !/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line)
    )
      continue;

    matches++;

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
  // Flush åpen downtime (NYTT)
  // -----------------------------
  if (activeDowntime) {
    if (!downtimeByDate[activeDowntime.date]) {
      downtimeByDate[activeDowntime.date] = [];
    }

    downtimeByDate[activeDowntime.date].push({
      start: activeDowntime.startTime,
      end: activeDowntime.lastSeenTime
        .toTimeString()
        .slice(0, 8),
      reason: activeDowntime.reason
    });
  }

  return {
    results,
    totalLines: total,
    matchLines: matches,
    machineName,
    downtimeByDate // 👈 NYTT, uten breaking change
  };
}
