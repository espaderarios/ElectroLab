/**
 * Electronics Crossword — data, types, and pure board helpers.
 * Game UI lives in CrosswordGame.tsx; level select is in GamesPage.
 */

export type Direction = "across" | "down";

export type CrosswordEntry = {
  number: number;
  answer: string;
  clue: string;
  row: number;
  col: number;
  direction: Direction;
  level: number;
};

export type CrosswordLevelMeta = {
  id: string;
  level: number;
  title: string;
  difficulty: string;
  description: string;
};

export const CROSSWORD_ROWS = 17;
export const CROSSWORD_COLS = 17;

/** Level cards for the diamond level-select screen */
export const CROSSWORD_LEVEL_META: CrosswordLevelMeta[] = [
  {
    id: "cw-01",
    level: 1,
    title: "LEVEL 1: BASIC ELECTRONICS",
    difficulty: "Beginner",
    description: "Voltage, current, resistor, capacitor, diode, ground, power, LED.",
  },
  {
    id: "cw-02",
    level: 2,
    title: "LEVEL 2: CIRCUIT THEORY",
    difficulty: "Intermediate",
    description: "Kirchhoff, Thévenin, Norton, impedance, reactance, resistance, node, loop.",
  },
  {
    id: "cw-03",
    level: 3,
    title: "LEVEL 3: AC CIRCUITS & SIGNALS",
    difficulty: "Intermediate",
    description: "Frequency, phase, resonance, oscillator, bandwidth, amplitude, wavelength, harmonic.",
  },
  {
    id: "cw-04",
    level: 4,
    title: "LEVEL 4: SEMICONDUCTORS",
    difficulty: "Advanced",
    description: "Transistor, MOSFET, BJT, emitter, collector, gate, threshold, Zener.",
  },
  {
    id: "cw-05",
    level: 5,
    title: "LEVEL 5: ANALOG ELECTRONICS",
    difficulty: "Advanced",
    description: "Amplifier, op-amp, feedback, gain, clipping, filter, slew rate, differential.",
  },
  {
    id: "cw-06",
    level: 6,
    title: "LEVEL 6: DIGITAL ELECTRONICS",
    difficulty: "Advanced",
    description: "Logic, Boolean, flip-flop, register, counter, MUX, decoder, clock.",
  },
  {
    id: "cw-07",
    level: 7,
    title: "LEVEL 7: MICROCONTROLLERS & EMBEDDED",
    difficulty: "Expert",
    description: "MCU, GPIO, PWM, ADC, DAC, UART, I2C, SPI.",
  },
  {
    id: "cw-08",
    level: 8,
    title: "LEVEL 8: COMMUNICATIONS",
    difficulty: "Expert",
    description: "Modulation, carrier, bandwidth, antenna, amplitude, frequency, noise, SNR.",
  },
  {
    id: "cw-09",
    level: 9,
    title: "LEVEL 9: POWER ELECTRONICS",
    difficulty: "Expert",
    description: "Rectifier, inverter, thyristor, SCR, buck, boost, duty cycle, switching.",
  },
  {
    id: "cw-10",
    level: 10,
    title: "LEVEL 10: ADVANCED EE",
    difficulty: "Expert",
    description: "Laplace, Fourier, convolution, impulse, stability, poles, zeros, transfer.",
  },
];

