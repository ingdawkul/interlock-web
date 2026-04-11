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
  if (snMatch) {
    const sn = snMatch[1];
    return { serial: sn, machine: SERIAL_TO_MACHINE[sn] || null };
  }

  const hMatch = line.match(/\bH(\d{6})\b/);
  if (hMatch) {
    const last4 = hMatch[1].slice(-4);
    return { serial: last4, machine: SERIAL_TO_MACHINE[last4] || null };
  }

  return null;
}

// -----------------------------
// Downtime
// -----------------------------
const DOWNTIME_GAP_MINUTES = 5;
const spvFaultRegex = /\bSPV\b.*\bFault\b|\bFault\b.*\bSPV\b/i;

// -----------------------------
// SystemMode
// -----------------------------
const systemModeRegex = /switching\s+to\s+([a-z]+)(?:\s+app)?\s+mode/i;
const wrkstLostRegex  = /workstation communication lost/i;

// TREAT and UNKNOWN are app-loading artifacts — they always fire a fraction of
// a second before the real mode on the same log-line cluster and carry no
// independent meaning. All other modes (SERVICE, CLINICAL, QA, SMC, and any
// future modes) are tracked and displayed.
const IGNORED_MODES = new Set(["TREAT", "UNKNOWN"]);

// -----------------------------
// Trend / AVG-parameter parsing
// -----------------------------
const TREND_PARAMETERS = [
  "NDCMotor::X1 primSecDevStats",
  "NDCMotor::X2 primSecDevStats",
  "NDCMotor::Y1 primSecDevStats",
  "NDCMotor::Y2 primSecDevStats",
  "NDCMotor::KVBladeX1 primSecDevStats",
  "NDCMotor::KVBladeX2 primSecDevStats",
  "NDCMotor::KVBladeY1 primSecDevStats",
  "NDCMotor::KVBladeY2 primSecDevStats",
  "NDCMotor::KVFilterFoil primSecDevStats",
  "NDCMotor::KVFilterShape primSecDevStats",
  "NDCMotor::PosTarget primSecDevStats",
  "NDCMotor::PosRotation primSecDevStats",
  "NDCMotor::PosIonChamber primSecDevStats",
  "NDCMotor::PosY primSecDevStats",
  "NDCMotor::PosEnergySwitch primDriftStats",
  "MLCController::logStatistics MLCCarriage_BankA_primSecDevStats",
  "MLCController::logStatistics MLCCarriage_BankB_primSecDevStats",
  "STNSF6GasCtrl::logStatistics SF6GaswaveGuidePressureStatistics",
  "BGMSubNodeCntrl::logStatistics EGN_boardTemperature",
  "STNPwrHandlerBase::logStatistics PowerAPD_Temperature",
  "STNPwrHandlerBase::logStatistics PowerSPD_Temperature",
  "STNPwrHandlerBase::logStatistics PowerGPD_Temperature",
  "STNPwrHandlerBase::logStatistics GPD_ACFanStatistics",
  "STNPwrHandlerBase::logStatistics SPD_ACFanStatistics",
  "STNCoolingCtrl::logStatistics CoolingbendMagFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingcityWaterFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingcityWaterTempStatistics",
  "STNCoolingCtrl::logStatistics CoolingguideFlowFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingklystronFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingklystronSolenoidFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingprimaryCollimatorFlowHighStatistics",
  "STNCoolingCtrl::logStatistics CoolingpumpOutletTempStatistics",
  "STNCoolingCtrl::logStatistics CoolingtankInputTempStatistics",
  "STNCoolingCtrl::logStatistics CoolingtargetFlowHighStatistics",
  "STNCoolingCtrl::logStatistics SlimcombineGuideSolenoidFlowHighStatistics"
];

const AVG_REGEX = /\bavg\s*=\s*(-?\d+(?:\.\d+)?)/i;
const MIN_REGEX = /\bmin\s*=\s*(-?\d+(?:\.\d+)?)/i;
const MAX_REGEX = /\bmax\s*=\s*(-?\d+(?:\.\d+)?)/i;

