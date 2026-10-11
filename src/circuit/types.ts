export const COLS = 30;
export const PITCH = 0.2;

export const ROWS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
] as const;

export type RowLetter = (typeof ROWS)[number];

/** Power-rail hole prefixes.
 *  Standard / half / MB-102 boards use tp/tn/bp/bn (4 rails).
 *  Full-1660 double board uses 8 rails: otp/otn, itp/itn, ibp/ibn, obp/obn.
 */
export type RailKind =
  | "tp"
  | "tn"
  | "bp"
  | "bn"
  | "otp"
  | "otn"
  | "itp"
  | "itn"
  | "ibp"
  | "ibn"
  | "obp"
  | "obn";

export type HoleId = string;

export type TactileSwitchStyle =
  | "tactile-black"
  | "tactile-white"
  | "tactile-blue"
  | "tactile-red"
  | "tactile-low-profile";

/** Electrical contact arrangement supported by a switch part. */
export type SwitchType = "spst" | "spdt" | "dpst" | "dpdt";

/** Active contact for an SPDT switch; SPST uses `closed` instead. */
export type SwitchPosition = "open" | "no" | "nc";

export type ToolId =
  | "select"
  | "none"
  | "psu-positive"
  | "psu-negative"
  | "delete"
  | "probe"
  | "wire"
  | "resistor"
  | "led"
  | "diode"
  | "switch"
  | "switch-spst"
  | "switch-spdt"
  | "switch-dpst"
  | "switch-dpdt"
  | "button"
  | "capacitor"
  | "inductor"
  | "buzzer"
  | "relay"
  | "lcd"
  | "oled"
  | "mcu"
  | "pot"
  | "transistor"
  | "thyristor"
  | "triac"
  | "diac"
  | "motor"
  | "speaker"
  | "not"
  | "and"
  | "or"
  | "nand"
  | "nor"
  | "xor"
  | "xnor"
  | "mosfet"
  | "zener"
  | "ldr"
  | "rgb-led"
  | "seven-segment"
  | "timer555"
  | "opamp"
  | "servo"
  | "thermistor"
  | "optocoupler"
  | "regulator"
  | "fuse";

export type TransistorModelId =
  | "2n3904"   // TO-92 NPN
  | "2n3906"   // TO-92 PNP
  | "bc547"    // TO-92 NPN
  | "bc557"    // TO-92 PNP
  | "2n2222"   // TO-18 metal can NPN
  | "tip31"    // TO-220 NPN
  | "tip32"    // TO-220 PNP
  | "2n3055";  // TO-3 power NPN

export type PartKind =
  | "resistor"
  | "led"
  | "diode"
  | "switch"
  | "button"
  | "capacitor"
  | "inductor"
  | "buzzer"
  | "relay"
  | "lcd"
  | "oled"
  | "mcu"
  | "pot"
  | "transistor"
  | "thyristor"
  | "triac"
  | "diac"
  | "motor"
  | "speaker"
  | "not"
  | "and"
  | "or"
  | "nand"
  | "nor"
  | "xor"
  | "xnor"
  | "mosfet"
  | "zener"
  | "ldr"
  | "rgb-led"
  | "seven-segment"
  | "timer555"
  | "opamp"
  | "servo"
  | "thermistor"
  | "optocoupler"
  | "regulator"
  | "fuse";

export type MotorModelId = "3v" | "5v" | "6v" | "9v" | "12v";
export type LogicGateFamily = "not" | "and" | "or" | "nand" | "nor" | "xor" | "xnor";

/**
 * DC hobby motor models (educational).
 *
 *  Ra            armature resistance (Ω) — used for stall / start current
 *  L             armature inductance (H) — first-order current dynamics
 *  ratedVoltage  nameplate voltage (V)
 *  stallCurrent  ≈ Vrated / Ra (A)
 *  efficiency η  decimal 0–1
 *  noLoadCurrent approximate running current at free spin (A)
 *
 * Formulas used in simulate.ts:
 *   Istart = V / Ra
 *   Back EMF ≈ speed × Vrated × 0.95
 *   Ia_ss = (V − BackEMF) / Ra          (steady-state target)
 *   τ = L / Ra
 *   Ia[k] = Ia[k−1] + (Ia_ss − Ia[k−1]) · (1 − e^(−Δt/τ))
 *   Irun ≈ max(noLoadCurrent × speed, Ia) under load factor
 *   speed ≈ clamp(|V| / Vrated, 0, 1) when powered
 */
