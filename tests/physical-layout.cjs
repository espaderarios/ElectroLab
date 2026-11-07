/**
 * Physical 3D clearance regression suite: node-only; no WebGL required.
 * Run with npm run test:physical after npm install.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts';
  return originalResolve.call(this, name, parent, ...rest);
};
let serial = 0;
Module._load = function (name, parent, ...rest) {
  if (name === '@/lib/utils') return {uid: (prefix) => `${prefix}-${++serial}`};
  if (name === 'zustand') return {
    create: (initializer) => {
      const build = (fn) => {
        let value;
        const set = (next) => { value = {...value, ...(typeof next === 'function' ? next(value) : next)}; };
        const get = () => value;
        value = fn(set, get);
        const hook = (selector) => selector ? selector(value) : value;
        hook.getState = get;
        return hook;
      };
      return initializer ? build(initializer) : build;
    },
  };
  if (name === 'zustand/middleware') return {persist: (fn) => fn};
  return originalLoad.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS},
    reportDiagnostics: true,
  });
  const diagnostics = (output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(diagnostics.length, 0, `${filename} has syntax errors`);
  module._compile(output.outputText, filename);
};
const {setBoardPreset, holePosition} = require('../src/circuit/breadboard.ts');
const {buildPreviewPart, useLab} = require('../src/store/lab.ts');
const {circuitHalfAdder, circuitFullAdder} = require('../src/circuit/adder-circuits.ts');
const {partObstacle, rectsOverlap, placementIsBlocked, collectWireBodyObstacles, segmentRectDistance} = require('../src/circuit/placement-obstacles.ts');
const {planWireRoutes, wireRoute3DPoints} = require('../src/circuit/wire-routing.ts');
setBoardPreset('standard-830');

// An Arduino Uno sits beside the board, not over the 23 terminal columns
// used for its virtual net mapping. The user must be able to place a part in
// an otherwise-empty hole within that range, even if the Uno has a pin there.
const virtualMcu = {...buildPreviewPart('mcu', 'F29'), id: 'uno'};
const freeResistor = {...buildPreviewPart('resistor', 'F46'), id: 'near-uno'};
assert.ok(!placementIsBlocked(freeResistor, [virtualMcu]), 'Arduino virtual header should not reserve breadboard holes');
assert.ok(!rectsOverlap(partObstacle(virtualMcu), partObstacle(freeResistor)), 'Arduino physical case must not overlap breadboard resistor');
assert.ok(placementIsBlocked({...virtualMcu, id:'duplicate-uno'}, [virtualMcu]), 'Two physical Arduino PCBs cannot occupy the same space');
const mcuWireRoute = planWireRoutes([{id:'uno-net',a:'J34',b:'A19',color:'green',style:'jumper'}], holePosition, [virtualMcu]);
assert.ok(!mcuWireRoute[0].blocked, 'Arduino virtual pin routing should not be blocked by phantom case');
const mcuAndResistor = planWireRoutes([{id:'uno-net',a:'J34',b:'A19',color:'green',style:'jumper'}], holePosition, [virtualMcu,freeResistor]);
assert.ok(!mcuAndResistor[0].blocked, 'Adding a resistor to a free breadboard area must not break unrelated MCU wiring');
useLab.getState().loadCircuit({boardId:'standard-830',parts:[virtualMcu],wires:[],psuPositive:null,psuNegative:null});
useLab.getState().placePartAt('resistor','F46');
assert.equal(useLab.getState().parts.length, 2, 'An empty breadboard slot next to virtual MCU nets must accept components');
setBoardPreset('full-1660');
const virtualMcuFull = {...buildPreviewPart('mcu','F29'), id:'uno-full'};
const fullRes = {...buildPreviewPart('resistor','A45'), id:'R-full'};
assert.ok(!placementIsBlocked(fullRes, [virtualMcuFull]), 'Full-size board must not be blocked by off-board Arduino case');
setBoardPreset('standard-830');
const {circuitArduinoSevenSegment} = require('../src/circuit/display-examples.ts');
const arduinoDemo = circuitArduinoSevenSegment();
useLab.getState().loadCircuit(arduinoDemo);
const demoPartCount = useLab.getState().parts.length;
useLab.getState().placePartAt('resistor', 'F50');
assert.equal(useLab.getState().parts.length, demoPartCount + 1,
  `Empty F50 near the Arduino nets must accept a resistor; received: ${useLab.getState().placementError}`);

// Physical IC packages: same-hole-independent pins must NOT allow overlapping bodies.
const first = {...buildPreviewPart('and', 'F10'), id: 'first'};
const overlapping = {...buildPreviewPart('xor', 'F11'), id: 'second'};
const clear = {...buildPreviewPart('xor', 'F25'), id: 'clear'};
assert.ok(placementIsBlocked(overlapping, [first]), 'ICs may not overlap in space');
assert.ok(!placementIsBlocked(clear, [first]), 'Separate IC footprints incorrectly blocked');
assert.ok(rectsOverlap(partObstacle(first), partObstacle(overlapping)));

const wire = (id, a, b, style) => ({id, a, b, style, color:'blue'});
// A straight A->J wire would slice through the DIP-14 body: enforce a detour.
const cross = wire('cross', 'A12', 'J12', 'solid');
const route = planWireRoutes([cross], holePosition, [first])[0];
const obstacle = collectWireBodyObstacles([first])[0];
assert.ok(route && !route.blocked, 'Should find a route around the IC');
assert.deepEqual(route.waypoints[0], {x: holePosition(cross.a)[0], z: holePosition(cross.a)[2]});
const last = route.waypoints.at(-1);
assert.deepEqual(last, {x: holePosition(cross.b)[0], z: holePosition(cross.b)[2]});
for (let i=1; i<route.waypoints.length; i++) {
  const p = route.waypoints[i-1], q = route.waypoints[i];
  assert.ok(p.x === q.x || p.z === q.z, 'Route changed to non-orthogonal geometry');
  assert.ok(segmentRectDistance(p, q, obstacle) > 0.054, 'Insulated wire penetrates physical IC shell');
}

// The actual 3D points must stay in raised lanes and touch the holes at each end.
const xyz = wireRoute3DPoints(route);
assert.equal(xyz.length, route.waypoints.length + 2);
assert.ok(xyz.slice(1, -1).every(p => p.y > xyz[0].y));

// Input order should NOT change the layer order; jumper always above solids.
const layered = planWireRoutes([
  wire('jumper', 'A13', 'J13', 'jumper'),
  wire('solid1', 'A14', 'J14', 'solid'),
  wire('solid2', 'A15', 'J15', 'solid'),
], holePosition);
assert.equal(layered.length, 3);
assert.ok(layered[0].lift > Math.max(layered[1].lift, layered[2].lift) + 0.09,
  'Jumper must clear every solid wire, regardless of input order');

// Existing educational templates remain routable with real body obstacles.
for (const [name, preset] of [['half',circuitHalfAdder()],['full',circuitFullAdder()]]) {
  const routes = planWireRoutes(preset.wires, holePosition, preset.parts);
  assert.equal(routes.length, preset.wires.length);
  const blocked = routes.filter(p => p.blocked);
  console.log(`${name}: ${routes.length} wires, ${blocked.length} unroutable`);
  assert.ok(blocked.length <= 2, `${name} has too many wires blocked after upgrade`);
}

// Colliding moves must leave circuit state intact, with no Undo history entry.
const lab = () => useLab.getState();
lab().loadCircuit({boardId:'standard-830',parts:[first,clear],wires:[],psuPositive:null,psuNegative:null});
lab().setTool('select');
lab().select(clear.id);
const beforePins = {...lab().parts.find(p=>p.id === clear.id).pins};
const hist = lab().history.length;
lab().moveSelectedTo('F12');
assert.deepEqual(lab().parts.find(p=>p.id === clear.id).pins, beforePins);
assert.equal(lab().history.length, hist);
// A palette drop into an occupied physical footprint is rejected and explained.
lab().loadCircuit({boardId:'standard-830', parts:[first], wires:[], psuPositive:null, psuNegative:null});
lab().setTool('xor');
const h0 = lab().history.length;
lab().placePartAt('xor', 'F11');
assert.equal(lab().parts.length, 1, 'Overlapping new chip should not be inserted');
assert.equal(lab().history.length, h0, 'Rejected placement should not create Undo history');
assert.match(lab().placementError || '', /occupied/i);
lab().dismissPlacementError();
assert.equal(lab().placementError, null);

// Wire routing should not mutate the electrical contact mapping.
for (const circuit of [circuitHalfAdder(), circuitFullAdder()]) {
  const before = circuit.wires.map(w => [w.a,w.b]);
  const routes = planWireRoutes(circuit.wires, holePosition, circuit.parts);
  assert.equal(routes.length, circuit.wires.length);
  assert.deepEqual(circuit.wires.map(w => [w.a,w.b]), before);
}

const bench = circuitFullAdder();
const now = performance.now();
for (let i=0; i<5; i++) planWireRoutes(bench.wires, holePosition, bench.parts);
console.log(`Full-adder wire routing: ${((performance.now()-now)/5).toFixed(1)} ms/plan (Node benchmark)`);

console.log('Solid-object footprints, route detours, wire height layering and move rejection: PASS');