export const CROSSWORD_ENTRIES: CrosswordEntry[] = [
  { level: 1, number: 1, answer: "CURRENT", clue: "The rate at which electric charge flows through a circuit.", row: 0, col: 4, direction: "down" },
  { level: 1, number: 4, answer: "VOLTAGE", clue: "The electrical potential difference between two points.", row: 6, col: 1, direction: "across" },
  { level: 1, number: 2, answer: "RESISTOR", clue: "A passive component that opposes the flow of electric current.", row: 2, col: 4, direction: "across" },
  { level: 1, number: 3, answer: "CAPACITOR", clue: "A component that stores electrical energy in an electric field.", row: 5, col: 5, direction: "down" },
  { level: 1, number: 6, answer: "POWER", clue: "The rate at which electrical energy is transferred or consumed.", row: 7, col: 5, direction: "across" },
  { level: 1, number: 7, answer: "DIODE", clue: "A semiconductor device that primarily allows current to flow in one direction.", row: 10, col: 4, direction: "across" },
  { level: 1, number: 8, answer: "GROUND", clue: "A reference point in an electrical circuit, commonly assigned zero volts.", row: 12, col: 3, direction: "across" },
  { level: 1, number: 5, answer: "LED", clue: "A semiconductor device that emits light when current flows through it.", row: 6, col: 3, direction: "down" },
  { level: 2, number: 4, answer: "RESISTANCE", clue: "The opposition to electric current measured in ohms.", row: 1, col: 2, direction: "across" },
  { level: 2, number: 3, answer: "KIRCHHOFF", clue: "The surname associated with the circuit laws for current and voltage.", row: 0, col: 5, direction: "down" },
  { level: 2, number: 1, answer: "IMPEDANCE", clue: "The total opposition a circuit presents to alternating current.", row: 0, col: 0, direction: "down" },
  { level: 2, number: 5, answer: "REACTANCE", clue: "The opposition to AC caused by inductors and capacitors.", row: 2, col: 5, direction: "across" },
  { level: 2, number: 6, answer: "THEVENIN", clue: "The surname in a theorem that replaces a linear two-terminal network with an equivalent voltage source and resistance.", row: 5, col: 4, direction: "across" },
  { level: 2, number: 7, answer: "NORTON", clue: "The surname in a theorem that represents a linear two-terminal network using an equivalent current source and resistance.", row: 6, col: 4, direction: "across" },
  { level: 2, number: 7, answer: "NODE", clue: "A point in a circuit where two or more elements are electrically connected.", row: 6, col: 4, direction: "down" },
  { level: 2, number: 2, answer: "LOOP", clue: "Any closed path through a circuit.", row: 0, col: 1, direction: "across" },
  { level: 3, number: 2, answer: "OSCILLATOR", clue: "A circuit that generates a periodic electrical signal.", row: 1, col: 2, direction: "across" },
  { level: 3, number: 1, answer: "WAVELENGTH", clue: "The spatial distance occupied by one complete cycle of a wave.", row: 0, col: 8, direction: "down" },
  { level: 3, number: 4, answer: "FREQUENCY", clue: "The number of complete cycles of a periodic signal occurring per second.", row: 5, col: 6, direction: "across" },
  { level: 3, number: 5, answer: "RESONANCE", clue: "The condition in which a system responds strongly at a particular frequency.", row: 6, col: 4, direction: "across" },
  { level: 3, number: 7, answer: "BANDWIDTH", clue: "The range of frequencies that a system or communication channel can effectively pass.", row: 8, col: 1, direction: "across" },
  { level: 3, number: 3, answer: "AMPLITUDE", clue: "The maximum magnitude of a periodic waveform measured from its reference level.", row: 4, col: 5, direction: "across" },
  { level: 3, number: 8, answer: "HARMONIC", clue: "A sinusoidal component whose frequency is an integer multiple of the fundamental frequency.", row: 9, col: 8, direction: "across" },
  { level: 3, number: 6, answer: "PHASE", clue: "The relative position of a periodic waveform within its cycle.", row: 7, col: 9, direction: "down" },
  { level: 4, number: 2, answer: "TRANSISTOR", clue: "A semiconductor device commonly used for switching and amplification.", row: 1, col: 2, direction: "across" },
  { level: 4, number: 1, answer: "COLLECTOR", clue: "The BJT terminal that collects charge carriers.", row: 0, col: 10, direction: "down" },
  { level: 4, number: 5, answer: "THRESHOLD", clue: "The minimum gate-to-source voltage at which a MOSFET begins to conduct significantly.", row: 4, col: 7, direction: "across" },
  { level: 4, number: 8, answer: "EMITTER", clue: "The transistor terminal that emits charge carriers in a BJT.", row: 6, col: 6, direction: "across" },
  { level: 4, number: 3, answer: "MOSFET", clue: "A voltage-controlled transistor widely used for switching and amplification.", row: 2, col: 11, direction: "down" },
  { level: 4, number: 6, answer: "ZENER", clue: "A diode commonly used for voltage regulation in its reverse breakdown region.", row: 5, col: 6, direction: "down" },
  { level: 4, number: 7, answer: "GATE", clue: "The control terminal of a MOSFET.", row: 6, col: 3, direction: "across" },
  { level: 4, number: 4, answer: "BJT", clue: "A transistor controlled primarily by current at its base terminal.", row: 4, col: 5, direction: "across" },
  { level: 5, number: 1, answer: "DIFFERENTIAL", clue: "A configuration that amplifies the difference between two input signals.", row: 1, col: 1, direction: "across" },
  { level: 5, number: 2, answer: "AMPLIFIER", clue: "A circuit or device that increases the amplitude of an electrical signal.", row: 1, col: 11, direction: "down" },
  { level: 5, number: 7, answer: "FEEDBACK", clue: "The process of returning part of a system's output to its input.", row: 8, col: 9, direction: "across" },
  { level: 5, number: 5, answer: "CLIPPING", clue: "Distortion that occurs when an amplifier output reaches its maximum available limits.", row: 5, col: 6, direction: "across" },
  { level: 5, number: 4, answer: "SLEWRATE", clue: "The maximum rate at which an amplifier's output voltage can change.", row: 4, col: 7, direction: "down" },
  { level: 5, number: 6, answer: "FILTER", clue: "A circuit that selectively passes or rejects particular frequency ranges.", row: 6, col: 3, direction: "across" },
  { level: 5, number: 3, answer: "OPAMP", clue: "A high-gain differential amplifier commonly used for analog signal processing.", row: 3, col: 7, direction: "across" },
  { level: 5, number: 8, answer: "GAIN", clue: "The ratio of output signal magnitude to input signal magnitude.", row: 9, col: 6, direction: "across" },
  { level: 6, number: 3, answer: "FLIPFLOP", clue: "A bistable digital circuit capable of storing one bit of information.", row: 1, col: 3, direction: "across" },
  { level: 6, number: 1, answer: "REGISTER", clue: "A group of digital storage elements used to hold binary data.", row: 0, col: 0, direction: "across" },
  { level: 6, number: 2, answer: "BOOLEAN", clue: "An algebra used to represent logical operations involving binary values.", row: 0, col: 9, direction: "down" },
  { level: 6, number: 7, answer: "COUNTER", clue: "A sequential digital circuit that counts pulses or clock events.", row: 6, col: 6, direction: "across" },
  { level: 6, number: 4, answer: "DECODER", clue: "A digital circuit that converts coded binary information into a corresponding output.", row: 4, col: 6, direction: "down" },
  { level: 6, number: 5, answer: "LOGIC", clue: "The system of operations used to process binary information.", row: 5, col: 7, direction: "down" },
  { level: 6, number: 8, answer: "CLOCK", clue: "A periodic digital signal used to synchronize sequential circuits.", row: 9, col: 7, direction: "across" },
  { level: 6, number: 6, answer: "MUX", clue: "A circuit that selects one of several input signals and sends it to a single output.", row: 5, col: 8, direction: "down" },
  { level: 7, number: 3, answer: "MICROCONTROLLER", clue: "An integrated circuit containing a processor, memory, and peripherals for embedded control.", row: 1, col: 0, direction: "across" },
  { level: 7, number: 1, answer: "GPIO", clue: "General-purpose pins that can be configured as digital inputs or outputs.", row: 0, col: 0, direction: "across" },
  { level: 7, number: 4, answer: "UART", clue: "A serial communication interface commonly using TX and RX lines.", row: 2, col: 0, direction: "across" },
  { level: 7, number: 6, answer: "PWM", clue: "A technique that controls average power by varying the duty cycle of a digital waveform.", row: 3, col: 0, direction: "across" },
  { level: 7, number: 2, answer: "ADC", clue: "A circuit that converts an analog signal into a digital representation.", row: 0, col: 4, direction: "across" },
  { level: 7, number: 7, answer: "DAC", clue: "A circuit that converts digital data into an analog signal.", row: 4, col: 0, direction: "across" },
  { level: 7, number: 8, answer: "I2C", clue: "A two-wire serial communication protocol commonly using SDA and SCL.", row: 5, col: 0, direction: "across" },
  { level: 7, number: 5, answer: "SPI", clue: "A synchronous serial communication protocol commonly using clock, data, and chip-select lines.", row: 2, col: 4, direction: "across" },
  { level: 8, number: 2, answer: "MODULATION", clue: "The process of varying a carrier signal according to information being transmitted.", row: 1, col: 2, direction: "across" },
  { level: 8, number: 1, answer: "BANDWIDTH", clue: "The range of frequencies occupied or passed by a communication system.", row: 0, col: 7, direction: "down" },
  { level: 8, number: 6, answer: "AMPLITUDE", clue: "The magnitude of a signal quantity that can be varied in amplitude modulation.", row: 5, col: 3, direction: "across" },
  { level: 8, number: 4, answer: "FREQUENCY", clue: "A signal characteristic that can be varied in frequency modulation.", row: 3, col: 11, direction: "down" },
  { level: 8, number: 5, answer: "CARRIER", clue: "A signal used as the basis for transmitting information through modulation.", row: 4, col: 8, direction: "across" },
  { level: 8, number: 7, answer: "ANTENNA", clue: "A device that radiates or receives electromagnetic waves.", row: 9, col: 6, direction: "across" },
  { level: 8, number: 8, answer: "NOISE", clue: "An unwanted electrical or electromagnetic disturbance that affects a signal.", row: 9, col: 7, direction: "down" },
  { level: 8, number: 3, answer: "SNR", clue: "The ratio comparing desired signal power with noise power.", row: 2, col: 6, direction: "across" },
  { level: 9, number: 1, answer: "RECTIFIER", clue: "A circuit that converts alternating current into unidirectional current.", row: 1, col: 3, direction: "across" },
  { level: 9, number: 2, answer: "THYRISTOR", clue: "A semiconductor switching device commonly used for controlled power conversion.", row: 1, col: 6, direction: "down" },
  { level: 9, number: 6, answer: "DUTYCYCLE", clue: "The fraction of one switching period during which a signal is active.", row: 7, col: 4, direction: "across" },
  { level: 9, number: 5, answer: "SWITCHING", clue: "A power conversion technique that rapidly turns semiconductor devices on and off.", row: 6, col: 6, direction: "across" },
  { level: 9, number: 4, answer: "INVERTER", clue: "A power electronic converter that changes DC into AC.", row: 5, col: 6, direction: "across" },
  { level: 9, number: 7, answer: "BOOST", clue: "A DC-DC converter that produces a higher output voltage than its input.", row: 8, col: 5, direction: "across" },
  { level: 9, number: 7, answer: "BUCK", clue: "A DC-DC converter that produces a lower output voltage than its input.", row: 8, col: 5, direction: "down" },
  { level: 9, number: 3, answer: "SCR", clue: "A three-terminal thyristor commonly used for controlled rectification.", row: 4, col: 4, direction: "across" },
  { level: 10, number: 3, answer: "CONVOLUTION", clue: "An operation used to determine the output of a linear time-invariant system from its input and impulse response.", row: 1, col: 2, direction: "across" },
  { level: 10, number: 2, answer: "STABILITY", clue: "A system property describing whether its response remains bounded under appropriate inputs.", row: 0, col: 9, direction: "down" },
  { level: 10, number: 8, answer: "TRANSFER", clue: "Short for transfer function: ratio of output transform to input transform under zero initial conditions.", row: 7, col: 9, direction: "across" },
  { level: 10, number: 6, answer: "LAPLACE", clue: "A transform widely used to analyze continuous-time systems and differential equations.", row: 5, col: 6, direction: "across" },
  { level: 10, number: 7, answer: "FOURIER", clue: "A mathematical transform used to analyze signals in the frequency domain.", row: 6, col: 5, direction: "across" },
  { level: 10, number: 5, answer: "IMPULSE", clue: "An ideal signal concentrated at a single instant and fundamental to LTI system analysis.", row: 4, col: 9, direction: "across" },
  { level: 10, number: 1, answer: "POLES", clue: "Values of the complex frequency variable that make a system's transfer function unbounded.", row: 0, col: 6, direction: "down" },
  { level: 10, number: 4, answer: "ZEROS", clue: "Values of the complex frequency variable that make the numerator of a transfer function zero.", row: 4, col: 2, direction: "across" },
];