export const MOTOR_MODELS: Record<
  MotorModelId,
  {
    label: string;
    ratedVoltage: number;
    /** Armature resistance Ra (Ω). */
    resistance: number;
    /** Armature inductance L (H). Typical small brushed hobby motors. */
    inductance: number;
    stallCurrent: number;
    /** Efficiency η (decimal). */
    efficiency: number;
    /** Approximate no-load current (A). */
    noLoadCurrent: number;
  }
> = {
  "3v":  { label: "3V hobby",  ratedVoltage: 3,  resistance: 8,  inductance: 0.0015, stallCurrent: 0.38, efficiency: 0.55, noLoadCurrent: 0.06 },
  "5v":  { label: "5V hobby",  ratedVoltage: 5,  resistance: 12, inductance: 0.0020, stallCurrent: 0.42, efficiency: 0.60, noLoadCurrent: 0.05 },
  "6v":  { label: "6V hobby",  ratedVoltage: 6,  resistance: 15, inductance: 0.0025, stallCurrent: 0.40, efficiency: 0.62, noLoadCurrent: 0.045 },
  "9v":  { label: "9V hobby",  ratedVoltage: 9,  resistance: 22, inductance: 0.0035, stallCurrent: 0.41, efficiency: 0.65, noLoadCurrent: 0.04 },
  "12v": { label: "12V hobby", ratedVoltage: 12, resistance: 30, inductance: 0.0050, stallCurrent: 0.40, efficiency: 0.68, noLoadCurrent: 0.035 },
};

/** Common SCR (unidirectional thyristor) part numbers. */
export type ThyristorModelId =
  | "2n5060"   // sensitive-gate TO-92
  | "tic106"   // TO-220 4 A
  | "bt151"    // TO-220 12 A
  | "c106"     // TO-126 / TO-220 style
  | "2n6508"   // TO-220 25 A
  | "tyn612";  // ST TO-220 12 A

/**
 * Datasheet-inspired SCR parameters (educational, typical @ 25 °C).
 * igt  — gate trigger current IGT (A)
 * vgt  — gate trigger voltage VGT (V)
 * ih   — holding current IH (A)
 * il   — latching current IL (A), usually ~2–3× IH
 */
export const THYRISTOR_MODELS: Record<
  ThyristorModelId,
  {
    label: string;
    package: string;
    itRms: number;
    igt: number;
    vgt: number;
    ih: number;
    il: number;
  }
> = {
  // Sensitive-gate: very low IGT/IH so LED + 470 Ω still latches
  "2n5060": { label: "2N5060", package: "TO-92", itRms: 0.8, igt: 0.0002, vgt: 0.8, ih: 0.005, il: 0.010 },
  // Medium power SCRs
  tic106:   { label: "TIC106", package: "TO-220", itRms: 4, igt: 0.0002, vgt: 0.8, ih: 0.005, il: 0.015 },
  c106:     { label: "C106", package: "TO-220", itRms: 4, igt: 0.0002, vgt: 0.8, ih: 0.003, il: 0.010 },
  // Standard power SCRs — need real gate current
  bt151:    { label: "BT151", package: "TO-220", itRms: 12, igt: 0.015, vgt: 1.5, ih: 0.020, il: 0.040 },
  tyn612:   { label: "TYN612", package: "TO-220", itRms: 12, igt: 0.015, vgt: 1.5, ih: 0.030, il: 0.060 },
  "2n6508": { label: "2N6508", package: "TO-220", itRms: 25, igt: 0.040, vgt: 1.5, ih: 0.040, il: 0.080 },
};

/** Common TRIAC (bidirectional thyristor) part numbers. */
export type TriacModelId =
  | "bt136"    // TO-220 4 A
  | "bt139"    // TO-220 16 A
  | "tic226"   // TO-220 8 A
  | "mac97a"   // TO-92 sensitive
  | "bta16";   // TO-220 16 A isolated

/**
 * Datasheet-inspired TRIAC parameters (educational, typical @ 25 °C).
 */
