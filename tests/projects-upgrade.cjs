/* Check that v4 browser storage upgrades without overwriting user's circuits. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolveOriginal = Module._resolveFilename;
const loadOriginal = Module._load;
let options;
let sequence = 0;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@/')) return path.join(root, 'src', request.slice(2)) + '.ts';
  return resolveOriginal.call(this, request, parent, ...rest);
};
Module._load = function(request, parent, ...rest) {
  if (request === '@/lib/utils') return {uid: (prefix) => `${prefix}_${++sequence}`};
  if (request === 'zustand') return {
    create: () => (initializer) => {
      let state;
      const set = (updater) => { state = {...state, ...(typeof updater === 'function' ? updater(state) : updater)}; };
      const get = () => state;
      state = initializer(set, get);
      return {getState: get};
    },
  };
  if (request === 'zustand/middleware') return {persist: (initializer, opts) => { options = opts; return initializer; }};
  return loadOriginal.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (m, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const r = ts.transpileModule(source, {fileName: filename, compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}, reportDiagnostics: true});
  assert.equal((r.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  m._compile(r.outputText, filename);
};
const {useProjects} = require('../src/store/projects.ts');
const initial = useProjects.getState().projects;
assert(initial.some(p => p.id === 'half-adder'));
assert(initial.some(p => p.id === 'full-adder'));
assert(initial.some(p => p.id === 'four-bit-adder'));
const oldProjects = initial.filter(p => !['half-adder','full-adder','arduino-lcd-demo','arduino-oled-demo','arduino-seven-segment-demo','four-bit-adder'].includes(p.id));
oldProjects[0] = {...oldProjects[0], name: 'Custom motor with changes', circuit: {...oldProjects[0].circuit, psuVoltage: 9}};
oldProjects.push({...oldProjects[0], id: 'my-unique-design', name: 'My unique project'});
const legacy = {projects: oldProjects, activity:[{id:'custom-history'}], simRuns:[{id:'saved-run'}], darkMode:false};
assert.equal(options.version, 11);
const merged = options.migrate(legacy, 4);
assert.deepEqual(merged.activity, legacy.activity);
assert.deepEqual(merged.simRuns, legacy.simRuns);
assert.equal(merged.darkMode, false);
assert.equal(merged.projects.length, legacy.projects.length + 6);
assert.deepEqual(merged.projects.find(p => p.id === 'my-unique-design'), oldProjects.at(-1));
assert.equal(merged.projects.find(p => p.id === 'dc-motor').circuit.psuVoltage, 9);
assert.equal(merged.projects.filter(p => p.id === 'half-adder').length, 1);
assert.equal(merged.projects.filter(p => p.id === 'full-adder').length, 1);
assert.equal(merged.projects.filter(p => p.id === 'four-bit-adder').length, 1);
assert.equal(merged.projects.filter(p => p.id === 'arduino-lcd-demo').length, 1);
assert.equal(merged.projects.filter(p => p.id === 'arduino-oled-demo').length, 1);
assert.equal(merged.projects.filter(p => p.id === 'arduino-seven-segment-demo').length, 1);
const v5 = options.migrate({...legacy, projects:[...oldProjects, ...merged.projects.filter(p=>p.id==='half-adder'||p.id==='full-adder')]}, 5);
assert(v5.projects.some(p=>p.id==='arduino-lcd-demo'));
assert(v5.projects.some(p=>p.id==='arduino-oled-demo'));
assert.equal(v5.projects.filter(p=>p.id==='arduino-lcd-demo').length,1);
assert.equal(v5.projects.filter(p=>p.id==='arduino-seven-segment-demo').length,1);
// Existing v6 browsers must also receive the newly introduced seven-segment lab.
const v6 = options.migrate({...legacy, projects: [...oldProjects]}, 6);
assert.equal(v6.projects.filter(p=>p.id==='arduino-seven-segment-demo').length, 1);
assert.equal(v6.projects.length, oldProjects.length + 2);
assert.equal(v6.projects.find(p=>p.id==='my-unique-design').name, 'My unique project');
const alreadyHasAdders = options.migrate({...legacy, projects:[...merged.projects]}, 4);
assert.equal(alreadyHasAdders.projects.length, merged.projects.length);
// Existing v7 demo projects receive only visual bend hints; user wiring survives.
const oldLcd = initial.find(p=>p.id==='arduino-lcd-demo');
const previousLcd = {...oldLcd, circuit:{...oldLcd.circuit, wires:oldLcd.circuit.wires.map(({bends,bendAnchors,routeLocked,...w})=>w)}};
const mergedV7 = options.migrate({projects:[previousLcd,{...oldProjects[0],id:'custom-route-test'}]},7);
const routed = mergedV7.projects.find(p=>p.id==='arduino-lcd-demo');
assert(routed.circuit.wires.every(w=>Array.isArray(w.bends)));
for(let i=0;i<routed.circuit.wires.length;i++) {
  assert.equal(routed.circuit.wires[i].a, previousLcd.circuit.wires[i].a);
  assert.equal(routed.circuit.wires[i].b, previousLcd.circuit.wires[i].b);
}
assert.deepEqual(mergedV7.projects.find(p=>p.id==='custom-route-test'),oldProjects[0].id==='custom-route-test'?oldProjects[0]:{...oldProjects[0],id:'custom-route-test'});
// Persisted v8 Full Adder should be upgraded into the visible 7-segment demo.
// Preserve the old project as a separate, editable backup, never delete edits.
const fullAdderSeed = initial.find(p=>p.id==='full-adder');
const legacyAdder = {...fullAdderSeed, name:'My customized Full Adder', circuit:{...fullAdderSeed.circuit, boardId:'standard-830',
  parts:fullAdderSeed.circuit.parts.filter(p=>p.kind!=='seven-segment'),
  wires:fullAdderSeed.circuit.wires.map(w=>({...w}))}};
const originalValue = legacyAdder.circuit.psuVoltage = 4.2;
const migratedV8 = options.migrate({projects:[legacyAdder, {...oldProjects[0],id:'private-custom',name:'Do not modify'}],activity:legacy.activity,simRuns:legacy.simRuns},8);
const upgradedAdder = migratedV8.projects.find(p=>p.id==='full-adder');
assert(upgradedAdder.circuit.parts.some(p=>p.kind==='seven-segment'),'Persisted Full Adder must receive the new display');
assert.equal(upgradedAdder.circuit.boardId,'extended-1400','Persisted Full Adder must receive the larger board');
const adderBackups = migratedV8.projects.filter(p=>p.name.includes('Backup — My customized Full Adder'));
assert.equal(adderBackups.length,1,'Previous Full Adder version is backed up');
assert.equal(adderBackups[0].circuit.psuVoltage, originalValue);
assert.equal(adderBackups[0].circuit.parts.length, legacyAdder.circuit.parts.length);
assert.equal(upgradedAdder.name,'My customized Full Adder','User project naming survives');
assert.equal(migratedV8.projects.find(p=>p.id==='private-custom').name,'Do not modify');
assert.deepEqual(migratedV8.activity,legacy.activity);
assert.deepEqual(migratedV8.simRuns,legacy.simRuns);
const secondMigration = options.migrate({...migratedV8},8);
assert.equal(secondMigration.projects.filter(p=>p.name.includes('Backup — My customized Full Adder')).length,1,'Upgrade is idempotent');
const migratedV9 = options.migrate({projects:[{...fullAdderSeed, circuit:{...fullAdderSeed.circuit,boardId:'standard-830'}}]},9);
assert.equal(migratedV9.projects.find(p=>p.id==='full-adder').circuit.boardId,'extended-1400');
assert.equal(migratedV9.projects.filter(p=>p.name.includes('Backup —')).length,1);
console.log('Upgrade from saved v8/v9 Full Adder → extended board and display, original backed up: PASS');
console.log('Upgrade from saved v4/v5/v6/v7 projects → examples added, tidy layout migrated, custom projects preserved: PASS');
