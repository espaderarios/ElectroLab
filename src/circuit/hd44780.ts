export interface Hd44780State {
  displayOn: boolean;
  cursorOn: boolean;
  blinkOn: boolean;

  cursorColumn: number;
  cursorRow: number;

  entryLeftToRight: boolean;
  displayShift: number;

  lines: [string, string];

  fourBitMode: boolean;

  pendingNibble: number | null;
}

export interface Hd44780Pins {
  rs: 0 | 1;
  rw: 0 | 1;
  e: 0 | 1;

  d4: 0 | 1;
  d5: 0 | 1;
  d6: 0 | 1;
  d7: 0 | 1;
}

const COLS = 16;
const ROWS = 2;

function blankLine(): string {
  return " ".repeat(COLS);
}

export function createHd44780(): Hd44780State {
  return {
    displayOn: true,
    cursorOn: false,
    blinkOn: false,

    cursorColumn: 0,
    cursorRow: 0,

    entryLeftToRight: true,
    displayShift: 0,

    lines: [
      blankLine(),
      blankLine(),
    ],

    fourBitMode: true,

    pendingNibble: null,
  };
}

function nibbleFromPins(
  pins: Hd44780Pins,
): number {
  return (
    (pins.d4 ? 1 : 0) |
    ((pins.d5 ? 1 : 0) << 1) |
    ((pins.d6 ? 1 : 0) << 2) |
    ((pins.d7 ? 1 : 0) << 3)
  );
}

function byteFromNibbles(
  high: number,
  low: number,
): number {
  return ((high & 0xf) << 4) | (low & 0xf);
}

function setCharacter(
  lcd: Hd44780State,
  char: string,
) {
  if (
    lcd.cursorRow < 0 ||
    lcd.cursorRow >= ROWS ||
    lcd.cursorColumn < 0 ||
    lcd.cursorColumn >= COLS
  ) {
    return;
  }

  const line = lcd.lines[lcd.cursorRow];

  lcd.lines[lcd.cursorRow] =
    line.substring(0, lcd.cursorColumn) +
    char +
    line.substring(lcd.cursorColumn + 1);

  if (lcd.entryLeftToRight) {
    lcd.cursorColumn++;

    if (lcd.cursorColumn >= COLS) {
      lcd.cursorColumn = 0;
      lcd.cursorRow =
        Math.min(ROWS - 1, lcd.cursorRow + 1);
    }
  } else {
    lcd.cursorColumn--;

    if (lcd.cursorColumn < 0) {
      lcd.cursorColumn = COLS - 1;
      lcd.cursorRow =
        Math.max(0, lcd.cursorRow - 1);
    }
  }
}

function executeCommand(
  lcd: Hd44780State,
  command: number,
) {
  /*
   * Clear display
   */
  if (command === 0x01) {
    lcd.lines = [
      blankLine(),
      blankLine(),
    ];

    lcd.cursorColumn = 0;
    lcd.cursorRow = 0;
    lcd.displayShift = 0;

    return;
  }

  /*
   * Return home
   */
  if (command === 0x02) {
    lcd.cursorColumn = 0;
    lcd.cursorRow = 0;
    lcd.displayShift = 0;

    return;
  }

  /*
   * Entry mode set
   *
   * 0x04-0x07
   */
  if ((command & 0xfc) === 0x04) {
    lcd.entryLeftToRight =
      Boolean(command & 0x02);

    return;
  }

  /*
   * Display ON/OFF control
   *
   * 0x08-0x0F
   */
  if ((command & 0xf8) === 0x08) {
    lcd.displayOn =
      Boolean(command & 0x04);

    lcd.cursorOn =
      Boolean(command & 0x02);

    lcd.blinkOn =
      Boolean(command & 0x01);

    return;
  }

  /*
   * Cursor / display shift
   */
  if ((command & 0xf0) === 0x10) {
    const displayShift =
      Boolean(command & 0x08);

    const right =
      Boolean(command & 0x04);

    if (displayShift) {
      lcd.displayShift += right ? 1 : -1;
    } else {
      if (right) {
        lcd.cursorColumn =
          Math.min(COLS - 1, lcd.cursorColumn + 1);
      } else {
        lcd.cursorColumn =
          Math.max(0, lcd.cursorColumn - 1);
      }
    }

    return;
  }

  /*
   * Function set
   */
  if ((command & 0xe0) === 0x20) {
    lcd.fourBitMode =
      !Boolean(command & 0x10);

    return;
  }

  /*
   * Set DDRAM address
   *
   * Line 1: 0x00 - 0x27
   * Line 2: 0x40 - 0x67
   */
  if (command & 0x80) {
    const address = command & 0x7f;

    if (address >= 0x40) {
      lcd.cursorRow = 1;
      lcd.cursorColumn =
        Math.min(COLS - 1, address - 0x40);
    } else {
      lcd.cursorRow = 0;
      lcd.cursorColumn =
        Math.min(COLS - 1, address);
    }

    return;
  }
}

function executeByte(
  lcd: Hd44780State,
  rs: 0 | 1,
  value: number,
) {
  if (rs === 0) {
    executeCommand(lcd, value);
    return;
  }

  setCharacter(
    lcd,
    String.fromCharCode(value & 0xff),
  );
}

/**
 * Call this whenever the MCU changes the LCD E pin.
 *
 * The HD44780 latches data on the falling edge:
 *
 * E: HIGH → LOW
 */
export function clockHd44780(
  lcd: Hd44780State,
  previous: Hd44780Pins,
  current: Hd44780Pins,
): Hd44780State {
  if (!lcd) return createHd44780();

  if (
    previous.e === 1 &&
    current.e === 0
  ) {
    if (current.rw === 1) {
      return lcd;
    }

    const nibble =
      nibbleFromPins(current);

    if (lcd.fourBitMode) {
      if (lcd.pendingNibble === null) {
        lcd.pendingNibble = nibble;
      } else {
        const value = byteFromNibbles(
          lcd.pendingNibble,
          nibble,
        );

        lcd.pendingNibble = null;

        executeByte(
          lcd,
          current.rs,
          value,
        );
      }
    } else {
      executeByte(
        lcd,
        current.rs,
        nibble,
      );
    }
  }

  return lcd;
}

export function lcdText(
  lcd: Hd44780State | null | undefined,
): string {
  if (!lcd || !lcd.displayOn) {
    return "";
  }

  return lcd.lines.join("\n");
}