export const TRIAC_MODELS: Record<
  TriacModelId,
  {
    label: string;
    package: string;
    itRms: number;
    igt: number;
    vgt: number;
    ih: number;
    il: number;
  }
> = {
  mac97a: { label: "MAC97A", package: "TO-92", itRms: 0.6, igt: 0.005, vgt: 1.0, ih: 0.005, il: 0.015 },
  bt136:  { label: "BT136", package: "TO-220", itRms: 4, igt: 0.035, vgt: 1.5, ih: 0.015, il: 0.030 },
  tic226: { label: "TIC226", package: "TO-220", itRms: 8, igt: 0.050, vgt: 1.5, ih: 0.030, il: 0.060 },
  bt139:  { label: "BT139", package: "TO-220", itRms: 16, igt: 0.035, vgt: 1.5, ih: 0.030, il: 0.060 },
  bta16:  { label: "BTA16", package: "TO-220", itRms: 16, igt: 0.050, vgt: 1.5, ih: 0.040, il: 0.080 },
};

/** Common DIAC (bidirectional trigger diode) part numbers. */
export type DiacModelId =
  | "db3"      // ~32 V breakover
  | "db4"      // ~40 V breakover
  | "ht32";    // ~32 V breakover

/** N/P-channel MOSFET models (educational). */
export type MosfetModelId =
  | "2n7000"   // N-ch TO-92
  | "bs170"    // N-ch TO-92
  | "irf540"   // N-ch TO-220
  | "irf9540"  // P-ch TO-220
  | "ao3400"   // N-ch SOT-23
  | "ao3401";  // P-ch SOT-23

export const MOSFET_MODELS: Record<
  MosfetModelId,
  {
    label: string;
    channel: "n" | "p";
    package: string;
    vth: number;
    rdsOn: number;
    maxVds: number;
    maxId: number;
  }
> = {
  "2n7000": { label: "2N7000", channel: "n", package: "TO-92", vth: 2.1, rdsOn: 5.0, maxVds: 60, maxId: 0.2 },
  bs170:    { label: "BS170", channel: "n", package: "TO-92", vth: 2.1, rdsOn: 5.0, maxVds: 60, maxId: 0.5 },
  irf540:   { label: "IRF540N", channel: "n", package: "TO-220", vth: 4.0, rdsOn: 0.044, maxVds: 100, maxId: 33 },
  irf9540:  { label: "IRF9540", channel: "p", package: "TO-220", vth: -4.0, rdsOn: 0.2, maxVds: -100, maxId: -23 },
  ao3400:   { label: "AO3400", channel: "n", package: "SOT-23", vth: 1.0, rdsOn: 0.03, maxVds: 30, maxId: 5.7 },
  ao3401:   { label: "AO3401", channel: "p", package: "SOT-23", vth: -1.0, rdsOn: 0.05, maxVds: -30, maxId: -4.0 },
};

/** Common zener voltages (educational). */
export type ZenerModelId = "3v3" | "5v1" | "6v2" | "9v1" | "12v" | "15v";

export const ZENER_MODELS: Record<
  ZenerModelId,
  { label: string; vz: number; rz: number; maxPower: number }
> = {
  "3v3": { label: "BZX 3.3V", vz: 3.3, rz: 15, maxPower: 0.5 },
  "5v1": { label: "BZX 5.1V", vz: 5.1, rz: 12, maxPower: 0.5 },
  "6v2": { label: "BZX 6.2V", vz: 6.2, rz: 10, maxPower: 0.5 },
  "9v1": { label: "BZX 9.1V", vz: 9.1, rz: 12, maxPower: 0.5 },
  "12v": { label: "BZX 12V", vz: 12, rz: 15, maxPower: 0.5 },
  "15v": { label: "BZX 15V", vz: 15, rz: 18, maxPower: 0.5 },
};

export type WireColor =
  | "red"
  | "black"
  | "blue"
  | "orange"
  | "green"
  | "yellow"
  | "white";

export interface PlacedPart {
  id: string;
  kind: PartKind;

  pins: Record<string, HoleId>;

