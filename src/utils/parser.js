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

// -----------------------------
// Fault / interlock event parsing (Module 1)
// -----------------------------
// Faults carry 6–7 digit IDs; system interlocks carry 3–5 digit IDs, so the two
// never collide in the `results` map.
//
//   CMNFault::raise  Fault   detected (121000: <desc>), ...
//   CMNFault::ack    Fault   removed  (121000: <desc>), ...
//   CMNFault::update Fault   detected (225061: <desc>), ...   ← flapping, counted separately
//   CMNFault::raise  Warning upgraded to fault (310409: <desc>), ...   ← escalation, treated as raise
//
//   CMNInterlockMaster::assertInterlock  Interlock (3010: <flags>: <desc>) asserted in <mode> mode
//   CMNInterlockMaster::releaseInterlock Interlock (3010: <flags>: <desc>) released in <mode> mode
// Verbs seen in the logs: raise (detect), update (flapping re-detect), and the
// three removal verbs ack / unraise / clear. The old loose filter only caught
// raise/ack/unraise (the last by accident — "unraise" contains "raise"), missing
// update and clear entirely.
const FAULT_EVENT_REGEX =
  /CMNFault::(raise|ack|update|unraise|clear)\s+(?:Warning|Fault)\s+(detected|removed)\s+\((\d{6,7}):\s*(.*?)\),/i;
const FAULT_UPGRADE_REGEX =
  /CMNFault::raise\s+Warning\s+upgraded\s+to\s+fault\s+\((\d{6,7}):\s*(.*?)\),/i;
const INTERLOCK_EVENT_REGEX =
  /CMNInterlockMaster::(assert|release)Interlock\s+Interlock\s+\((\d{3,5}):\s*(.*?)\)\s+(?:asserted|released)\s+in\s+(\w+)\s+mode/i;

// Cheap pre-checks so we only run the heavy regexes on relevant lines.
const FAULT_LINE_HINT     = "CMNFault::";
const INTERLOCK_LINE_HINT = "InterlockMaster::";

// -----------------------------
// Node / network events (Module 2)
// -----------------------------
// Fixed fault ID per node — reconnect only ever appears as a `removed` of the
// same ID (there is no "node connected" message).
const NODE_DISCONNECT_IDS = {
  "121000": "BGM", "121500": "STN", "122000": "COL", "122500": "XI",
  "123000": "MVD", "123500": "CCHU", "124000": "CCHL", "124500": "KVD",
  "125000": "KVS"
};
const ALL_NODES_ID = "120001"; // "All nodes are disconnected …"

// SPV lost contact with a node / the network.
//   Admin_<NODE>_Cl::onHeartbeat Connection closed on socket N: Not received
//   heartbeat over NNNN millisecond
const HEARTBEAT_REGEX =
  /Admin_(\w+?)_Cl::onHeartbeat\s+Connection closed on socket\s+(\d+):\s+Not received heartbeat over\s+(\d+)/i;

// The Admin_<X>_Cl prefix uses shorter node aliases than the node lanes.
const HEARTBEAT_NODE_ALIAS = { CCU: "CCHU", CCL: "CCHL" };
function normalizeNodeName(raw) {
  const n = (raw || "").replace(/_+$/, ""); // strip trailing underscores (e.g. "XI_")
  return HEARTBEAT_NODE_ALIAS[n] || n;
}

// SPV cold-start / boot signatures. Every node loads config on boot, so we
// require the SPV node as the source to avoid counting per-node reboots.
const COLDSTART_CONFIG_HINT  = "loadConfigFile Start loading configuration file: /ata1/config.xml";
const COLDSTART_NETCOMM_HINT = "NCChannelFactory::starting";
const SPV_SOURCE_REGEX       = /\tSN#\s*\d{4}\tSPV\t/;

// A machine-node syslog line (source column = "SN# ####"). Used by the silence
// detector — when these stop while workstation lines continue, the SPV/syslog
// chain is down and events in that window are lost.
const MACHINE_SOURCE_REGEX = /\tSN#\s*\d{4}\t/;
const DEFAULT_SILENCE_GAP_MINUTES = 3;

// Infrastructure / PC down signatures (shown under the node lanes). SPV is derived
// from the silence gaps + cold-starts that already exist.
const CBCT_DISCONNECT_HINT = "to VCBCTStateDisconnected";      // CBCT entered disconnected
const CBCT_RECONNECT_HINT  = "from VCBCTStateDisconnected to"; // CBCT left disconnected
const EXIO_DOWN_HINT       = "EXIO Serial port UART";          // EXIO comms fault
const IMAGING_PSU_HINT     = "(513001:";                       // XI ↔ imaging PSU comms error
const IRM_UP_REGEX         = /(IRM[12]?) connection established/;

// -----------------------------
// Machine state (Module 3)
// -----------------------------
// Real machine state lives in SPVSystemMode, separate from the app mode
// ("switching to <X> mode"). ON/STANDBY carry the app mode they entered in.
const STATE_ENTER_REGEX =
  /SPVSystemMode::(?:ON mode|STANDBY mode|PowerOffEnter)\s+Enter\s+(ON|STANDBY|POWEROFF)\s+state(?:\s+in\s+(\w+)\s+mode)?/i;
// The checkPower line right after a transition tells us *why*:
//   "Power loop open …"  → node disconnect / power-loop break
//   "Power interlock …"  → real power loss (CB / EMO)
const CHECKPOWER_REGEX =
  /SPVSystemMode::checkPower\s+(Power loop open|Power interlock)\s+in\s+(\w+)\s+mode/i;
// Beam-side PEL signature (clinical mode).
const PEL_BEAM_HINT  = "Beam Controller enter Idle State";
const PEL_BEAM_REGEX = /BGMBeamController::Idle State Beam Controller enter Idle State\.\s*Reason:\s*(.+?)(?:,|$)/i;
// Mode-up attempt (workstation side).
const MODEUP_HINT = "StateController::ModeUp()";

