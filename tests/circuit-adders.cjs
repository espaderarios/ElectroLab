/* Run with `npm run test:circuits` after `npm install`. Uses TypeScript's
   transpiler so it can exercise the simulator directly without a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const project = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.startsWith('@/')) return path.join(project, 'src', request.slice(2)) + '.ts';
  return originalResolve.call(this, request, parent, ...rest);
};
// The circuit builder uses only uid() from this UI-facing helper module.
let sequence = 0;
Module._load = function (request, parent, ...rest) {
  if (request === '@/lib/utils') return {uid: (prefix) => `${prefix}-${++sequence}`};
  if (request === 'zustand') return {
    create: () => (initializer) => {
      let state;
      const set = (updater) => { const change = typeof updater === 'function' ? updater(state) : updater; state = {...state, ...change}; };
      const get = () => state;
      state = initializer(set, get);
      return {getState: get};
    },
  };
  if (request === 'zustand/middleware') return {persist: (initializer) => initializer};
  return originalLoad.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (m, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const js = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX},
    reportDiagnostics: true,
  });
  const errors = (js.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `Could not transpile ${filename}`);
  m._compile(js.outputText, filename);
};

const {circuitHalfAdder, circuitFullAdder} = require('../src/circuit/adder-circuits.ts');
const {LOGIC_IC_PINOUTS, logicPinLabel} = require('../src/circuit/logic-ics.ts');
const {simulate} = require('../src/circuit/simulate.ts');
const {getAllHoles, setBoardPreset, holeStrip} = require('../src/circuit/breadboard.ts');

function assertPhysicalWiring(circuit, strict = true) {
  const holes = new Set(getAllHoles());
  assert.ok(holes.has(circuit.psuPositive));
  assert.ok(holes.has(circuit.psuNegative));
  for (const part of circuit.parts) {
    for (const [pin, hole] of Object.entries(part.pins)) {
      assert.ok(holes.has(hole), `Missing board hole ${part.kind}:${pin}=${hole}`);
    }
  }
  for (const wire of circuit.wires) {
    assert.ok(holes.has(wire.a), `Invalid wire hole: ${wire.a}`);
    assert.ok(holes.has(wire.b), `Invalid wire hole: ${wire.b}`);
    if (strict) assert.notEqual(holeStrip(wire.a), holeStrip(wire.b), `Redundant wire between ${wire.a} and ${wire.b}`);
  }
  for (const chip of circuit.parts.filter((p) => LOGIC_IC_PINOUTS[p.kind])) {
    assert.equal(chip.pins.p14, `E${Number(chip.pins.p1.slice(1))}`);
    assert.equal(chip.pins.p7, `F${Number(chip.pins.p1.slice(1)) + 6}`);
  }
}

setBoardPreset('standard-830');
assert.equal(logicPinLabel('nor',1),'Y1 output');
assert.equal(logicPinLabel('nor',2),'A1 input');
assert.equal(logicPinLabel('xnor',4),'Y2 output');
assert.equal(LOGIC_IC_PINOUTS.nor.gates[2].output,10);
assert.equal(LOGIC_IC_PINOUTS.xnor.gates[1].output,4);

function check(full) {
  const circuit = full ? circuitFullAdder() : circuitHalfAdder();
  assertPhysicalWiring(circuit);
  const switches = circuit.parts.filter((p) => p.kind === 'switch');
  assert.equal(switches.length, full ? 3 : 2);
  assert.equal(circuit.parts.filter((p) => p.kind === 'xor').length, 1);
  assert.equal(circuit.parts.filter((p) => p.kind === 'and').length, 1);
  assert.equal(circuit.parts.filter((p) => p.kind === 'or').length, full ? 1 : 0);
  for (let mask = 0; mask < 2 ** switches.length; mask++) {
    const states = switches.map((_, i) => Boolean(mask & (1 << i)));
    const parts = circuit.parts.map((p) => p.kind === 'switch' ? {
      ...p, props: {...p.props, closed: states[switches.findIndex((s) => s.id === p.id)]},
    } : p);
    const result = simulate({...circuit, parts, powerOn: true});
    assert.equal(result.shortCircuit, false, `Unexpected short (${mask} ${full})`);
    const [a,b,cin=false] = states;
    const sum = Number(a !== b !== cin);
    const carry = Number(Number(a) + Number(b) + Number(cin) >= 2);
    const sumPin = parts.find((p) => p.props.label === 'SUM · 680Ω').pins.a;
    const carryPin = parts.find((p) => p.props.label === 'CARRY · 680Ω').pins.a;
    const sumV = result.voltages[sumPin];
    const carryV = result.voltages[carryPin];
    assert.equal(sumV >= 2.5 ? 1 : 0, sum, `SUM wrong for ${states}: ${sumV}`);
    assert.equal(carryV >= 2.5 ? 1 : 0, carry, `CARRY wrong for ${states}: ${carryV}`);
    const sumLed = parts.find((p) => p.kind === 'led' && p.props.label === 'SUM');
    const carryLed = parts.find((p) => p.kind === 'led' && p.props.label === 'CARRY');
    assert.equal(Number(result.leds[sumLed.id].on), sum, `SUM LED wrong for ${states}`);
    assert.equal(Number(result.leds[carryLed.id].on), carry, `CARRY LED wrong for ${states}`);
    console.log(`${full ? 'FULL' : 'HALF'} ${states.map(Number).join('')} → S=${Number(sumV>=2.5)} C=${Number(carryV>=2.5)} (V=${sumV.toFixed(2)},${carryV.toFixed(2)})`);
  }
}
check(false);
check(true);
console.log('Circuit truth tables and physical wiring: PASS');

// Regression check for older seeded projects.  These are real circuit records,
// not screenshots or manually assigned "Pass" badges.
const {useProjects} = require('../src/store/projects.ts');
for (const project of useProjects.getState().projects) {
  const circuit = project.circuit;
  assertPhysicalWiring(circuit, false);
  const redundant = circuit.wires.filter((w) => holeStrip(w.a) === holeStrip(w.b)).map((w) => `${w.a}→${w.b}`);
  if (redundant.length) console.log('  redundant jumper(s):', redundant.join(', '));
  const result = simulate({...circuit, powerOn: true});
  console.log(`SEEDED ${project.id}: parts=${circuit.parts.length} wires=${circuit.wires.length} current=${result.supplyCurrent.toFixed(5)} short=${result.shortCircuit} leds=${Object.values(result.leds).filter((led) => led.on).length}`);
  assert.equal(result.shortCircuit, false, `Unexpected short in ${project.id}`);
}
for (const name of ['led-blink', 'dc-motor']) {
  const circuit = useProjects.getState().projects.find((p) => p.id === name).circuit;
  const pressed = circuit.parts.map((p) => p.kind === 'button' ? ({...p, props:{...p.props, closed:true}}) : p);
  const result = simulate({...circuit, parts:pressed, powerOn:true});
  console.log(`PRESS ${name} I=${result.supplyCurrent.toFixed(5)} LED=${JSON.stringify(result.leds)} MOTOR=${JSON.stringify(result.motors)}`);
}
const {firstLightPreset, dividerPreset, helloWorldPreset} = require('../src/circuit/presets.ts');
for (const builder of [firstLightPreset, dividerPreset, helloWorldPreset]) {
  const preset = builder();
  assertPhysicalWiring(preset, false);
  const result = simulate({...preset, psuVoltage: 5, powerOn:true});
  console.log(`LAB ${preset.id}: parts=${preset.parts.length} I=${result.supplyCurrent.toFixed(5)} short=${result.shortCircuit} LEDs=${Object.values(result.leds).filter(l=>l.on).length}`);
  assert.equal(result.shortCircuit, false, `Short in ${preset.id}`);
  if (preset.id === 'first-light') assert.ok(Object.values(result.leds).some((l) => l.on), 'First Light LED is not lit');
  if (preset.id === 'divider') assert.ok(Math.abs(result.voltages.A10 - 2.5) < 0.15, `Divider midpoint wrong: ${result.voltages.A10}`);
}

// Verify the two nonstandard physical pinouts against their truth tables.
for (const kind of ['nor', 'xnor']) {
  const chip = {id:`${kind}-truth`, kind, pins:{}, props:{}};
  for (let i = 1; i <= 7; i++) chip.pins[`p${i}`] = `F${22+i}`;
  for (let i = 8; i <= 14; i++) chip.pins[`p${i}`] = `E${37-i}`;
  const [inputA, inputB] = LOGIC_IC_PINOUTS[kind].gates[0].inputs;
  const output = LOGIC_IC_PINOUTS[kind].gates[0].output;
  for (let mask = 0; mask < 4; mask++) {
    const a = Boolean(mask&1), b = Boolean(mask&2);
    const parts = [
      chip,
      {id:`${kind}-A`,kind:'switch',pins:{a:'C3',b:'C6'},props:{closed:a}},
      {id:`${kind}-B`,kind:'switch',pins:{a:'C10',b:'C12'},props:{closed:b}},
      {id:`${kind}-R1`,kind:'resistor',pins:{a:'E6',b:'E8'},props:{resistance:10000}},
      {id:`${kind}-R2`,kind:'resistor',pins:{a:'E12',b:'E14'},props:{resistance:10000}},
    ];
    const wires = [
      ['tp5','A3'],['tp10','A10'],['E8','tn8'],['E14','tn14'],
      ['A6',chip.pins[`p${inputA}`]],['A12',chip.pins[`p${inputB}`]],
      [chip.pins.p14,'tp23'],[chip.pins.p7,'tn23'],
    ].map(([a,b],i)=>({id:`n${i}`,a,b,color:'blue'}));
    const result = simulate({parts,wires,psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
    const actual = Number(result.voltages[chip.pins[`p${output}`]] >= 2.5);
    const expected = Number(kind==='nor' ? !(a||b) : a===b);
    assert.equal(actual,expected,`${kind} ${a},${b}`);
  }
  console.log(`${kind.toUpperCase()} special DIP-14 pinout: PASS`);
}
