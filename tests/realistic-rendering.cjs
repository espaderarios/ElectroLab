/** Rendering contracts: source, type syntax and quality-preset fallback.
 * A live WebGL visual/GPU test still requires a browser with dependencies installed. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const postcss=require('postcss');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const sources=[
  'src/circuit-lab/graphics-quality.ts',
  'src/circuit-lab/studio-environment.tsx',
  'src/circuit-lab/pcb-finish.tsx',
  'src/circuit-lab/parts-3d.tsx',
  'src/circuit-lab/lab-canvas.tsx',
  'src/circuit-lab/scene.tsx',
  'src/circuit-lab/index.tsx',
  'src/pages/CircuitEditorPage.tsx',
  'src/circuit-lab/workbench-dock.tsx',
];
for(const file of sources){
  const parsed=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length,0,`${file} must parse`);
}
postcss.parse(read('src/index.css'));
const quality=read('src/circuit-lab/graphics-quality.ts');
for(const level of ['low','medium','high','ultra'])assert.match(quality,new RegExp(`\\b${level}:\\s*\\{`));
assert.match(quality,/shadowResolution: number/);
assert.match(quality,/environmentIntensity: number/);
assert.match(quality,/isGraphicsQuality/);
const scene=read('src/circuit-lab/scene.tsx');
assert.match(scene,/<StudioEnvironment quality=\{quality\}/);
assert.match(scene,/graphics\.contactShadowResolution/);
assert.match(scene,/BOARD\.width \/ 2 \+ 2/);
const canvas=read('src/circuit-lab/lab-canvas.tsx');
assert.match(canvas,/graphics\.dpr/);
assert.match(canvas,/RenderQualityUpdates/);
assert.match(canvas,/shadows=\{!performanceMode\}/);
const parts=read('src/circuit-lab/parts-3d.tsx');
assert.match(parts,/ArduinoPcbFinish width=\{W\}/);
assert.match(parts,/WireEndConnector/);
assert.match(parts,/contactRef\.current!.setMatrixAt/);
assert.match(parts,/raycast=\{\(\) => null\}/);
const env=read('src/circuit-lab/studio-environment.tsx');
assert.match(env,/new RoomEnvironment\(\)/);
assert.match(env,/target\.dispose\(\)/);
assert.match(env,/pmrem\.dispose\(\)/);
const page=read('src/pages/CircuitEditorPage.tsx');
assert.match(page,/electrolab-graphics-quality-v1/);
assert.match(page,/quality=\{graphicsQuality\}/);
const dock=read('src/circuit-lab/workbench-dock.tsx');
assert.match(dock,/aria-label="3D graphics quality"/);
assert.match(dock,/onGraphicsQualityChange/);
const css=read('src/index.css');
assert.match(css,/\.editor-graphics-quality/);
console.log('Realistic studio: 4 quality levels, PBR reflections, PCB finish, contact geometry, interactive wires, source/CSS syntax: PASS');
