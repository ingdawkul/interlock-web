export function parseLogText(text, progressCallback) {
  // Tid/dato i starten: 2025-05-13<tab or space>00:00:00
  const startDateTimeRegex =
    /^\s*(\d{4}-\d{2}-\d{2})[\t ]+(\d{2}:\d{2}:\d{2})(?=[\t ]|$)/;

  // fallback regex for linjer i (HH:MM:SS)...(123456: description),
  const lineRegex = /(\d{2}:\d{2}:\d{2}).*?\((\d{6,7}):\s(.*?)\),/;
  const faultTypeRegex = /\b([A-Z]{3,4})\b\s+Fault/;

  const lines = text.split(/\r?\n/);
  let total = 0;
  let matches = 0;
  const results = {};

  // Husk siste oppdagede dato (brukes hvis en linje ikke har eksplisitt dato)
  let currentDate = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;

    // valider at linjen inneholder interessante nøkkelord
    if (!/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line))
      continue;
    matches++;

    // Prøv å plukke ut dato + tid hvis linjen starter med det
    let dateStr = null;
    let timeStr = null;

    const dtMatch = startDateTimeRegex.exec(line);
    if (dtMatch) {
      dateStr = dtMatch[1]; // YYYY-MM-DD
      timeStr = dtMatch[2]; // HH:MM:SS
      currentDate = dateStr; // oppdater siste dato
    } else {
      const m = lineRegex.exec(line);
      if (!m) continue; // hopper linjer som ikke matcher
      timeStr = m[1];
      dateStr = currentDate; // fallback: bruk siste kjente dato
    }

    // Hent interlockId og description
    const fallbackMatch = lineRegex.exec(line);
    let interlockId = null;
    let description = null;

    if (fallbackMatch) {
      interlockId = fallbackMatch[2];
      description = fallbackMatch[3].trim();
      timeStr = timeStr || fallbackMatch[1];
    } else {
      // Forsøk å hente ID fra SN# eller 6-7 siffer
      const idMatch = line.match(/\b(\d{6,7})\b/);
      interlockId = idMatch ? idMatch[1] : 'UNKNOWN';

      const parts = line.split(/\t/);
      description = parts.length > 0 ? parts.slice(-1)[0].trim() : line.trim();
    }

    // Finn type (Fault / N/A)
    const typeMatch = faultTypeRegex.exec(line);
    const typeField = typeMatch ? typeMatch[1] : 'N/A';

    if (!results[interlockId]) results[interlockId] = { entries: [], total: 0 };

    let found = false;
    for (const entry of results[interlockId].entries) {
      if (entry.description === description && entry.Type === typeField) {
        // push tid og dato
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

    if (progressCallback && i % 5000 === 0) progressCallback(i, lines.length);
  }

  return { results, totalLines: total, matchLines: matches };
}
