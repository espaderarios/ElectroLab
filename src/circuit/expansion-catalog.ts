/**
 * ElectroLab expansion catalog. A named item has ONE definition for palette,
 * native wire sockets, physical package and simulation support level.
 *
 * NOTE: visual/prototype = electrically high impedance. It is not an emulator
 * of the advertised IC, firmware, communications protocol or power converter.
 */
export type ExpansionCategory = 'Digital Logic' | 'Microcontrollers' | 'Sensors' | 'Inputs & Displays' | 'Motor Control' | 'Power Modules' | 'Instruments';
export type ExpansionShape = 'dip' | 'microcontroller' | 'sensor' | 'screen' | 'keypad' | 'matrix' | 'motor' | 'driver' | 'power' | 'instrument' | 'encoder';
export type ExpansionBehavior = 'logic-adder' | 'logic-bcd' | 'logic-decoder' | 'dc-probe' | 'prototype';
export type ExpansionComponent = {
  id: string;
  name: string;
  description: string;
  category: ExpansionCategory;
  pins: readonly string[];
  shape: ExpansionShape;
  footprint: 'dip' | 'header' | 'inline';
  behavior: ExpansionBehavior;
  color?: string;
};
const pins = (count: number) => Array.from({length:count}, (_, i) => `p${i+1}`);
const devPins = (count: number) => ['gnd','vcc',...Array.from({length:count-2},(_,i)=>`io${i}`)];
export const EXPANSION_COMPONENTS = [
  // Correct DIP pin numbers for the 74HC283, CD4511 and 74HC138 are exposed
  // as p1..p16. Their combinational DC behavior is evaluated by simulate.ts.
  {id:'ic-74hc283',name:'74HC283 · 4-bit Adder',description:'16-pin DIP; powered A+B+Cin combinational sum (DC model)',category:'Digital Logic',pins:pins(16),shape:'dip',footprint:'dip',behavior:'logic-adder'},
  {id:'ic-cd4511',name:'CD4511 · BCD Decoder',description:'16-pin DIP; BCD to a–g active-high output (DC model)',category:'Digital Logic',pins:pins(16),shape:'dip',footprint:'dip',behavior:'logic-bcd'},
  {id:'ic-74hc595',name:'74HC595 · Shift Register',description:'Serial-to-parallel IC; clocked shifting not yet emulated',category:'Digital Logic',pins:pins(16),shape:'dip',footprint:'dip',behavior:'prototype'},
  {id:'ic-74hc74',name:'74HC74 · D Flip-Flop',description:'Dual D flip-flop; edge-triggered state not yet emulated',category:'Digital Logic',pins:pins(14),shape:'dip',footprint:'dip',behavior:'prototype'},
  {id:'ic-74hc161',name:'74HC161 · Counter',description:'4-bit synchronous counter; clocked state not yet emulated',category:'Digital Logic',pins:pins(16),shape:'dip',footprint:'dip',behavior:'prototype'},
  {id:'ic-74hc138',name:'74HC138 · 3-to-8 Decoder',description:'16-pin DIP; active-low outputs (DC model)',category:'Digital Logic',pins:pins(16),shape:'dip',footprint:'dip',behavior:'logic-decoder'},
  {id:'module-clock',name:'Clock Generator Module',description:'3-pin clock source; timed edges not yet emulated',category:'Digital Logic',pins:['vcc','gnd','out'],shape:'sensor',footprint:'inline',behavior:'prototype'},

  {id:'board-nano',name:'Arduino Nano',description:'Compact ATmega328P board; pins available; firmware emulation pending',category:'Microcontrollers',pins:devPins(30),shape:'microcontroller',footprint:'header',behavior:'prototype',color:'#1265a3'},
  {id:'board-mega',name:'Arduino Mega 2560',description:'Mega board, representative 30-pin header subset; firmware emulation pending',category:'Microcontrollers',pins:devPins(30),shape:'microcontroller',footprint:'header',behavior:'prototype',color:'#1366a1'},
  {id:'board-esp32',name:'ESP32 DevKit',description:'Wi-Fi MCU; representative GPIO header; wireless/firmware pending',category:'Microcontrollers',pins:devPins(30),shape:'microcontroller',footprint:'header',behavior:'prototype',color:'#1f3553'},
  {id:'board-pico',name:'Raspberry Pi Pico',description:'RP2040 board; representative header; PIO/firmware pending',category:'Microcontrollers',pins:devPins(30),shape:'microcontroller',footprint:'header',behavior:'prototype',color:'#166746'},

  {id:'sensor-hcsr04',name:'HC-SR04 Ultrasonic',description:'TRIG/ECHO ultrasonic distance sensor; distance timing pending',category:'Sensors',pins:['vcc','trig','echo','gnd'],shape:'sensor',footprint:'inline',behavior:'prototype'},
  {id:'sensor-dht22',name:'DHT22 Temp / Humidity',description:'Single-wire digital sensor; protocol pending',category:'Sensors',pins:['vcc','data','nc','gnd'],shape:'sensor',footprint:'inline',behavior:'prototype'},
  {id:'sensor-pir',name:'PIR Motion Detector',description:'Passive infrared motion detector; environmental input pending',category:'Sensors',pins:['vcc','out','gnd'],shape:'sensor',footprint:'inline',behavior:'prototype'},
  {id:'sensor-ir',name:'IR Obstacle Detector',description:'Infrared reflection/obstacle sensor; environmental input pending',category:'Sensors',pins:['vcc','gnd','out'],shape:'sensor',footprint:'inline',behavior:'prototype'},
  {id:'sensor-hall',name:'Hall Effect Sensor',description:'Three-terminal magnetic sensor; field model pending',category:'Sensors',pins:['vcc','gnd','out'],shape:'sensor',footprint:'inline',behavior:'prototype'},
  {id:'sensor-mpu6050',name:'MPU-6050 IMU',description:'I²C accelerometer/gyro breakout; motion protocol pending',category:'Sensors',pins:['vcc','gnd','scl','sda','xda','xcl','ad0','int'],shape:'sensor',footprint:'inline',behavior:'prototype'},

  {id:'input-keypad',name:'4×4 Matrix Keypad',description:'R1–R4 and C1–C4 exposed; keyboard scanner pending',category:'Inputs & Displays',pins:['r1','r2','r3','r4','c1','c2','c3','c4'],shape:'keypad',footprint:'inline',behavior:'prototype'},
  {id:'input-encoder',name:'Rotary Encoder',description:'A/B quadrature outputs and push contact; pulses pending',category:'Inputs & Displays',pins:['gnd','vcc','clk','dt','sw'],shape:'encoder',footprint:'inline',behavior:'prototype'},
  {id:'display-8x8',name:'8×8 LED Matrix',description:'16 row/column terminals; multiplexed rendering pending',category:'Inputs & Displays',pins:[...Array.from({length:8},(_,i)=>`r${i+1}`),...Array.from({length:8},(_,i)=>`c${i+1}`)],shape:'matrix',footprint:'dip',behavior:'prototype'},
  {id:'display-max7219',name:'MAX7219 LED Matrix',description:'SPI-style DIN/CLK/CS module; driver protocol pending',category:'Inputs & Displays',pins:['vcc','gnd','din','cs','clk'],shape:'matrix',footprint:'inline',behavior:'prototype'},
  {id:'display-4digit',name:'Four-Digit 7-Segment',description:'12-pin bare LED package with four 7-segment digits and decimal points; multiplex drive not yet simulated',category:'Inputs & Displays',pins:['a','b','c','d','e','f','g','dp','dig1','dig2','dig3','dig4'],shape:'screen',footprint:'dip',behavior:'prototype'},
  {id:'display-ledbar',name:'10-LED Bar Graph',description:'10 LED elements; individual anode/cathode multiplexing pending',category:'Inputs & Displays',pins:Array.from({length:20},(_,i)=>`p${i+1}`),shape:'screen',footprint:'dip',behavior:'prototype'},

  {id:'driver-l298n',name:'L298N H-Bridge Driver',description:'Motor driver module; bridge current and PWM model pending',category:'Motor Control',pins:['vin','gnd','vcc','ena','in1','in2','in3','in4','enb','out1','out2','out3','out4'],shape:'driver',footprint:'header',behavior:'prototype'},
  {id:'driver-uln2003',name:'ULN2003 Stepper Driver',description:'Darlington driver breakout; motor sequence model pending',category:'Motor Control',pins:['vcc','gnd','in1','in2','in3','in4','out1','out2','out3','out4'],shape:'driver',footprint:'header',behavior:'prototype'},
  {id:'motor-28byj48',name:'28BYJ-48 Stepper Motor',description:'Five-wire stepper; step sequencing pending',category:'Motor Control',pins:['red','blue','pink','yellow','orange'],shape:'motor',footprint:'inline',behavior:'prototype'},
  {id:'actuator-solenoid',name:'DC Solenoid',description:'Two-wire coil; simplified visual actuator',category:'Motor Control',pins:['a','b'],shape:'motor',footprint:'inline',behavior:'prototype'},

  {id:'power-buck',name:'LM2596 Buck Converter',description:'Step-down converter; switching/regulation not yet emulated',category:'Power Modules',pins:['vin+','vin-','vout+','vout-'],shape:'power',footprint:'inline',behavior:'prototype'},
  {id:'power-boost',name:'DC Boost Converter',description:'Step-up converter; switching/regulation not yet emulated',category:'Power Modules',pins:['vin+','vin-','vout+','vout-'],shape:'power',footprint:'inline',behavior:'prototype'},
  {id:'power-bridge',name:'Bridge Rectifier Module',description:'Four-terminal diode bridge; AC behavior pending',category:'Power Modules',pins:['ac1','ac2','plus','minus'],shape:'power',footprint:'inline',behavior:'prototype'},
  {id:'power-battery',name:'18650 Battery Holder',description:'Battery holder; source/cell discharge model pending',category:'Power Modules',pins:['plus','minus'],shape:'power',footprint:'inline',behavior:'prototype'},
  {id:'power-tp4056',name:'TP4056 Charger Module',description:'Li-ion charger breakout; charger protection model pending',category:'Power Modules',pins:['in+','in-','b+','b-','out+','out-'],shape:'power',footprint:'inline',behavior:'prototype'},

  {id:'instrument-scope',name:'Oscilloscope (DC)',description:'Four-channel voltage readout; high-impedance, not waveform sampling',category:'Instruments',pins:['ch1','ch2','ch3','ch4','gnd'],shape:'instrument',footprint:'inline',behavior:'dc-probe'},
  {id:'instrument-generator',name:'Function Generator',description:'Signal source panel; AC waveform output pending',category:'Instruments',pins:['out','gnd'],shape:'instrument',footprint:'inline',behavior:'prototype'},
  {id:'instrument-meter',name:'Digital Multimeter',description:'Voltmeter terminal pair; live DC voltage readout',category:'Instruments',pins:['v','com'],shape:'instrument',footprint:'inline',behavior:'dc-probe'},
  {id:'instrument-logic',name:'Logic Analyzer (DC)',description:'Eight-channel static HIGH/LOW readout; timing capture pending',category:'Instruments',pins:['gnd',...Array.from({length:8},(_,i)=>`d${i}`)],shape:'instrument',footprint:'inline',behavior:'dc-probe'},
  {id:'instrument-frequency',name:'Frequency Counter',description:'Frequency measurement front end; edge timing pending',category:'Instruments',pins:['in','gnd'],shape:'instrument',footprint:'inline',behavior:'prototype'},
] as const satisfies readonly ExpansionComponent[];

export type ExpansionToolId = (typeof EXPANSION_COMPONENTS)[number]['id'];
const byId = new Map<string, ExpansionComponent>(EXPANSION_COMPONENTS.map(item => [item.id,item]));
export function expansionById(id: string | undefined): ExpansionComponent | undefined { return id ? byId.get(id) : undefined; }
export const EXPANSION_CATEGORIES = ['Digital Logic','Sensors','Inputs & Displays','Motor Control','Power Modules','Instruments'] as const;