// -----------------------------
// Power / CB / EMO (Module 4)
// -----------------------------
const POWER_INTERLOCK_ID = "3017";  // "Input Power is lost or instable"
const EMO_IDS = { "3021": "DKB EMO", "3026": "Modulator EMO", "3027": "EMOFF relays" };
const EMO_GROUP_GAP_SEC = 120;      // EMO sub-events within 2 min = one episode

// Known fault IDs → the circuit breaker / subsystem they point at, derived from
// the 2026-06-15 SB16 retest (breaker tripped at a known time → faults observed).
// `cb` may be an array when a fault can't be uniquely attributed (e.g. 334078
// filament power is shared by both thyratron breakers + CONT power). Breaker codes
// match BREAKER_CATALOG in the UI. Generic POS-PCB faults (214261/262/268, 227073)
// and RFSPS solenoid (2040/2041/2042) are deliberately NOT mapped — they fire for
// several causes (incl. EXIO PC tests) so attributing them to one breaker misleads.
export const CB_SIGNATURES = {
  "3016":   { cb: "CB1",   label: "S1PFN open (PFN)" },
  "340004": { cb: "CB2",   label: "Water pump fault" },
  "310409": { cb: "CB2",   label: "Klystron water flow low" },
  "225062": { cb: "CB3",   label: "RFSPS KSOLI accuracy error" },
  "225063": { cb: "CB3",   label: "RFSPS KSOLI repeatability error" },
  "211027": { cb: "CB3",   label: "Klystron current deviation" },
  "224050": { cb: "CB3",   label: "HV crowbar not charged" },
  "332012": { cb: "CB6",   label: "SPD 48V power out of range" },
  "332017": { cb: "CB6",   label: "SPD AC fan power out of range" },
  "331004": { cb: "CB7",   label: "GPD 28V power out of range" },
  "420301": { cb: "CB7",   label: "MLC fiber optic link down" },
  "415518": { cb: "CB7",   label: "Y1 motor 28V out of range" },
  "3017":   { cb: "CB8",   label: "Input power lost / instable" },
  "210021": { cb: "CB9",   label: "Klystron filament voltage (KFIL)" },
  "224082": { cb: "CB9",   label: "Klystron filament fault" },
  "813045": { cb: "CB12",  label: "CouchVrt DMD power fault" },
  "334078": { cb: ["DQTHY", "MAINTHY"], label: "Filament power interrupted (thyratron)" },
  "513900": { cb: "KVGEN", label: "Unknown X-ray generator fault" },
  "513924": { cb: "KVGEN", label: "EMD generator fault" },
  "513925": { cb: "KVGEN", label: "XI failed to connect to EMD generator" },
};
const FLAP_WINDOW_SEC = 60;   // consecutive assert/release events ≤60s apart …
const FLAP_MIN_EVENTS = 3;    // … chained into a burst of ≥3 = flapping

// -----------------------------
// Sessions / logins (Module 5)
// -----------------------------
const LOGIN_REGEX        = /Invoking task (\w+) using Login Technique (SF|HASP|SoftHASP|Password)/;
const FAILED_LOGIN_REGEX = /Login attempt for LoginTechnique (SF|HASP|SoftHASP|Password) failed/i;
const PROC_EXE_REGEX     = /(\w+)\.exe\b/;            // app name from the process column
const PLAN_UID_REGEX     = /Plan PlanUID:\s*([0-9.]+)/;
// Task name → friendly display name (others pass through unchanged).
const APP_NAME_MAP = {
  MorningCheckout:         "Machine QA",
  MachinePerformanceCheck: "MPC",
  PVACalibration:          "Imager Calibration",
  AdvancedReconstruction:  "Adv. Reconstruction",
};

// Second login signature: "Starting process=…\<exe> using domain=<d> user=<u>".
// REQUIRED because Service Mode is logged ONLY this way — it never produces an
// "Invoking task" line — and this form carries the domain + user directly.
const PROCESS_LOGIN_REGEX = /Starting process=.*\\([\w.]+\.exe) using domain=(\w+) user=(\S+)/i;
const EXE_TO_MODE = {
  "vms.itc.servicemode.servicemode.exe": "Service",
  "vms.itc.clinical.exe":                "Treatment",
  "vms.ti.calibration.app.exe":          "Imager Calibration",
  "vms.itc.pmi.instantpmi.view.exe":     "PMI",
  "vms.cr.ar.exe":                       "Adv. Reconstruction",
  "vms.ti.pva.app.exe":                  "Imaging/PVA",
};
// PVA/AR auto-start as secondary apps seconds after a primary login — they must
// not become their own login rows when they trail a primary within the window.
// PVA/AR follow a Treatment login; Imager Calibration is auto-opened by Service
// Mode (a `process` launch ~1s after the Service login). These trailing `process`
// launches are folded; the standalone Imager Calibration *task* login is kept.
const SECONDARY_APPS  = new Set(["Imaging/PVA", "Adv. Reconstruction", "Imager Calibration"]);
// Window for treating two logins as one session. The spec suggested 10s, but the
// real logs show the "Invoking task" and "Starting process=" forms of the SAME
// login arriving 15–80s apart (machine/version dependent); distinct same-app
// sessions are >100s apart, so 90s merges the pairs without over-merging.
const LOGIN_DEDUP_SEC = 90;
const RESTART_SIGNATURES = [
  { hint: "ClinacModelServer module starting", kind: "cms-restart" },
  { hint: "InitAssistant module started",       kind: "initialize" },
  { hint: "OrchestratorConsole module started", kind: "login-screen" },
];
// Older software versions don't log "Invoking task … Login Technique"; they log
// logins via HIPAA logging instead. Used as a fallback so the session timeline
// still works on those machines.
const HIPAA_LOGIN_REGEX = /HIPAALogging: User\[([^\]]*)\],\s*Comment\["Login Primary User"\]/;
// Any HIPAA line carries the active operator — used to attach "who" to logins.
const HIPAA_USER_REGEX  = /HIPAALogging: User\[([^\]]*)\]/;
function normalizeUser(u) {
  return (u || "").replace(/^.*\\/, "").trim();  // drop domain prefix (sikt\kengro → kengro)
}

