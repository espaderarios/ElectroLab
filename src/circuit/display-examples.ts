/** Real, editable wires for the two premade display labs.
 * There are deliberately NO hidden / auto-generated display connections.
 * A solderless breadboard connects A-E and F-J within each column.
 */
import { uid } from '@/lib/utils';
import { holePosition } from './breadboard';
import { autoTidyWireBundle } from './tidy-wires';
import type { PlacedPart, Wire, WireColor, WireStyle } from './types';
import type { ProjectCircuit } from '@/store/projects';

const MCU_PINS = ['vcc', 'gnd', '3v3', ...Array.from({ length: 14 }, (_, i) => `d${i}`), ...Array.from({ length: 6 }, (_, i) => `a${i}`)];
const LCD_PINS = ['vss', 'vdd', 'v0', 'rs', 'rw', 'e', 'd0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'a', 'k'];
const OLED_PINS = ['vcc', 'gnd', 'sda', 'scl'];
const SEVEN_SEG_PINS = ['e', 'd', 'com1', 'c', 'dp', 'b', 'a', 'com2', 'f', 'g'];

const part = (kind: PlacedPart['kind'], label: string, row: string, col: number, names: string[], props: PlacedPart['props'] = {}): PlacedPart => ({
  id: uid(kind), kind, props: { ...props, label },
  pins: Object.fromEntries(names.map((name, i) => [name, `${row}${col + i}`])),
});

function wire(a: string, b: string, color: WireColor, style: WireStyle = 'jumper'): Wire {
  return { id: uid('w'), a, b, color, style };
}

function base(): ProjectCircuit {
  return {boardId:'standard-830', psuVoltage:5, psuPositive:'tp5', psuNegative:'tn5', parts:[], wires:[]};
}

const SKETCH_LCD = `#include <LiquidCrystal.h>
// RS=12, E=11, D4=5, D5=4, D6=3, D7=2
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
void setup() {
  lcd.begin(16, 2);
  lcd.print("ElectroLab");
  lcd.setCursor(0, 1);
  lcd.print("LCD wired!");
}
void loop() { }
`;

const SKETCH_OLED = `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
// Arduino Uno I2C: A4=SDA, A5=SCL, I2C address 0x3C.
Adafruit_SSD1306 display(128, 64, &Wire, -1);
void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println("ElectroLab");
  display.println("OLED wired!");
  display.display();
}
void loop() { }
`;


const SKETCH_7SEG = `// ElectroLab Arduino Uno + 7-segment demo
// Common-cathode display: COM pins go to GND.
// Segment mapping: D2=A, D3=B, D4=C, D5=D, D6=E, D7=F, D8=G, D9=DP
void setup() {
  pinMode(2, OUTPUT);
  pinMode(3, OUTPUT);
  pinMode(4, OUTPUT);
  pinMode(5, OUTPUT);
  pinMode(6, OUTPUT);
  pinMode(7, OUTPUT);
  pinMode(8, OUTPUT);
  pinMode(9, OUTPUT);

  // Display 8.
  digitalWrite(2, HIGH);
  digitalWrite(3, HIGH);
  digitalWrite(4, HIGH);
  digitalWrite(5, HIGH);
  digitalWrite(6, HIGH);
  digitalWrite(7, HIGH);
  digitalWrite(8, HIGH);
  digitalWrite(9, HIGH);
}

void loop() { }
`;

/** Arduino with 16x2 LCD, contrast potentiometer, backlight current limiter.
 * Physical jumpers use free A / J holes in the *same electrical strips* as
 * parts in E / F to leave their occupied component holes unobstructed.
 */
export function circuitArduinoLcd(): ProjectCircuit {
  const c = base();
  c.parts = [
    part('mcu', 'Arduino Uno', 'F', 29, MCU_PINS, {mcuModel:'arduino-uno', code: SKETCH_LCD}),
    part('lcd', 'LCD 16×2', 'E', 6, LCD_PINS, {lcdCols:16, lcdRows:2}),
    {id:uid('pot'), kind:'pot', pins:{a:'E24',w:'E25',b:'E26'}, props:{resistance:10000, label:'Contrast 10k'}},
    {id:uid('r'), kind:'resistor', pins:{a:'E36',b:'E40'}, props:{resistance:220, label:'Backlight 220Ω'}},
  ];
  c.wires = [
    // Bench supply to the Arduino input; no automatic connections.
    wire('tp5','J29','red','solid'), wire('tn5','J30','black','solid'),
    // HD44780 control + 4-bit data lines, routed to free terminal holes.
    wire('J29','A7','red'), wire('J30','A6','black'),
    wire('J30','A10','black'),
    wire('J44','A9','blue'), wire('J43','A11','blue'),
    wire('J37','A16','green'), wire('J36','A17','green'),
    wire('J35','A18','green'), wire('J34','A19','green'),
    // 10 kΩ potentiometer for LCD V0 contrast.
    wire('J29','A24','red'), wire('J30','A26','black'),
    wire('A25','A8','yellow','solid'),
    // Series current-limiting resistor for the backlight LED.
    wire('J29','A36','red'), wire('A40','A20','orange','solid'),
    wire('J30','A21','black'),
  ];
  c.wires = autoTidyWireBundle(c.wires, c.parts, holePosition);
  return c;
}

/** An SSD1306-style 3.3V I2C OLED with intentional A4/A5 data wires. */
export function circuitArduinoOled(): ProjectCircuit {
  const c = base();
  c.parts = [
    part('mcu', 'Arduino Uno', 'F', 29, MCU_PINS, {mcuModel:'arduino-uno', code: SKETCH_OLED}),
    part('oled', 'SSD1306 OLED 128×64', 'E', 10, OLED_PINS),
  ];
  c.wires = [
    wire('tp5','J29','red','solid'), wire('tn5','J30','black','solid'),
    wire('J31','A10','red'), wire('J30','A11','black'),
    wire('J50','A12','blue'), wire('J51','A13','yellow'),
  ];
  c.wires = autoTidyWireBundle(c.wires, c.parts, holePosition);
  return c;
}


/** Arduino Uno driving a single common-cathode seven-segment display.
 * Uses one 220 Ω resistor per segment for realistic current limiting, while
 * following the same direct Arduino-to-display control style as the reference.
 */
export function circuitArduinoSevenSegment(): ProjectCircuit {
  const c = base();
  c.parts = [
    part('mcu', 'Arduino Uno', 'F', 29, MCU_PINS, {mcuModel:'arduino-uno', code: SKETCH_7SEG}),
    {
      id: uid('seven-segment'),
      kind: 'seven-segment',
      props: { label: '7-Segment CC', sevenSegCommon:'cathode' },
      pins: { e:'F16', d:'F17', com1:'F18', c:'F19', dp:'F20', b:'E20', a:'E19', com2:'E18', f:'E17', g:'E16' },
    },
  ];
  c.wires = [
    wire('tp5','J29','red','solid'),
    wire('tn5','J30','black','solid'),
    // The two COM pins are internally tied; one ground lead is sufficient.
    wire('J30','J18','black','solid'),

    // Direct teaching layout based on the supplied Arduino + 7-segment reference.
    wire('J34','A19','green'),   // D2 -> A
    wire('J35','A20','blue'),    // D3 -> B
    wire('J36','J19','orange'),  // D4 -> C
    wire('J37','J17','green'),   // D5 -> D
    wire('J38','J16','yellow'),  // D6 -> E
    wire('J39','A17','white'),   // D7 -> F
    wire('J40','A16','blue'),    // D8 -> G
    wire('J41','J20','orange'),  // D9 -> DP
  ];
  c.wires = autoTidyWireBundle(c.wires, c.parts, holePosition);
  return c;
}