  props: {
    resistance?: number;
    capacitance?: number;
    tolerance?: number;
    powerRating?: number;
    voltageRating?: number;
    maxCurrent?: number;
    forwardVoltage?: number;
    motorModel?: MotorModelId;
    capacitorType?: "electrolytic" | "ceramic" | "film" | "tantalum";
    diodeType?: "silicon" | "schottky" | "zener";
    package?: "axial" | "smd" | "to92" | "to18" | "to220" | "to3";

    ledColor?:
      | "red"
      | "green"
      | "yellow"
      | "blue";

    closed?: boolean;
    /** Electrical switch type. Defaults to SPST for backwards compatibility. */
    switchType?: SwitchType;
    /** Selected contact for an SPDT switch. Defaults to open, or NO when closed is true. */
    switchPosition?: SwitchPosition;
    /** Physical appearance of a two-terminal tactile push button. */
    switchStyle?: TactileSwitchStyle;

    label?: string;

    mcuModel?: "arduino-uno" | "esp32";

    transistorModel?: TransistorModelId;

    thyristorModel?: ThyristorModelId;
    triacModel?: TriacModelId;
    diacModel?: DiacModelId;

    code?: string;

    /** Arduino Uno onboard RESET tactile held (active-low). */
    resetPressed?: boolean;
    /**
     * Onboard / header pin buttons held on the MCU.
     * Keys are pin names like "d7"; value true means forced LOW for digitalRead.
     */
    pinButtons?: Record<string, boolean>;

    /** Visual / placement rotation in degrees (0, 90, 180, 270). */
    rotation?: number;

    /** HD44780 character columns (8–40). Default 16. */
    lcdCols?: number;
    /** HD44780 character rows (1–4). Default 2. */
    lcdRows?: number;

    /** Logic IC gate type uses A/B inputs, Y output, VCC and GND. */
    gateFamily?: LogicGateFamily;

    /** MOSFET model id. */
    mosfetModel?: MosfetModelId;
    /** Zener breakdown voltage model. */
    zenerModel?: ZenerModelId;
    /** Ambient light level for LDR (0 = dark, 1 = bright). */
    lightLevel?: number;
    /** Ambient temperature °C for thermistor. */
    temperatureC?: number;
    /** Thermistor nominal resistance at 25 °C. */
    r25?: number;
    /** Fuse trip current (A). */
    fuseCurrent?: number;
    /** Whether fuse has blown. */
    fuseBlown?: boolean;
    /** Servo angle target 0–180°. */
    servoAngle?: number;
    /** 7-segment common type. */
    sevenSegCommon?: "cathode" | "anode";
    /** Digit currently shown on 7-segment (0–9) when driven as a unit. */
    sevenSegDigit?: number;
    /** 555 timer mode. */
    timer555Mode?: "astable" | "monostable" | "bistable";
    /** Op-amp mode for educational model. */
    opampMode?: "comparator" | "buffer" | "inverting";
    /** Regulator output voltage (e.g. 5 for 7805). */
    regulatorVout?: number;
  };
}


export interface Wire {
  id: string;
  a: HoleId;
  b: HoleId;
  color: WireColor;
}

export interface LedState {
  id: string;
  on: boolean;
  current: number;
  brightness: number;
  overcurrent: boolean;
}

export interface DiodeState {
  id: string;
  on: boolean;
  current: number;
  forwardVoltage: number;
  overcurrent?: boolean;
}
export interface CapacitorState {
  id: string;
  voltage: number;
  charge: number;
}

export interface BuzzerState {
  id: string;
  on: boolean;
  current: number;
  loudness: number;
  overcurrent?: boolean;
}

export interface TransistorState {
  id: string;
  conducting: boolean;
  vbe: number;
  ice: number;
}

export interface ThyristorState {
  id: string;
  /** True when the SCR is latched / conducting anode→cathode. */
  conducting: boolean;
  /** Anode-to-cathode voltage. */
  vak: number;
  /** Gate-to-cathode voltage. */
  vgk: number;
  /** Approximate anode current when on. */
  iak: number;
  /** Estimated gate current (A). */
  ig?: number;
  /** Model holding current IH (A). */
  ih?: number;
  /** Model latching current IL (A). */
  il?: number;
  /** Model gate trigger current IGT (A). */
  igt?: number;
}

export interface TriacState {
  id: string;
  /** True when the TRIAC is conducting MT2↔MT1. */
  conducting: boolean;
  /** MT2-to-MT1 voltage. */
  vmt: number;
  /** Gate-to-MT1 voltage. */
  vg: number;
  /** Approximate main-terminal current when on. */
  imt: number;
}

