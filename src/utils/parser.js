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
  // SN / SN# / Serial Number
  const snMatch = line.match(
    /\b(?:SN|SN#|Serial(?:\s+Number)?)\s*[:=]?\s*(\d{4})\b/i
  );
  if (snMatch) {
    return mapSerialToMachine(snMatch[1]);
  }

  // Fabrikkformat: H + 6 siffer (bruk siste 4)
  const hMatch = line.match(/\bH(\d{6})\b/);
  if (hMatch) {
    const last4 = hMatch[1].slice(-4);
    return mapSerialToMachine(last4);
  }

  return null;
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;

    // Forsøk maskindeteksjon tidlig, men bare én gang
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
      if (!m) continue;
      timeStr = m[1];
      dateStr = currentDate;
    }

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

  return {
    results,
    totalLines: total,
    matchLines: matches,
    machineName 
  };
}
