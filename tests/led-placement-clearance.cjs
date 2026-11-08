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
const {setBoardPreset} = require('../src/circuit/breadboard.ts');
const {buildPreviewPart, useLab, previewMovedPart} = require('../src/store/lab.ts');
const {placementIsBlocked, pinConflict, partObstacle, rectsOverlap} = require('../src/circuit/placement-obstacles.ts');

for (const boardId of ['standard-830', 'extended-1400', 'full-1660']) {
  setBoardPreset(boardId);
  // Realistic layout: resistor in B10-B13, LED in adjacent row C11-C12.
  // Lead rectangles overlap, but resistor shell radius (~0.058) plus LED
  // flange radius (~0.124) is less than the breadboard's 0.20 row pitch.
  const resistor = {...buildPreviewPart('resistor', 'B10'), id:`resistor-${boardId}`};
  const led = {...buildPreviewPart('led', 'C11'), id:`led-${boardId}`};
  assert.deepEqual([resistor.pins.a, resistor.pins.b], ['B10','B13']);
  assert.deepEqual([led.pins.a, led.pins.k], ['C11','C12']);
  assert.equal(pinConflict(led,[resistor]),false,'different holes must not count as pin conflict');
  assert.equal(rectsOverlap(partObstacle(led),partObstacle(resistor)),false,
    `${boardId}: visible LED bulb should not collide with the resistor body one row away`);
  assert.equal(placementIsBlocked(led,[resistor]),false,
    `${boardId}: adjacent-row LED placement should be allowed`);

  // Symmetry: a resistor next to an existing LED must be allowed as well.
  assert.equal(placementIsBlocked(resistor,[led]),false,
    `${boardId}: resistor must be placeable beside the LED`);

  // An LED in the same row, whose bulb overlaps the resistor shell, is not safe.
  const bodyOverlap = {...buildPreviewPart('led','B11'),id:`body-${boardId}`};
  assert.equal(pinConflict(bodyOverlap,[resistor]),false,'B11/B12 do not share B10/B13 terminals');
  assert.equal(placementIsBlocked(bodyOverlap,[resistor]),true,'real solid-body collision must be rejected');

  // Sharing a physical breadboard hole is never legal even if shells are apart.
  const pinOverlap = {...buildPreviewPart('led','B13'),id:`pin-${boardId}`};
  assert.equal(pinConflict(pinOverlap,[resistor]),true,'B13 terminal is already occupied');
  assert.equal(placementIsBlocked(pinOverlap,[resistor]),true,'sharing a hole must be blocked');

  // Two adjacent-row 5 mm LEDs cannot overlap their wide flanges.
  const neighborLed = {...buildPreviewPart('led','B11'),id:`neighbor-${boardId}`};
  assert.equal(placementIsBlocked(neighborLed,[led]),true,
    `${boardId}: large LED flanges in directly adjacent rows should collide`);

  // Real insertion, selection and movement must use the same rule as preview.
  const lab = ()=>useLab.getState();
  lab().loadCircuit({boardId,parts:[resistor],wires:[],psuPositive:null,psuNegative:null});
  lab().setTool('led');
  lab().placePartAt('led','C11');
  assert.equal(lab().parts.length,2,
    `${boardId}: valid LED drop incorrectly rejected: ${lab().placementError}`);
  const created = lab().parts.find(part=>part.kind==='led');
  assert.ok(created,`${boardId}: LED missing after placement`);
  assert.equal(lab().placementError,null,'valid placement should clear errors');

  // Move from a safe location to another adjacent-row location; then reject
  // an attempt to move onto the resistor's physical body.
  lab().setTool('select');
  lab().select(created.id);
  const safeMove = previewMovedPart(created,'C12');
  assert.equal(placementIsBlocked(safeMove,lab().parts,created.id),false);
  lab().moveSelectedTo('C12');
  assert.equal(lab().parts.find(p=>p.id===created.id).pins.a,'C12','safe move should succeed');
  const beforeRejected = {...lab().parts.find(p=>p.id===created.id).pins};
  lab().moveSelectedTo('B11');
  assert.deepEqual(lab().parts.find(p=>p.id===created.id).pins,beforeRejected,
    'a genuine solid-body collision should remain blocked');
  assert.match(lab().placementError ?? '',/collision|overlap|occupy|hole|solid/i);
  console.log(`${boardId}: LED beside resistor permitted; actual overlaps rejected`);
}
console.log('LED/resistor physical-body clearance, hole occupancy, move and drop: PASS');