export type CellMeta = {
  answer: string;
  entryIndexes: number[];
  number?: number;
};

export function entriesForLevel(level: number): CrosswordEntry[] {
  return CROSSWORD_ENTRIES.filter((e) => e.level === level);
}

export function cellsFor(entry: CrosswordEntry): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = [];
  const dr = entry.direction === "down" ? 1 : 0;
  const dc = entry.direction === "across" ? 1 : 0;
  for (let i = 0; i < entry.answer.length; i++) {
    cells.push({ row: entry.row + dr * i, col: entry.col + dc * i });
  }
  return cells;
}

export function cellsForIndex(entries: CrosswordEntry[], index: number) {
  return cellsFor(entries[index]);
}

export function buildCrosswordMeta(entries: CrosswordEntry[]): (CellMeta | null)[][] {
  const board: (CellMeta | null)[][] = Array.from({ length: CROSSWORD_ROWS }, () =>
    Array.from({ length: CROSSWORD_COLS }, () => null),
  );

  entries.forEach((entry, index) => {
    cellsFor(entry).forEach((cell, i) => {
      const existing = board[cell.row][cell.col];
      board[cell.row][cell.col] = {
        answer: entry.answer[i],
        entryIndexes: [...(existing?.entryIndexes ?? []), index],
        number: i === 0 ? entry.number : existing?.number,
      };
    });
  });

  return board;
}

export function levelMetaToSelectCards() {
  return CROSSWORD_LEVEL_META.map((m) => ({
    id: m.id,
    title: m.title,
    difficulty: m.difficulty,
    description: m.description,
  }));
}