// Collapse logins that describe the same session across sources. The same login
// is often recorded twice (e.g. "Invoking task Treatment" + "Starting process
// …clinical.exe") within seconds, while Service Mode appears only as `process`.
// Rules: drop secondary-app (PVA/AR) process logins that trail any primary login
// within the window; merge same-app logins within the window, taking `technique`
// from the task source and `user`/`domain` from the process source, keeping the
// earliest time. Order-independent.
function loginSecOf(t) {
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
function dedupLogins(raw) {
  const sorted = [...raw].sort((a, b) => loginSecOf(a.time) - loginSecOf(b.time));
  const primarySecs = sorted.filter(l => !SECONDARY_APPS.has(l.app)).map(l => loginSecOf(l.time));
  const result = [];
  for (const lg of sorted) {
    const lgSec = loginSecOf(lg.time);
    // Drop a secondary-app (PVA/AR) process login that sits next to any primary
    if (lg.source === "process" && SECONDARY_APPS.has(lg.app) &&
        primarySecs.some(ps => Math.abs(ps - lgSec) <= LOGIN_DEDUP_SEC)) {
      continue;
    }
    // Merge with an existing same-app login inside the window
    const dup = result.find(r => r.app === lg.app && Math.abs(loginSecOf(r.time) - lgSec) <= LOGIN_DEDUP_SEC);
    if (dup) {
      if (lg.source === "task" && lg.technique) dup.technique = lg.technique;
      if (lg.source === "process") {
        if (lg.user)   dup.user   = lg.user;
        if (lg.domain) dup.domain = lg.domain;
      }
      if (lgSec < loginSecOf(dup.time)) { dup.time = lg.time; dup.date = lg.date; } // earliest
      continue;
    }
    result.push({ ...lg });
  }
  return result;
}

// Split "A B: description" → { flags: "A B", text: "description" }. Some
// interlocks have no flag section (no inner colon) — handle both.
function splitInterlockBody(body) {
  const idx = body.indexOf(":");
  if (idx === -1) return { flags: "", text: body.trim() };
  return { flags: body.slice(0, idx).trim(), text: body.slice(idx + 1).trim() };
}

// "HH:MM:SS" → seconds since midnight.
function toSecOfDay(t) {
  const [h, m, s = 0] = t.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}
// seconds since midnight → "HH:MM:SS".
function secToHHMMSS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
// Seconds between two "HH:MM:SS" stamps on the same day (never negative).
function diffSeconds(startTime, endTime) {
  return Math.max(0, toSecOfDay(endTime) - toSecOfDay(startTime));
}

// Convert an in-progress EMO episode into its public shape (Module 4).
function finalizeEmo(e) {
  return {
    date: e.date, start: e.start, end: e.end, eventCount: e.eventCount,
    triggers: [...e._ids].map((id) => ({ id, name: EMO_IDS[id] }))
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function parseLogText(text, progressCallback, options = {}) {
  const silenceGapMinutes = options.silenceGapMinutes ?? DEFAULT_SILENCE_GAP_MINUTES;

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
  let lastStampSec = 0;   // last timestamp seen in the log (for end-of-day capping)

  // Downtime state
  const downtimeByDate = {};
  let activeDowntime   = null;

  // SystemMode state
  const systemModesByDate = {};
  let activeSystemMode    = null;

  // Fault-interval state (Module 1.2) — raise↔removed pairing + orphan removals
  const faultIntervals = [];          // [{ id, date, start, end, durationSec, description, open }]
  const orphanRemovals = [];          // [{ id, date, time, description }]
  const openFaults     = {};          // id -> { date, startTime, description }

  // System-interlock state (Module 1.3) — assert↔release pairing
  const interlockEvents    = [];      // [{ id, date, time, action, flags, description, mode }]
  const interlockIntervals = [];      // [{ id, date, start, end, durationSec, flags, description, mode, open }]
  const openInterlocks     = {};      // id -> { date, startTime, flags, text, mode }

  // Node / network state (Module 2)
  const nodeEvents      = [];         // [{ node, id, date, time, type:'disconnect'|'reconnect' }]
  const nodeEventSeen   = new Set();  // de-dup identical id|time|type (same-second doubles)
  const heartbeatLosses = [];         // [{ node, date, time, socket, ms }]
  const coldStarts      = [];         // [{ date, time, kind }]
  const coldStartSeen   = new Set();  // de-dup cold-start by time within the file
  const silenceGaps     = [];         // [{ start:{date,time}, end:{date,time}, durationMin }]
  let lastMachineTs     = null;       // Date of the previous "SN# ####" line
  let lastMachineStamp  = null;       // { date, time } of that line
  let wkstSinceMachine  = 0;          // workstation lines seen since last machine line

  // Infrastructure / PC down events (Module 2 extension)
  const cbctDowns       = [];         // [{ date, start, end, open }]
  let   cbctOpen        = null;
  const exioEvents      = [];         // [{ date, time }]
  const imagingPsuEvents = [];        // [{ date, time }]
  const irmEvents       = [];         // [{ date, time, which }]
  const infraSeen       = new Set();  // de-dup component|minute

  // Machine state (Module 3)
  const stateEvents     = [];         // every "Enter X state" line (incl. re-entries)
  const machineStates   = [];         // collapsed [{ date, start, end, state, appMode, cause }]
  let activeState       = null;       // { date, startTime, state, appMode, cause }
  const modeUpAttempts  = [];         // [{ date, time }]
  const modeUpLatencies = [];         // [{ date, firstAttempt, onTime, latencySec, attemptCount }]
  let pendingModeUps    = [];         // attempts (sec) since the last ON transition
  const pelEvents       = [];         // [{ date, time, source, inferred, mode, reason }]

  // Sessions / logins (Module 5)
  let   logins       = [];            // [{ date, time, app, rawApp, technique, user?, domain?, source }]
  const failedLogins = [];            // [{ date, time, technique, app }]
  const restarts     = [];            // [{ date, time, kind }]
  const planLoads    = [];            // [{ date, time, planUid }]
  let lastPlanUid    = null;
  const hipaaLogins  = [];            // fallback logins (older software)
  const hipaaUserEvents = [];         // [{ sec, user }] — operator activity (for "who")

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

    if (dateStr && timeStr) lastStampSec = toSecOfDay(timeStr);

    // ── Node / network events (Module 2) ─────────────────────────────────────
    if (dateStr && timeStr) {
      // Silence detector: gap between consecutive machine-source ("SN# ####")
      // lines. `wkstLines` = workstation lines that arrived during the gap — when
      // >0 the syslog chain was down while the workstation kept logging (events
      // lost); when 0 the machine was simply idle. The consumer can filter on it.
      if (line.indexOf("SN# ") !== -1 && MACHINE_SOURCE_REGEX.test(line)) {
        const nowTs = timeToDate(dateStr, timeStr);
        if (lastMachineTs) {
          const gapMin = (nowTs - lastMachineTs) / 1000 / 60;
          if (gapMin >= silenceGapMinutes) {
            silenceGaps.push({
              start: lastMachineStamp,
              end:   { date: dateStr, time: timeStr },
              durationMin: Math.round(gapMin * 10) / 10,
              wkstLines: wkstSinceMachine
            });
          }
        }
        lastMachineTs    = nowTs;
        lastMachineStamp = { date: dateStr, time: timeStr };
        wkstSinceMachine = 0;
      } else {
        // A non-machine (workstation) line with a timestamp
        wkstSinceMachine++;
      }

      // SPV heartbeat loss (connection to a node/network dropped)
      if (line.indexOf("onHeartbeat") !== -1) {
        const hbM = HEARTBEAT_REGEX.exec(line);
        if (hbM) {
          heartbeatLosses.push({
            node: normalizeNodeName(hbM[1]), date: dateStr, time: timeStr,
            socket: hbM[2], ms: parseInt(hbM[3], 10)
          });
        }
      }

      // SPV cold-start / boot — config.xml load (or NetComm running) from SPV only
      const hasConfig  = line.indexOf(COLDSTART_CONFIG_HINT) !== -1;
      const hasNetcomm = !hasConfig && line.indexOf(COLDSTART_NETCOMM_HINT) !== -1;
      if ((hasConfig || hasNetcomm) && SPV_SOURCE_REGEX.test(line) && !coldStartSeen.has(timeStr)) {
        coldStartSeen.add(timeStr);
        coldStarts.push({ date: dateStr, time: timeStr, kind: hasConfig ? "config-load" : "netcomm-running" });
      }

      // ── Infrastructure / PC down (CBCT, EXIO, Imaging PSU, IRM) ───────────
      const minute = timeStr.slice(0, 5);
      const once = (tag) => { const k = tag + minute; if (infraSeen.has(k)) return false; infraSeen.add(k); return true; };

      if (line.indexOf("VCBCTStateDisconnected") !== -1) {
        if (line.indexOf(CBCT_RECONNECT_HINT) !== -1) {
          if (cbctOpen) { cbctDowns.push({ date: cbctOpen.date, start: cbctOpen.time, end: timeStr, open: false }); cbctOpen = null; }
        } else if (line.indexOf(CBCT_DISCONNECT_HINT) !== -1 && !cbctOpen) {
          cbctOpen = { date: dateStr, time: timeStr };
        }
      }
      if (line.indexOf(EXIO_DOWN_HINT) !== -1 && once("EXIO")) {
        exioEvents.push({ date: dateStr, time: timeStr });
      }
      if (line.indexOf(IMAGING_PSU_HINT) !== -1 && once("PSU")) {
        imagingPsuEvents.push({ date: dateStr, time: timeStr });
      }
      if (line.indexOf("connection established") !== -1) {
        const im = IRM_UP_REGEX.exec(line);
        if (im && once("IRM" + im[1])) irmEvents.push({ date: dateStr, time: timeStr, which: im[1] });
      }
    }

    // ── Machine state (Module 3) ─────────────────────────────────────────────
    if (dateStr && timeStr) {
      // Mode-up attempt (workstation)
      if (line.indexOf(MODEUP_HINT) !== -1) {
        modeUpAttempts.push({ date: dateStr, time: timeStr });
        pendingModeUps.push(toSecOfDay(timeStr));
      }

      // State transition ON / STANDBY / POWEROFF
      if (line.indexOf("SPVSystemMode::") !== -1) {
        const sm = STATE_ENTER_REGEX.exec(line);
        if (sm) {
          const newState = sm[1].toUpperCase();
          const appMode  = sm[2] ? sm[2].toLowerCase() : null;
          stateEvents.push({ date: dateStr, time: timeStr, state: newState, appMode });
          // Collapse consecutive identical states
          if (!activeState || activeState.state !== newState) {
            if (activeState) {
              machineStates.push({
                date: activeState.date, start: activeState.startTime, end: timeStr,
                state: activeState.state, appMode: activeState.appMode, cause: activeState.cause
              });
            }
            activeState = { date: dateStr, startTime: timeStr, state: newState, appMode, cause: null };

            // Mode-up latency: pair pending attempts with this ON
            if (newState === "ON" && pendingModeUps.length) {
              const first = pendingModeUps[0];
              const onSec = toSecOfDay(timeStr);
              const latency = onSec - first;
              if (latency >= 0 && latency <= 3600) {  // ignore stale pairings (>1h)
                modeUpLatencies.push({
                  date: dateStr,
                  firstAttempt: secToHHMMSS(first),
                  onTime: timeStr,
                  latencySec: latency,
                  attemptCount: pendingModeUps.length
                });
              }
            }
            if (newState === "ON") pendingModeUps = [];
          }
        }

        // checkPower cause → attach to the segment we just entered
        const cp = CHECKPOWER_REGEX.exec(line);
        if (cp && activeState) {
          const raw = cp[1];
          activeState.cause = {
            raw,
            category: /loop open/i.test(raw) ? "power-loop-open" : "power-interlock",
            mode: cp[2] ? cp[2].toLowerCase() : null
          };
          // Inferred PEL in service mode: POWEROFF reached via a power interlock
          if (activeState.state === "POWEROFF" &&
              activeState.cause.category === "power-interlock" &&
              (activeState.appMode === "service" || activeState.cause.mode === "service")) {
            pelEvents.push({
              date: dateStr, time: timeStr, source: "inferred", inferred: true,
              mode: "service", reason: raw
            });
          }
        }
      }

      // Beam-side PEL (clinical) — reliable, not inferred
      if (line.indexOf(PEL_BEAM_HINT) !== -1) {
        const pm = PEL_BEAM_REGEX.exec(line);
        if (pm && /PEL open detected/i.test(pm[1])) {
          pelEvents.push({
            date: dateStr, time: timeStr, source: "beam", inferred: false,
            mode: activeState?.appMode || null, reason: pm[1].trim()
          });
        }
      }
    }

    // ── Sessions / logins (Module 5) ─────────────────────────────────────────
    if (dateStr && timeStr) {
      if (line.indexOf("Invoking task ") !== -1) {
        const lm = LOGIN_REGEX.exec(line);
        // "Logoff"/"Logout" are session-end tasks, not logins — skip.
        if (lm && !/^log(off|out)$/i.test(lm[1])) {
          logins.push({
            date: dateStr, time: timeStr, source: "task",
            rawApp: lm[1], app: APP_NAME_MAP[lm[1]] || lm[1], technique: lm[2]
          });
        }
      } else if (line.indexOf("Login attempt for LoginTechnique") !== -1) {
        const fm = FAILED_LOGIN_REGEX.exec(line);
        if (fm) {
          const pm = PROC_EXE_REGEX.exec(line);
          failedLogins.push({ date: dateStr, time: timeStr, technique: fm[1], app: pm ? pm[1] : null });
        }
      } else if (line.indexOf("module start") !== -1) {
        for (const sig of RESTART_SIGNATURES) {
          if (line.indexOf(sig.hint) !== -1) {
            restarts.push({ date: dateStr, time: timeStr, kind: sig.kind });
            break;
          }
        }
      } else if (line.indexOf("Plan PlanUID") !== -1) {
        const pum = PLAN_UID_REGEX.exec(line);
        if (pum && pum[1] !== lastPlanUid) {
          lastPlanUid = pum[1];
          planLoads.push({ date: dateStr, time: timeStr, planUid: pum[1] });
        }
      } else if (line.indexOf("Login Primary User") !== -1) {
        const hm = HIPAA_LOGIN_REGEX.exec(line);
        if (hm) hipaaLogins.push({ date: dateStr, time: timeStr, user: hm[1] });
      } else if (line.indexOf("Starting new process") !== -1 &&
                 line.indexOf("SystemAdmin.SystemAdmin.exe") !== -1) {
        // System Administration launches via DUHost, not "Invoking task"
        logins.push({
          date: dateStr, time: timeStr, source: "task",
          rawApp: "SystemAdmin", app: "System Administration", technique: null
        });
      } else if (line.indexOf("Starting process=") !== -1) {
        // The only form Service Mode logs on; carries domain + user directly.
        const pm = PROCESS_LOGIN_REGEX.exec(line);
        const mode = pm && EXE_TO_MODE[pm[1].toLowerCase()];
        if (mode) {
          logins.push({
            date: dateStr, time: timeStr, source: "process",
            rawApp: mode, app: mode, user: normalizeUser(pm[3]), domain: pm[2], technique: null
          });
        }
      }

      // Track the active operator from any HIPAA line (used to attach "who")
      if (line.indexOf("HIPAALogging: User[") !== -1) {
        const um = HIPAA_USER_REGEX.exec(line);
        if (um) hipaaUserEvents.push({ sec: toSecOfDay(timeStr), user: normalizeUser(um[1]) });
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

    // ── System-interlock parsing (Module 1.3) ───────────────────────────────
    // Handled before faults and short-circuited: interlock lines never feed the
    // fault `results` map. Builds a flat event list + matched assert↔release
    // intervals (e.g. 3010 warm-up, 3017 power — consumed by Modules 3 & 4).
    if (dateStr && timeStr && line.includes(INTERLOCK_LINE_HINT)) {
      const ilM = INTERLOCK_EVENT_REGEX.exec(line);
      if (ilM) {
        const action = ilM[1].toLowerCase();        // assert | release
        const id     = ilM[2];
        const { flags, text } = splitInterlockBody(ilM[3]);
        const mode   = ilM[4].toLowerCase();

        interlockEvents.push({
          id, date: dateStr, time: timeStr, action, flags, description: text, mode
        });

        if (action === "assert") {
          // Keep the earliest open assert; ignore re-asserts while already open
          if (!openInterlocks[id]) {
            openInterlocks[id] = { date: dateStr, startTime: timeStr, flags, text, mode };
          }
        } else {
          const open = openInterlocks[id];
          if (open) {
            interlockIntervals.push({
              id, date: open.date,
              start: open.startTime, end: timeStr,
              durationSec: diffSeconds(open.startTime, timeStr),
              flags: open.flags, description: open.text, mode: open.mode, open: false
            });
            delete openInterlocks[id];
          } else {
            // Release with no matching assert in this file (orphan release)
            interlockIntervals.push({
              id, date: dateStr,
              start: null, end: timeStr, durationSec: null,
              flags, description: text, mode, open: false
            });
          }
        }
        continue;
      }
    }

    // ── Fault parsing (Module 1.1 / 1.2) ─────────────────────────────────────
    let verb = null, action = null, interlockId = null, description = null;
    if (dateStr && timeStr && line.includes(FAULT_LINE_HINT)) {
      const fM = FAULT_EVENT_REGEX.exec(line);
      if (fM) {
        verb        = fM[1].toLowerCase();   // raise | ack | update
        action      = fM[2].toLowerCase();   // detected | removed
        interlockId = fM[3];
        description = fM[4].trim();
      } else {
        const uM = FAULT_UPGRADE_REGEX.exec(line);
        if (uM) {
          verb        = "upgrade";           // Warning escalated to Fault → treat as raise
          action      = "detected";
          interlockId = uM[1];
          description = uM[2].trim();
        }
      }
    }

    if (!verb) continue;   // not a fault line we track

    matches++;

    const typeMatch = faultTypeRegex.exec(line);
    const typeField = typeMatch ? typeMatch[1] : "N/A";

    // Node disconnect/reconnect events (Module 2.1). Each raise of a node ID is a
    // discrete disconnect event (re-raises while open are deliberate test actions,
    // not collapsed); each removal is a reconnect. De-dup same-second doubles.
    if (NODE_DISCONNECT_IDS[interlockId] || interlockId === ALL_NODES_ID) {
      const evType = action === "detected" ? "disconnect" : "reconnect";
      const key = `${interlockId}|${timeStr}|${evType}`;
      if (!nodeEventSeen.has(key)) {
        nodeEventSeen.add(key);
        nodeEvents.push({
          node: NODE_DISCONNECT_IDS[interlockId] || "ALL",
          id: interlockId, date: dateStr, time: timeStr, type: evType
        });
      }
    }

    if (!results[interlockId]) {
      results[interlockId] = { entries: [], total: 0, updates: 0 };
    }

    let entry = null;
    for (const e of results[interlockId].entries) {
      if (e.description === description && e.Type === typeField) { entry = e; break; }
    }
    if (!entry) {
      entry = { Type: typeField, description, Times: [], Dates: [], updates: 0 };
      results[interlockId].entries.push(entry);
    }

    if (verb === "update") {
      // Flapping re-detection — counted separately, never a new raise.
      entry.updates += 1;
      results[interlockId].updates += 1;
    } else {
      entry.Times.push(timeStr);
      entry.Dates.push(dateStr || null);
      results[interlockId].total += 1;

      // Downtime: keep exactly the original trigger set (raise / ack / unraise —
      // the verbs the old loose filter matched) so downtimeByDate is unchanged.
      // `clear` and `upgrade` are new to Times and deliberately excluded here.
      if (verb === "raise" || verb === "ack" || verb === "unraise") {
        if (spvFaultRegex.test(line)) {
          const now = timeToDate(dateStr, timeStr);
          if (!activeDowntime) {
            activeDowntime = {
              date: dateStr, startTime: timeStr, lastSeenTime: now,
              reason: "SPV Fault", interlocks: []
            };
          } else {
            activeDowntime.lastSeenTime = now;
          }
        } else if (activeDowntime) {
          const now     = timeToDate(dateStr, timeStr);
          const diffMin = (now - activeDowntime.lastSeenTime) / 1000 / 60;
          if (diffMin >= DOWNTIME_GAP_MINUTES) {
            if (!downtimeByDate[activeDowntime.date]) downtimeByDate[activeDowntime.date] = [];
            downtimeByDate[activeDowntime.date].push({
              start:      activeDowntime.startTime,
              end:        formatTime(activeDowntime.lastSeenTime),
              reason:     activeDowntime.reason,
              interlocks: activeDowntime.interlocks
            });
            activeDowntime = null;
          }
        }
        if (activeDowntime && interlockId && description) {
          const label = `${interlockId} – ${description}`;
          if (!activeDowntime.interlocks.includes(label)) {
            activeDowntime.interlocks.push(label);
          }
        }
      }

      // Fault intervals + orphan removals (Module 1.2)
      if (action === "detected") {
        if (!openFaults[interlockId]) {
          openFaults[interlockId] = { date: dateStr, startTime: timeStr, description };
        }
      } else {
        const open = openFaults[interlockId];
        if (open) {
          faultIntervals.push({
            id: interlockId, date: open.date,
            start: open.startTime, end: timeStr,
            durationSec: diffSeconds(open.startTime, timeStr),
            description: open.description, open: false
          });
          delete openFaults[interlockId];
        } else {
          // Removal with no preceding raise — syslog chain died when the fault
          // occurred (power/network cut), so only the cleanup reached the log.
          orphanRemovals.push({ id: interlockId, date: dateStr, time: timeStr, description });
        }
      }
    }

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

  // "Parked for the day": when no explicit logout/standby is logged, open segments
  // shouldn't run to midnight. Many firmwares (e.g. SN5724) never log STANDBY and
  // keep emitting routine odometer/heartbeat lines for hours after the operator
  // parks, so the LAST log line is a poor cap. Instead cap at the last *operator-
  // meaningful* event (login, state change, fault, interlock, node, plan) — or, if
  // the machine ended in STANDBY/POWEROFF after the last login, at that park point.
  const taskLoginSecs = logins.filter(l => l.source === "task").map(l => toSecOfDay(l.time));
  const lastLoginSec  = taskLoginSecs.length ? Math.max(...taskLoginSecs) : 0;
  const eventTimes = [];
  for (const l of logins)          eventTimes.push(toSecOfDay(l.time));
  for (const s of stateEvents)     eventTimes.push(toSecOfDay(s.time));
  for (const e of interlockEvents) eventTimes.push(toSecOfDay(e.time));
  for (const o of orphanRemovals)  eventTimes.push(toSecOfDay(o.time));
  for (const iv of faultIntervals) eventTimes.push(toSecOfDay(iv.end || iv.start));
  for (const e of nodeEvents)      eventTimes.push(toSecOfDay(e.time));
  for (const p of planLoads)       eventTimes.push(toSecOfDay(p.time));
  const lastEventSec = eventTimes.length ? Math.max(...eventTimes) : lastStampSec;

  const allStates = activeState
    ? [...machineStates, { start: activeState.startTime, state: activeState.state }]
    : machineStates;
  const lastState = allStates.length ? allStates[allStates.length - 1] : null;
  let parkedSec = lastEventSec;
  if (lastState && (lastState.state === "STANDBY" || lastState.state === "POWEROFF") && lastState.start) {
    const ss = toSecOfDay(lastState.start);
    if (ss >= lastLoginSec) parkedSec = ss;
  }
  const parkedAt = secToHHMMSS(parkedSec);

  // Flush open SystemMode (capped at the parked time, not midnight)
  if (activeSystemMode) {
    if (!systemModesByDate[activeSystemMode.date]) {
      systemModesByDate[activeSystemMode.date] = [];
    }
    systemModesByDate[activeSystemMode.date].push({
      start: formatTime(activeSystemMode.startTime),
      end:   parkedAt.slice(0, 5),
      mode:  activeSystemMode.mode
    });
  }

  // Flush faults still open at EOF (raised but never removed in this file)
  for (const [id, open] of Object.entries(openFaults)) {
    faultIntervals.push({
      id, date: open.date,
      start: open.startTime, end: null, durationSec: null,
      description: open.description, open: true
    });
  }

  // Flush interlocks still open at EOF (asserted but never released)
  for (const [id, open] of Object.entries(openInterlocks)) {
    interlockIntervals.push({
      id, date: open.date,
      start: open.startTime, end: null, durationSec: null,
      flags: open.flags, description: open.text, mode: open.mode, open: true
    });
  }

  // Flush open CBCT-down at EOF
  if (cbctOpen) cbctDowns.push({ date: cbctOpen.date, start: cbctOpen.time, end: null, open: true });

  // Flush open machine state (Module 3)
  if (activeState) {
    machineStates.push({
      date: activeState.date, start: activeState.startTime, end: null,
      state: activeState.state, appMode: activeState.appMode, cause: activeState.cause
    });
  }

  // Derive per-node disconnect intervals (Module 2.1) from the discrete node
  // events. Re-disconnects while already open stay in `nodeEvents` as markers but
  // don't open a second interval; a reconnect with no open disconnect is an
  // orphan (its raise was lost in a silence gap).
  const nodeDisconnects = [];
  const eventsByNode = {};
  for (const e of nodeEvents) (eventsByNode[e.id] ??= []).push(e);
  for (const [id, evs] of Object.entries(eventsByNode)) {
    let open = null;
    for (const e of evs) {
      if (e.type === "disconnect") {
        if (!open) open = e;
      } else {
        if (open) {
          nodeDisconnects.push({
            node: e.node, id, date: open.date,
            disconnect: open.time, reconnect: e.time,
            durationSec: diffSeconds(open.time, e.time),
            stillOpen: false, orphanReconnect: false
          });
          open = null;
        } else {
          nodeDisconnects.push({
            node: e.node, id, date: e.date,
            disconnect: null, reconnect: e.time, durationSec: null,
            stillOpen: false, orphanReconnect: true
          });
        }
      }
    }
    if (open) {
      nodeDisconnects.push({
        node: open.node, id, date: open.date,
        disconnect: open.time, reconnect: null, durationSec: null,
        stillOpen: true, orphanReconnect: false
      });
    }
  }

  // Deduplicate logins across sources (task / process / SystemAdmin) — collapses
  // the same session logged multiple ways and folds away PVA/AR secondary apps.
  logins = dedupLogins(logins);

  // Login fallback (Module 5): LAST resort only. Now that `Starting process=` is
  // captured, `logins` is rarely empty — this fires only for old software that
  // logs neither "Invoking task" nor "Starting process=", just HIPAA logging.
  if (logins.length === 0 && hipaaLogins.length > 0) {
    // HIPAA logins carry only the user, not the mode. Best-effort: attach the
    // system mode ("switching to X mode") active at the login time so the UI can
    // show which mode the user logged into rather than just the username.
    const MODE_FRIENDLY = { CLINICAL: "Clinical", SERVICE: "Service", QA: "QA", SMC: "SMC", PMI: "PMI", INSTALL: "Install" };
    const allModes = Object.values(systemModesByDate).flat();
    const modeAt = (sec) => {
      let best = null;
      for (const m of allModes) {
        const s = toSecOfDay(m.start);
        const e = m.end === "24:00" ? 86400 : toSecOfDay(m.end);
        if (sec >= s && sec < e) return m.mode;   // mode interval contains the login
        if (s <= sec) best = m.mode;              // else the last mode entered before it
      }
      return best;
    };
    for (const h of hipaaLogins) {
      const u = normalizeUser(h.user);
      const mode = modeAt(toSecOfDay(h.time));
      logins.push({
        date: h.date, time: h.time, source: "hipaa",
        rawApp: u, app: mode ? MODE_FRIENDLY[mode] || mode : u, user: u, technique: null
      });
    }
  }

  // Attach the operator ("who") to each login from the nearest HIPAA user activity
  // (within 30 min). Newer software logs the task but not the user on the login line.
  if (hipaaUserEvents.length) {
    for (const lg of logins) {
      if (lg.user) continue;
      const lsec = toSecOfDay(lg.time);
      let best = null, bestD = Infinity;
      for (const ue of hipaaUserEvents) {
        const d = Math.abs(ue.sec - lsec);
        if (d < bestD) { bestD = d; best = ue; }
      }
      lg.user = best && bestD <= 1800 ? best.user : null;
    }
  }

  // Warm-up delays (Module 3.5): interlock 3010 assert→release measures the
  // klystron filament warm-up wait directly.
  const warmupDelays = interlockIntervals
    .filter((iv) => iv.id === "3010" && iv.start && iv.end)
    .map((iv) => ({ date: iv.date, start: iv.start, end: iv.end, durationSec: iv.durationSec }));

  // ── Module 4 derivations (no extra pass) ──────────────────────────────────

  // Power-loss intervals (4.1): 3017 assert→release, flagged when they span a
  // silence gap (the interval may not be one continuous outage).
  const powerLossIntervals = interlockIntervals
    .filter((iv) => iv.id === POWER_INTERLOCK_ID)
    .map((iv) => {
      let spansSilenceGap = false;
      if (iv.start && iv.end) {
        const a = toSecOfDay(iv.start), b = toSecOfDay(iv.end);
        spansSilenceGap = silenceGaps.some((g) =>
          toSecOfDay(g.start.time) < b && toSecOfDay(g.end.time) > a);
      }
      return { date: iv.date, start: iv.start, end: iv.end, durationSec: iv.durationSec, open: iv.open, spansSilenceGap };
    });

  // EMO episodes (4.2): group EMO interlock events (3021/3026/3027) within 2 min.
  const emoRaw = interlockEvents
    .filter((e) => EMO_IDS[e.id])
    .sort((a, b) => toSecOfDay(a.time) - toSecOfDay(b.time));
  const emoEvents = [];
  let curEmo = null;
  for (const e of emoRaw) {
    const sec = toSecOfDay(e.time);
    if (curEmo && sec - curEmo._lastSec <= EMO_GROUP_GAP_SEC) {
      curEmo._lastSec = sec; curEmo.end = e.time; curEmo.eventCount++;
      curEmo._ids.add(e.id);
    } else {
      if (curEmo) emoEvents.push(finalizeEmo(curEmo));
      curEmo = { date: e.date, start: e.time, end: e.time, _lastSec: sec, eventCount: 1, _ids: new Set([e.id]) };
    }
  }
  if (curEmo) emoEvents.push(finalizeEmo(curEmo));

  // Flapping bursts (4.4): an interlock with ≥3 assert/release events chained
  // within 5 min of each other.
  const flappingGroups = [];
  const evByIl = {};
  for (const e of interlockEvents) (evByIl[e.id] ??= []).push(e);
  for (const [id, evs] of Object.entries(evByIl)) {
    evs.sort((a, b) => toSecOfDay(a.time) - toSecOfDay(b.time));
    let i = 0;
    while (i < evs.length) {
      let j = i;
      while (j + 1 < evs.length &&
             toSecOfDay(evs[j + 1].time) - toSecOfDay(evs[j].time) <= FLAP_WINDOW_SEC) j++;
      const count = j - i + 1;
      if (count >= FLAP_MIN_EVENTS) {
        flappingGroups.push({
          id, count, start: evs[i].time, end: evs[j].time,
          flags: evs[i].flags, description: evs[i].description
        });
      }
      i = j + 1;
    }
  }

  // CB-signature hits (4.3): which known breaker signatures fired, with counts.
  const cbHits = [];
  const cbSeen = {};
  const recordCb = (id, time) => {
    const sig = CB_SIGNATURES[id];
    if (!sig) return;
    if (!cbSeen[id]) {
      cbSeen[id] = { id, cb: sig.cb, label: sig.label, count: 0, first: time, last: time };
      cbHits.push(cbSeen[id]);
    }
    const h = cbSeen[id];
    h.count++;
    if (time < h.first) h.first = time;
    if (time > h.last)  h.last = time;
  };
  for (const [id, data] of Object.entries(results)) {
    if (!CB_SIGNATURES[id]) continue;
    for (const e of data.entries) for (const t of e.Times) recordCb(id, t);
  }
  for (const e of interlockEvents) recordCb(e.id, e.time);

  return {
    results,
    totalLines:     total,
    matchLines:     matches,
    machineName,
    downtimeByDate,
    systemModesByDate,
    trendData,
    parkedAt,             // session cap (last activity / park-to-standby start)
    lastSeen: secToHHMMSS(lastStampSec),  // last log timestamp (for extending a real standby)
    // ── Module 1 additions ──
    faultIntervals,       // matched raise↔removed spans (+ open at EOF)
    orphanRemovals,       // removals with no preceding raise in this file
    interlockEvents,      // flat assert/release event list
    interlockIntervals,   // matched assert↔release spans (+ open at EOF)
    // ── Module 2 additions ──
    nodeEvents,           // discrete per-node disconnect/reconnect events (markers)
    nodeDisconnects,      // derived per-node disconnect intervals (+ orphans)
    heartbeatLosses,      // SPV → node heartbeat-loss events
    coldStarts,           // SPV cold-start / boot signatures
    silenceGaps,          // windows with no machine-source lines (lost events)
    // ── Infrastructure / PC down (shown under nodes) ──
    cbctDowns,            // CBCT disconnect intervals
    exioEvents,           // EXIO comms-fault events
    imagingPsuEvents,     // imaging PSU comms-error events
    irmEvents,            // IRM reconnect events
    // ── Module 3 additions ──
    stateEvents,          // every raw ON/STANDBY/POWEROFF entry (incl. re-entries)
    machineStates,        // collapsed continuous state segments (+ cause)
    modeUpAttempts,       // every ModeUp() attempt
    modeUpLatencies,      // attempt-cluster → ON latency
    pelEvents,            // PEL detections (beam-side + inferred)
    warmupDelays,         // 3010 klystron warm-up assert→release spans
    // ── Module 4 additions ──
    powerLossIntervals,   // 3017 power-loss spans (flagged if they span a gap)
    emoEvents,            // grouped EMO episodes (3021/3026/3027)
    flappingGroups,       // interlocks asserting/releasing ≥3× within 5 min
    cbHits,               // known CB/subsystem signatures that fired (+ counts)
    // ── Module 5 additions ──
    logins,               // Invoking task … using Login Technique …
    failedLogins,         // failed login attempts (app from process column)
    restarts,             // CMS restart / initialize / back-to-login-screen
    planLoads             // distinct plan loads (PlanUID)
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