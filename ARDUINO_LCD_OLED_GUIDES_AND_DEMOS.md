# Arduino + LCD / OLED: clean, editable examples and pin guide

## What was added

- **Pin descriptions:** Inspector now uses pin-function labels (Arduino D0–D13, A0–A5, GND, 5 V, 3V3; HD44780 pins 1–16; OLED VCC/GND/SDA/SCL). Hover a physical pin in 3D for its name and mapped breadboard hole.
- **Wiring Guide:** Click **Wiring guide** beside Monitor. This is read-only: it shows recommended pin pairs, checks which are already electrically connected, and highlights free terminal-strip holes in cyan and yellow. Click the **Wire tool**, then click the two highlighted holes to connect manually. Esc or X closes the guide.
- **Two premade projects:** Arduino Uno + 16×2 LCD, and Arduino Uno + I²C OLED. Both appear under **Projects → Quick-start** and **Templates**. They use editable circuit wires, not baked-in 3D jumpers.
- **Safe state upgrade:** Old saved project lists receive the two new demo projects once (persist schema v6). Existing saved projects, history and personal edits are not overwritten.
- **No automatic wires:** Placing an MCU, LCD, OLED or any component does not inject hidden power, I²C or rail-bridge wires. Power clips have default positions but are not physical wires.
- **Simulation correctness:** OLED text now reaches the virtual screen from the supported Arduino sketch subset; both LCD and OLED require actual power connections. The OLED also requires I²C signal connectivity.

## Arduino Uno + 16×2 LCD (HD44780, 4-bit mode)

| Arduino pin | LCD pin | Purpose |
| --- | --- | --- |
| 5V | 2 VDD | LCD power |
| GND | 1 VSS | Ground |
| GND | 5 RW | Write-only mode |
| D12 | 4 RS | Register select |
| D11 | 6 E | Enable |
| D5 | 11 D4 | Data 4 |
| D4 | 12 D5 | Data 5 |
| D3 | 13 D6 | Data 6 |
| D2 | 14 D7 | Data 7 |

The premade board also includes a **10 kΩ contrast potentiometer** connected to LCD pin 3 VO and a **220 Ω backlight resistor** in series with pin 15 A; pin 16 K goes to ground. The simulator includes explicit 5 V PSU-to-Arduino wires. LCD pins 7–10 D0–D3 are unused in 4-bit mode.

## Arduino Uno + SSD1306 128×64 OLED (I²C)

| Arduino pin | OLED pin | Purpose |
| --- | --- | --- |
| 3V3 | VCC | Regulated 3.3 V |
| GND | GND | Ground |
| A4 / SDA | SDA | I²C data |
| A5 / SCL | SCL | I²C clock |

The premade OLED project has 6 editable wires (4 display connections and 2 bench supply connections). The sketch uses the Adafruit SSD1306 API subset and shows **ElectroLab / OLED wired!** when simulated.

**Physical hardware warning:** Many Uno boards use 5 V I²C pull-ups, which can damage raw 3.3 V-only OLEDs. Consult the actual module specifications and add a bidirectional level shifter or appropriate pull-ups as required. Powering an Arduino Uno through its 5V pin requires a regulated 5 V supply; avoid competing power sources such as an active USB 5 V connection.

## Running tests

```powershell
cd D:\GitHub\ElectroLab
npm install
npm run test:displays
npm run test:circuits
npm run test:projects
npm run dev
```

**Limitations:** The simulator uses an educational subset of Arduino/C++ and approximated 3D part geometry. It is not a full SPICE simulator, manufacturer CAD assembly, or physical firmware compiler. Browser/WebGL visual testing and a full Vite production build must be verified locally after installing npm dependencies.