function timeToDate(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}`);
}

function formatTime(dateObj) {
  return dateObj.toTimeString().slice(0, 5); // "HH:MM"
}

// ─────────────────────────────────────────────────────────────────────────────

export function parseLogText(text, progressCallback) {
  const startDateTimeRegex = /^\s*(\d{4}-\d{2}-\d{2})[\t ]+(\d{2}:\d{2}:\d{2})(?=[\t ]|$)/;
  const lineRegex          = /(\d{2}:\d{2}:\d{2}).*?\((\d{6,7}):\s(.*?)\),/;
  const faultTypeRegex     = /\b([A-Z]{3,4})\b\s+Fault/;

  const lines   = text.split(/\r?\n/);
  const results = {};
  const trendData = {};
  let total   = 0;
  let matches = 0;

  let currentDate  = null;
  let machineName  = null;
  let serialNumber = null;

  // Downtime state
  const downtimeByDate = {};
  let activeDowntime   = null;

  // SystemMode state
  const systemModesByDate = {};
  let activeSystemMode    = null;

  // ─── Main loop ─────────────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    total++;

    // Machine detection
    if (!serialNumber) {
      const detected = detectMachineFromLine(line);
      if (detected) {
        serialNumber = detected.serial;
        machineName  = detected.machine || `SN#${detected.serial}`;
      }
    }

    let dateStr = null;
    let timeStr = null;

    const dtMatch = startDateTimeRegex.exec(line);
    if (dtMatch) {
      dateStr     = dtMatch[1];
      timeStr     = dtMatch[2];
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

    // ── SystemMode parsing ──────────────────────────────────────────────────
    if (dateStr && timeStr) {

      // Workstation disconnect → close active mode at this timestamp
      if (wrkstLostRegex.test(line) && activeSystemMode) {
        if (!systemModesByDate[activeSystemMode.date]) {
          systemModesByDate[activeSystemMode.date] = [];
        }
        systemModesByDate[activeSystemMode.date].push({
          start: formatTime(activeSystemMode.startTime),
          end:   formatTime(timeToDate(dateStr, timeStr)),
          mode:  activeSystemMode.mode
        });
        activeSystemMode = null;
        continue;
      }

      // Mode switch
      const modeMatch = systemModeRegex.exec(line);
      if (modeMatch) {
        const newMode = modeMatch[1].toUpperCase();
        const now     = timeToDate(dateStr, timeStr);

        // Skip app-loading artifacts
        if (IGNORED_MODES.has(newMode)) continue;

        // Guard against duplicate consecutive mode lines
        if (activeSystemMode && activeSystemMode.mode === newMode) continue;

        // Close the currently active mode period
        if (activeSystemMode) {
          if (!systemModesByDate[activeSystemMode.date]) {
            systemModesByDate[activeSystemMode.date] = [];
          }
          systemModesByDate[activeSystemMode.date].push({
            start: formatTime(activeSystemMode.startTime),
            end:   formatTime(now),
            mode:  activeSystemMode.mode
          });
          activeSystemMode = null;
        }

        // Start tracking this mode
        activeSystemMode = {
          date:      dateStr,
          startTime: now,
          mode:      newMode
        };
      }
    }

    // ── Trend parsing ───────────────────────────────────────────────────────
    if (dateStr && timeStr && line.includes("avg=")) {
      for (const param of TREND_PARAMETERS) {
        if (line.includes(param + ":")) {
          const avgMatch = AVG_REGEX.exec(line);
          if (!avgMatch) continue;

          const minMatch = MIN_REGEX.exec(line);
          const maxMatch = MAX_REGEX.exec(line);

          const avg       = parseFloat(avgMatch[1]);
          const min       = minMatch ? parseFloat(minMatch[1]) : null;
          const max       = maxMatch ? parseFloat(maxMatch[1]) : null;
          const timestamp = new Date(`${dateStr}T${timeStr}`).getTime();

          if (!trendData[param]) trendData[param] = [];
          trendData[param].push({
            machine: machineName || "UNKNOWN",
            date: dateStr,
            time: timeStr,
            timestamp,
            avg,
            min,
            max
          });

          break;
        }
      }
    }

    // Only process lines with raise/ack
    if (!/(?:raise|ack)\s+(?:Warning|Fault)\s+(?:detected|removed)/i.test(line))
      continue;

    matches++;

    // ── Downtime parsing ────────────────────────────────────────────────────
    if (dateStr && timeStr && spvFaultRegex.test(line)) {
      const now = timeToDate(dateStr, timeStr);
      if (!activeDowntime) {
        activeDowntime = {
          date:         dateStr,
          startTime:    timeStr,
          lastSeenTime: now,
          reason:       "SPV Fault",
          interlocks:   []
        };
      } else {
        activeDowntime.lastSeenTime = now;
      }
    } else if (activeDowntime && dateStr && timeStr) {
      const now     = timeToDate(dateStr, timeStr);
      const diffMin = (now - activeDowntime.lastSeenTime) / 1000 / 60;

      if (diffMin >= DOWNTIME_GAP_MINUTES) {
        if (!downtimeByDate[activeDowntime.date]) {
          downtimeByDate[activeDowntime.date] = [];
        }
        downtimeByDate[activeDowntime.date].push({
          start:      activeDowntime.startTime,
          end:        formatTime(activeDowntime.lastSeenTime),
          reason:     activeDowntime.reason,
          interlocks: activeDowntime.interlocks
        });
        activeDowntime = null;
      }
    }

    // ── Interlock parsing ───────────────────────────────────────────────────
    const fallbackMatch = lineRegex.exec(line);
    let interlockId = null;
    let description = null;

    if (fallbackMatch) {
      interlockId = fallbackMatch[2];
      description = fallbackMatch[3].trim();
    } else {
      const idMatch = line.match(/\b(\d{6,7})\b/);
      interlockId   = idMatch ? idMatch[1] : "UNKNOWN";
      description   = line.trim();
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
        Type:        typeField,
        description,
        Times:       [timeStr],
        Dates:       [dateStr || null]
      });
    }

    results[interlockId].total += 1;

    if (progressCallback && i % 5000 === 0) {
      progressCallback(i, lines.length);
    }
  }
  // ─── End of main loop ──────────────────────────────────────────────────────

  // Flush open downtime
  if (activeDowntime) {
    if (!downtimeByDate[activeDowntime.date]) downtimeByDate[activeDowntime.date] = [];
    downtimeByDate[activeDowntime.date].push({
      start:      activeDowntime.startTime,
      end:        formatTime(activeDowntime.lastSeenTime),
      reason:     activeDowntime.reason,
      interlocks: activeDowntime.interlocks
    });
  }

  // Flush open SystemMode (file ended while mode still active)
  if (activeSystemMode) {
    if (!systemModesByDate[activeSystemMode.date]) {
      systemModesByDate[activeSystemMode.date] = [];
    }
    systemModesByDate[activeSystemMode.date].push({
      start: formatTime(activeSystemMode.startTime),
      end:   "24:00",
      mode:  activeSystemMode.mode
    });
  }

  return {
    results,
    totalLines:     total,
    matchLines:     matches,
    machineName,
    downtimeByDate,
    systemModesByDate,
    trendData
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Power events
// ─────────────────────────────────────────────────────────────────────────────

export const POWER_OFF_REGEX =
  /(\d{2}:\d{2}:\d{2}).*CMNInterlockMaster::assertInterlock.*Input Power is lost or instable.*asserted/i

export const POWER_ON_REGEX =
  /(\d{2}:\d{2}:\d{2}).*CMNInterlockMaster::releaseInterlock.*Input Power is lost or instable.*released/i

export function parsePowerEvents(lines) {
  const events = [];
  for (const line of lines) {
    let match;
    if ((match = line.match(POWER_OFF_REGEX))) events.push({ time: match[1], type: "OFF" });
    if ((match = line.match(POWER_ON_REGEX)))  events.push({ time: match[1], type: "ON"  });
  }
  return events;
}

export function buildPowerIntervals(events) {
  const intervals = [];
  let currentOff  = null;
  for (const e of events) {
    if (e.type === "OFF") currentOff = e.time;
    if (e.type === "ON" && currentOff) {
      intervals.push({ start: currentOff, end: e.time, type: "OFF" });
      currentOff = null;
    }
  }
  return intervals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Beam events
// ─────────────────────────────────────────────────────────────────────────────

const ENERGY_PALETTE = [
  "#2563eb", "#16a34a", "#9333ea", "#dc2626", "#ea580c",
  "#0891b2", "#b45309", "#be185d", "#4f46e5", "#15803d",
  "#c2410c", "#7c3aed", "#0f766e", "#d97706", "#1d4ed8",
];

const KV_COLOR = "#64748b";

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getEnergyColor(energy) {
  if (!energy || energy === "0k") return KV_COLOR;
  return ENERGY_PALETTE[hashString(energy) % ENERGY_PALETTE.length];
}

const BEAM_ON_ENTER_REGEX =
  /(\d{2}:\d{2}:\d{2}).*SPVSystemMode::BeamOnEnter Enter BeamOn state in (\w+) mode, energy ([^,]+), dose rate ([\d.]+) MU\/min/;

const BEAM_EXIT_REGEX =
  /(\d{2}:\d{2}:\d{2}).*BGMBeamCtrlLoop::Exit BeamOnToOff State Goto Beam off state, the last beam pulse counter is (\d+)/;

export function parseBeamEvents(lines) {
  const beams = [];
  let currentDate = null;
  let pending     = null;

  const dateLineRegex = /^\s*(\d{4}-\d{2}-\d{2})[\t ]+(\d{2}:\d{2}:\d{2})/;

  for (const line of lines) {
    const dateM = dateLineRegex.exec(line);
    if (dateM) currentDate = dateM[1];

    const onM = BEAM_ON_ENTER_REGEX.exec(line);
    if (onM) {
      if (pending) {
        beams.push({ ...pending, endTime: null, durationSec: null, pulseCount: null });
      }
      const energy = onM[3].trim();
      pending = {
        date:      currentDate,
        startTime: onM[1],
        energy,
        doseRate:  parseFloat(onM[4]),
        mode:      onM[2],
        isMV:      energy !== "0k",
      };
      continue;
    }

    const offM = BEAM_EXIT_REGEX.exec(line);
    if (offM && pending) {
      const endTime     = offM[1];
      const pulseCount  = parseInt(offM[2], 10);
      const toSec       = (t) => { const [h, m, s = 0] = t.split(":").map(Number); return h * 3600 + m * 60 + s; };
      const durationSec = Math.max(0, toSec(endTime) - toSec(pending.startTime));
      beams.push({ ...pending, endTime, durationSec, pulseCount });
      pending = null;
    }
  }

  if (pending) {
    beams.push({ ...pending, endTime: null, durationSec: null, pulseCount: null });
  }

  return beams;
}