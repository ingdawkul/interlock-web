export const TREND_CONFIG = {
  /* =========================
     MOTOR / POSITION (unitless)
     ========================= */
  "NDCMotor::X1 primSecDevStats": { min: -0.5 , max: 0.5, warningMin: -0.25, warningMax: 0.25 },
  "NDCMotor::X2 primSecDevStats": { min: -0.5, max: 0.5, warningMin: -0.25, warningMax: 0.25 },
  "NDCMotor::Y1 primSecDevStats": { min: -0.5, max: 0.5, warningMin: -0.25, warningMax: 0.25 },
  "NDCMotor::Y2 primSecDevStats": { min: -0.5, max: 0.5, warningMin: -0.25, warningMax: 0.25 },

  "NDCMotor::KVBladeX1 primSecDevStats": { min: -0.03, max: 0.03, warningMin: -0.03, warningMax: 0.03 },    
  "NDCMotor::KVBladeX2 primSecDevStats": { min: -0.03, max: 0.03, warningMin: -0.03, warningMax: 0.03 },
  "NDCMotor::KVBladeY1 primSecDevStats": { min: -0.03, max: 0.03, warningMin: -0.03, warningMax: 0.03 },
  "NDCMotor::KVBladeY2 primSecDevStats": { min: -0.03, max: 0.03, warningMin: -0.03, warningMax: 0.03 },

  "NDCMotor::KVFilterFoil primSecDevStats": { max: 0.07, warningMax: 0.05 },
  "NDCMotor::KVFilterShape primSecDevStats": { max: 0.07, warningMax: 0.05 },

  "NDCMotor::PosTarget primSecDevStats": { min: -0.5, max: 0.5, warningMin: -0.3, warningMax: 0.3 },
  "NDCMotor::PosRotation primSecDevStats": { min: -0.75, max: 0.075, warningMin: -0.05, warningMax: 0.05 },
  "NDCMotor::PosIonChamber primSecDevStats": { min: -0.25, max: 0.25, warningMin: -0.2, warningMax: 0.2 },
  "NDCMotor::PosY primSecDevStats": { min: -0.5, max: 0.5, warningMin: -0.25, warningMax: 0.25 },
  "NDCMotor::PosEnergySwitch primDriftStats": { min: -0.005, max: 0.005, warningMin: -0.003, warningMax: 0.003 },

  "MLCController::logStatistics MLCCarriage_BankA_primSecDevStats": {
    unit: "mm",
    min: -0.06,
    max: 0.06,
    warningMin: -0.05,
    warningMax: 0.05
  },
  "MLCController::logStatistics MLCCarriage_BankB_primSecDevStats": {
    unit: "mm",
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
    min: 27,
    max: 33.0,
    warningMin: 28.5,
    warningMax: 32.5
  },

  /* =========================
     TEMPERATURES
     ========================= */
  "BGMSubNodeCntrl::logStatistics EGN_boardTemperature": {
    unit: "°C",
    min: 38,
    max: 52,
    warningMin: 40,
    warningMax: 50
  },

  "STNPwrHandlerBase::logStatistics PowerAPD_Temperature": {
    unit: "°C",
    max: 48,
    min: 25,
    warningMax: 46,
    warningMin: 28
  },
  "STNPwrHandlerBase::logStatistics PowerSPD_Temperature": {
    unit: "°C",
    max: 48,
    min: 25,
    warningMin: 28,
    warningMax: 40
  },
  "STNPwrHandlerBase::logStatistics PowerGPD_Temperature": {
    unit: "°C",
    max: 48,
    min: 30,
    warningMin: 35,
    warningMax: 46
  },

  /* =========================
     FANS
     ========================= */
  "STNPwrHandlerBase::logStatistics GPD_ACFanStatistics": {
    max: 0.5,
    min: 0,
    warningMin: 0.3,
    warningMax: 0.4
  },
  "STNPwrHandlerBase::logStatistics SPD_ACFanStatistics": {
    min: 0.2,
    max: 0.8,
    warningMax: 0.6,
    warningMin: 0.4
  },

  /* =========================
     COOLING / FLOW / TEMP
     ========================= */
  "STNCoolingCtrl::logStatistics CoolingbendMagFlowHighStatistics": {
    unit: "gpm",
    min: 0.4,
    max: 1.0,
    warningMin: 0.5,
    warningMax: 0.8
  },
  "STNCoolingCtrl::logStatistics CoolingcityWaterFlowHighStatistics": {
    unit: "gpm",
    min: 2,
    max: 8,
    warningMin: 2.5,
    warningMax: 6.0
  },
  "STNCoolingCtrl::logStatistics CoolingcityWaterTempStatistics": {
    unit: "°C",
    min: 10,
    max: 16,
    warningMin: 11,
    warningMax: 14
  },
  "STNCoolingCtrl::logStatistics CoolingguideFlowFlowHighStatistics": {
    unit: "gpm",
    min: 2.5,
    max: 6,
    warningMax: 4,
    warningMin: 3
  },
  "STNCoolingCtrl::logStatistics CoolingklystronFlowHighStatistics": {
    unit: "gpm",
    max: 8,
    min: 5,
    warningMax: 7,
    warningMin: 5.5
  },
  "STNCoolingCtrl::logStatistics CoolingklystronSolenoidFlowHighStatistics": {
    unit: "gpm",
    max: 6,
    min: 3,
    warningMin: 4,
    warningMax: 5
  },
  "STNCoolingCtrl::logStatistics CoolingprimaryCollimatorFlowHighStatistics": {
    unit: "gpm",
    min: 1.0,
    max: 1.8,
    warningMin: 1.2,
    warningMax: 1.6
  },
  "STNCoolingCtrl::logStatistics CoolingpumpOutletTempStatistics": {
    unit: "°C",
    max: 45,
    warningMax: 42,
    warningMin: 38
  },
  "STNCoolingCtrl::logStatistics CoolingtankInputTempStatistics": {
    unit: "°C",
    max: 48,
    warningMax: 45,
    warningMin: 38
  },
  "STNCoolingCtrl::logStatistics CoolingtargetFlowHighStatistics": {
    unit: "gpm ",
    min: 0.8,
    max: 1.4,
    warningMin: 0.9,
    warningMax: 1.2
  },
  "STNCoolingCtrl::logStatistics SlimcombineGuideSolenoidFlowHighStatistics": {
    unit: "gpm",
    min: 3.0,
    max: 4.0,
    warningMin: 3.2,
    warningMax: 3.8
  }
};
