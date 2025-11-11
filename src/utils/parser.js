export function parseLogText(text, progressCallback) {
  // pattern: (HH:MM:SS)...(123456: description),
  const lineRegex = /(\d{2}:\d{2}:\d{2}).*?\((\d{6,7}):\s(.*?)\),/;
  const faultTypeRegex = /\b([A-Z]{3,4})\b\s+Fault/;

  const lines = text.split(/\r?\n/);
  let total = 0;
  let matches = 0;
  const results = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;
    if (!/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line)) continue;
    matches++;
    const m = lineRegex.exec(line);
    if (!m) continue;
    const timeStr = m[1];
    const interlockId = m[2];
    const description = m[3].trim();
    const typeMatch = faultTypeRegex.exec(line);
    const typeField = typeMatch ? typeMatch[1] : 'N/A';

    if (!results[interlockId]) results[interlockId] = { entries: [], total: 0 };

    let found = false;
    for (const entry of results[interlockId].entries) {
      if (entry.description === description && entry.Type === typeField) {
        entry.Times.push(timeStr);
        found = true;
        break;
      }
    }
    if (!found) {
      results[interlockId].entries.push({ Type: typeField, description, Times: [timeStr] });
    }
    results[interlockId].total += 1;

    // rapporter fremgang periodisk
    if (progressCallback && i % 5000 === 0) progressCallback(i, lines.length);
  }

  return { results, totalLines: total, matchLines: matches };
}