export interface DiacState {
  id: string;
  /** True when the DIAC has broken over and is conducting. */
  conducting: boolean;
  voltage: number;
  current: number;
}

export interface SpeakerState {
  id: string;
  on: boolean;
  current: number;
  loudness: number;
}

export interface MotorState {
  id: string;
  on: boolean;
  /** Terminal voltage (signed). */
  voltage: number;
  /** Operating armature current Ia (A). */
  current: number;
  /** Stall / start current Istart = |V| / Ra (A). */
  stallCurrent?: number;
  /** Estimated back-EMF (V). */
  backEmf?: number;
  /** Armature inductance L (H) from the selected motor model. */
  inductance?: number;
  /** Electrical time constant τ = L / Ra (s). */
  timeConstant?: number;
  /** 0–1 relative speed for visualization. */
  speed: number;
  /** Direction from voltage polarity: 1 forward, -1 reverse, 0 stopped. */
  direction: -1 | 0 | 1;
}

export interface RelayState {
  id: string;
  on: boolean;
  coilVoltage: number;
}

export interface McuSimState {
  id: string;
  model: "arduino-uno" | "esp32";
  powered: boolean;
  running: boolean;
  digital: Record<string, 0 | 1>;
  pinModes: Record<
    string,
    "INPUT" | "OUTPUT" | "INPUT_PULLUP"
  >;
  error?: string;
  supplyVoltage?: number;
  electricalState?: "off" | "undervoltage" | "normal" | "overvoltage" | "shorted";
  current?: number;
  /** Sampled external digital input level at each MCU GPIO. */
  inputDigital?: Record<string, 0 | 1>;
  /** Sampled analog voltage at A0-A5 in volts. */
  analog?: Record<string, number>;
  /** Approximate Arduino GPIO source/sink current (mA) per pin. */
  gpioCurrent?: Record<string, number>;
  /** Debounced digital inputs presented to digitalRead(). */
  stableDigital?: Record<string, 0 | 1>;
  /** Persistent sketch variables (int/bool/… surviving across ticks). */
  globals?: Record<string, number | boolean | string>;
  /** Virtual Arduino millis() clock for this MCU. */
  millis?: number;
}

export interface LcdSimState {
  id: string;
  powered: boolean;
  text: string;
  displayOn: boolean;
  cursorOn: boolean;
  blinkOn: boolean;
  cursorColumn: number;
  cursorRow: number;
  supplyVoltage?: number;
  electricalState?: "off" | "undervoltage" | "normal" | "overvoltage" | "shorted";
  current?: number;
}
export interface MosfetState {
  id: string;
  conducting: boolean;
  vgs: number;
  vds: number;
  ids: number;
  channel: "n" | "p";
}

export interface ZenerState {
  id: string;
  on: boolean;
  breakdown: boolean;
  current: number;
  voltage: number;
}

export interface LdrState {
  id: string;
  resistance: number;
  lightLevel: number;
}

export interface ThermistorState {
  id: string;
  resistance: number;
  temperatureC: number;
}

export interface RgbLedState {
  id: string;
  r: boolean;
  g: boolean;
  b: boolean;
  brightnessR: number;
  brightnessG: number;
  brightnessB: number;
}

export interface SevenSegState {
  id: string;
  segments: boolean[]; // a,b,c,d,e,f,g
  digit?: number;
}

export interface Timer555State {
  id: string;
  powered: boolean;
  output: 0 | 1;
  mode: "astable" | "monostable" | "bistable";
}

export interface OpampState {
  id: string;
  powered: boolean;
  output: number;
  mode: string;
}

export interface ServoState {
  id: string;
  powered: boolean;
  angle: number;
  voltage: number;
}

export interface OptocouplerState {
  id: string;
  ledOn: boolean;
  outputConducting: boolean;
  ledCurrent: number;
}

export interface RegulatorState {
  id: string;
  powered: boolean;
  vin: number;
  vout: number;
  dropout: boolean;
}

export interface FuseState {
  id: string;
  conducting: boolean;
  blown: boolean;
  current: number;
}

export interface SimResult {
  ok?: boolean;
  error?: string;

