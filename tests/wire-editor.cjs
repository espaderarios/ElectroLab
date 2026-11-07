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
    create: (initializer) => {
      const build = (init) => {
        let state;
        const set = (updater) => { const change = typeof updater === 'function' ? updater(state) : updater; state = {...state, ...change}; };
        const get = () => state;
        state = init(set, get);
        const hook = (selector) => selector ? selector(state) : state;
        hook.getState = get;
        return hook;
      };
      return initializer ? build(initializer) : build;
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

const {useLab} = require('../src/store/lab.ts');
const {circuitHalfAdder, circuitFullAdder} = require('../src/circuit/adder-circuits.ts');
const {planWireRoutes} = require('../src/circuit/wire-routing.ts');
const {holePosition, setBoardPreset, holeStrip} = require('../src/circuit/breadboard.ts');

const state = () => useLab.getState();
setBoardPreset('standard-830');
const half = circuitHalfAdder();
state().loadCircuit(half);
assert.equal(state().parts.length, half.parts.length);

// Core regression: delete tool must delete any selected part, including ICs.
const chip = state().parts.find((p) => p.kind === 'xor');
assert.ok(chip);
state().setTool('delete');
state().select(chip.id);
assert.equal(state().parts.some((p) => p.id === chip.id), false, 'XOR IC not removed');
state().undo();
assert.ok(state().parts.some((p) => p.id === chip.id), 'Undo did not restore IC');

// Selected component -> inspector delete -> undo -> redo.
state().setTool('select');
const resistor = state().parts.find((p) => p.kind === 'resistor');
state().select(resistor.id);
const oldLen = state().parts.length;
state().deleteSelected();
assert.equal(state().parts.length, oldLen - 1);
state().undo();
assert.equal(state().parts.length, oldLen);
state().redo();
assert.equal(state().parts.length, oldLen - 1);
state().undo();

// Delete tool also removes wire meshes without damaging other wires; undo restores it.
state().setTool('delete');
const wireToDelete = state().wires[0];
const beforeWireDelete = state().wires.length;
state().select(wireToDelete.id);
assert.equal(state().wires.length, beforeWireDelete - 1, 'delete tool did not remove wire');
state().undo();
assert.equal(state().wires.length, beforeWireDelete, 'undo did not restore wire');
state().setTool('select');

// Visual wire style never changes electrical connectivity.
const wire = state().wires[0];
state().select(wire.id);
const a = wire.a, b = wire.b;
state().setWireStyle('jumper');
assert.equal(state().wires[0].style, 'jumper');
assert.deepEqual([state().wires[0].a,state().wires[0].b], [a,b]);
state().undo();
assert.notEqual(state().wires[0].style, 'jumper', 'wire-style undo failed');
state().setTool('wire');
assert.equal(state().selectedId, null, 'Selecting wire tool should clear inspector');
state().setWireStyle('jumper');
const count = state().wires.length;
const aNew = 'C2', bNew = 'H41';
assert.notEqual(holeStrip(aNew), holeStrip(bNew));
state().clickHole(aNew);
state().clickHole(bNew);
assert.equal(state().wires.length, count + 1);
assert.equal(state().wires[state().wires.length - 1].style, 'jumper');
state().clickHole(aNew);
state().clickHole(bNew);
assert.equal(state().wires.length, count + 1, 'duplicate wire was accepted');
state().undo();
assert.equal(state().wires.length, count);

// Routing: routes remain orthogonal, have unique IDs, and keep physical pins.
for (const circuit of [half, circuitFullAdder()]) {
  const planned = planWireRoutes(circuit.wires, holePosition);
  assert.equal(planned.length, circuit.wires.length);
  assert.equal(new Set(planned.map((p) => p.id)).size, circuit.wires.length);
  for (let i = 0; i < circuit.wires.length; i++) {
    const wire = circuit.wires[i], route = planned[i];
    const aPos = holePosition(wire.a), bPos = holePosition(wire.b);
    assert.ok(Math.abs(route.waypoints[0].x - aPos[0]) < 1e-4);
    assert.ok(Math.abs(route.waypoints[0].z - aPos[2]) < 1e-4);
    assert.ok(Math.abs(route.waypoints[route.waypoints.length-1].x - bPos[0]) < 1e-4);
    assert.ok(Math.abs(route.waypoints[route.waypoints.length-1].z - bPos[2]) < 1e-4);
    assert.ok(Number.isFinite(route.lift) && route.lift > 0);
    for(let k = 1; k < route.waypoints.length; k++) {
      const last = route.waypoints[k-1], next = route.waypoints[k];
      assert.ok(Math.abs(next.x-last.x) < 1e-4 || Math.abs(next.z-last.z) < 1e-4, 'nonorthogonal solid run');
    }
  }
}
const testWires = [
  {id:'a',a:'A10',b:'A20',color:'red',style:'solid'},
  {id:'b',a:'B10',b:'B20',color:'blue',style:'solid'},
  {id:'c',a:'C10',b:'C20',color:'green',style:'jumper'},
];
const tracks = planWireRoutes(testWires, holePosition);
assert.equal(tracks[2].style, 'jumper');
assert.ok(tracks[2].lift > tracks[0].lift);
console.log('IC/part deletion, undo/redo, wire type, duplicate prevention, route planning: PASS');
