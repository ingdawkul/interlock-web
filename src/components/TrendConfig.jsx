export const TREND_CONFIG = {
  /* =========================
     MOTOR / POSITION (unitless)
     ========================= */
  "NDCMotor::X1 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::X2 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::Y1 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::Y2 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },

  "NDCMotor::KVBladeX1 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::KVBladeX2 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::KVBladeY1 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::KVBladeY2 primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },

  "NDCMotor::KVFilterFoil primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::KVFilterShape primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },

  "NDCMotor::PosTarget primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::PosRotation primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::PosIonChamber primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::PosY primSecDevStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },
  "NDCMotor::PosEnergySwitch primDriftStats": { min: -5, max: 5, warningMin: -3, warningMax: 3 },

  "MLCController::logStatistics MLCCarriage_BankA_primSecDevStats": {
    min: -0.06,
    max: 0.06,
    warningMin: -0.05,
    warningMax: 0.05
  },
  "MLCController::logStatistics MLCCarriage_BankB_primSecDevStats": {
    min: -0.06,
    max: 0.06,
    warningMin: -0.05,
    warningMax: 0.05
  },

  /* =========================
     GAS / PRESSURE
     ========================= */
  "STNSF6GasCtrl::logStatistics SF6GaswaveGuidePressureStatistics": {
    unit: "bar",
    min: 28.6,
    max: 33.0,
    warningMin: 29.0,
    warningMax: 32.8
  },

  /* =========================
     TEMPERATURES
     ========================= */
  "BGMSubNodeCntrl::logStatistics EGN_boardTemperature": {
    unit: "°C",
    max: 70,
    warningMax: 60
  },

  "STNPwrHandlerBase::logStatistics PowerAPD_Temperature": {
    unit: "°C",
    max: 75,
    warningMax: 65
  },
  "STNPwrHandlerBase::logStatistics PowerSPD_Temperature": {
    unit: "°C",
    max: 75,
    warningMax: 65
  },
  "STNPwrHandlerBase::logStatistics PowerGPD_Temperature": {
    unit: "°C",
    max: 75,
    warningMax: 65
  },

  /* =========================
     FANS
     ========================= */
  "STNPwrHandlerBase::logStatistics GPD_ACFanStatistics": {
    min: 0.3,
    warningMin: 0.2
  },
  "STNPwrHandlerBase::logStatistics SPD_ACFanStatistics": {
    min: 0.3,
    warningMin: 0.2
  },

  /* =========================
     COOLING / FLOW / TEMP
     ========================= */
  "STNCoolingCtrl::logStatistics CoolingbendMagFlowHighStatistics": {
    unit: "l/min",
    min: 0.48,
    max: 0.8,
    warningMin: 0.5,
    warningMax: 0.78
  },
  "STNCoolingCtrl::logStatistics CoolingcityWaterFlowHighStatistics": {
    unit: "l/min",
    min: 4,
    max: 5,
    warningMin: 4.1,
    warningMax: 4.9
  },
  "STNCoolingCtrl::logStatistics CoolingcityWaterTempStatistics": {
    unit: "°C",
    min: 8,
    max: 40,
    warningMin: 10,
    warningMax: 35
  },
  "STNCoolingCtrl::logStatistics CoolingguideFlowFlowHighStatistics": {
    unit: "l/min",
    min: 0.48,
    max: 0.8,
    warningMin: 0.5,
    warningMax: 0.78
  },
  "STNCoolingCtrl::logStatistics CoolingklystronFlowHighStatistics": {
    unit: "l/min",
    min: 0.48,
    max: 0.8,
    warningMin: 0.5,
    warningMax: 0.78
  },
  "STNCoolingCtrl::logStatistics CoolingklystronSolenoidFlowHighStatistics": {
    unit: "l/min",
    min: 6,
    warningMin: 8
  },
  "STNCoolingCtrl::logStatistics CoolingprimaryCollimatorFlowHighStatistics": {
    unit: "l/min",
    min: 6,
    warningMin: 8
  },
  "STNCoolingCtrl::logStatistics CoolingpumpOutletTempStatistics": {
    unit: "°C",
    max: 40,
    warningMax: 35
  },
  "STNCoolingCtrl::logStatistics CoolingtankInputTempStatistics": {
    unit: "°C",
    max: 35,
    warningMax: 30
  },
  "STNCoolingCtrl::logStatistics CoolingtargetFlowHighStatistics": {
    unit: "l/min",
    min: 0.48,
    max: 0.8,
    warningMin: 0.5,
    warningMax: 0.78
  },
  "STNCoolingCtrl::logStatistics SlimcombineGuideSolenoidFlowHighStatistics": {
    unit: "l/min",
    min: 0.48,
    max: 0.8,
    warningMin: 0.5,
    warningMax: 0.78
  }
};