  voltages: Record<HoleId, number>;
  stripVoltages?: Record<string, number>;
  currents?: Record<string, number>;
  /**
   * Approximate net current magnitude at each breadboard hole (A).
   * Computed from the sum of |I| of network elements attached to the
   * hole's electrical node (halved so each element is not double-counted).
   * Used by the probe / voltmeter panel for "current at this node".
   */
  nodeCurrents?: Record<HoleId, number>;

  leds: Record<string, LedState>;
  diodes: Record<string, DiodeState>;
  buzzers: Record<string, BuzzerState>;
  relays: Record<string, RelayState>;

  switches?: Record<string, {
    closed: boolean;
    type?: SwitchType;
    position?: SwitchPosition;
  }>;
  buttons?: Record<string, { closed: boolean }>;
  capacitors?: Record<string, CapacitorState>;
  inductors?: Record<string, unknown>;

  mcus?: Record<string, McuSimState>;
  lcds?: Record<string, LcdSimState>;

  supplyCurrent: number;
  shortCircuit?: boolean;
  lcdPowered: boolean;
  lcdText: string;
  /** Part ids that are thermally overloaded / "burned". */
  burned?: Record<string, boolean>;
  transistors?: Record<string, TransistorState>;
  thyristors?: Record<string, ThyristorState>;
  triacs?: Record<string, TriacState>;
  diacs?: Record<string, DiacState>;
  motors?: Record<string, MotorState>;
  logicGates?: Record<string, { output: 0 | 1; powered: boolean }>;
  speakers?: Record<string, SpeakerState>;
  mosfets?: Record<string, MosfetState>;
  zeners?: Record<string, ZenerState>;
  ldrs?: Record<string, LdrState>;
  thermistors?: Record<string, ThermistorState>;
  rgbLeds?: Record<string, RgbLedState>;
  sevenSegments?: Record<string, SevenSegState>;
  timer555s?: Record<string, Timer555State>;
  opamps?: Record<string, OpampState>;
  servos?: Record<string, ServoState>;
  optocouplers?: Record<string, OptocouplerState>;
  regulators?: Record<string, RegulatorState>;
  fuses?: Record<string, FuseState>;
  oledPowered?: boolean;
  oledText?: string;
  oledVoltage?: number;
  oledElectricalState?: "off" | "undervoltage" | "normal" | "overvoltage" | "shorted";
  mcuPowered: boolean;
  warnings: string[];
}

export const WIRE_HEX: Record<
  WireColor,
  string
> = {
  red: "#c2413b",
  black: "#1a1d23",
  blue: "#1d4ed8",
  orange: "#c2410c",
  green: "#047857",
  yellow: "#ca8a04",
  white: "#e8eef8",
};

export const LED_HEX: Record<
  NonNullable<
    PlacedPart["props"]["ledColor"]
  >,
  string
> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#38bdf8",
};

export const RESISTOR_VALUES = [
  220,
  330,
  1000,
  10000,
] as const;

export const CAPACITOR_VALUES = [
  { label: "10 pF", value: 10e-12 },
  { label: "22 pF", value: 22e-12 },
  { label: "47 pF", value: 47e-12 },
  { label: "100 pF", value: 100e-12 },

  { label: "220 pF", value: 220e-12 },
  { label: "470 pF", value: 470e-12 },

  { label: "1 nF", value: 1e-9 },
  { label: "2.2 nF", value: 2.2e-9 },
  { label: "4.7 nF", value: 4.7e-9 },
  { label: "10 nF", value: 10e-9 },
  { label: "22 nF", value: 22e-9 },
  { label: "47 nF", value: 47e-9 },
  { label: "100 nF", value: 100e-9 },

  { label: "220 nF", value: 220e-9 },
  { label: "470 nF", value: 470e-9 },

  { label: "1 µF", value: 1e-6 },
  { label: "2.2 µF", value: 2.2e-6 },
  { label: "4.7 µF", value: 4.7e-6 },
  { label: "10 µF", value: 10e-6 },
  { label: "22 µF", value: 22e-6 },
  { label: "47 µF", value: 47e-6 },
  { label: "100 µF", value: 100e-6 },

  { label: "220 µF", value: 220e-6 },
  { label: "470 µF", value: 470e-6 },

  { label: "1000 µF", value: 1000e-6 },
];
