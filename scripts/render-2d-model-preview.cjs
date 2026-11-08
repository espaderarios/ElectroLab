/** Generate a contact sheet from the actual ElectroLab SVG React model renderer. */
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const React=require('react');const {renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
function load(filename,deps={}){
 const src=fs.readFileSync(path.join(root,filename),'utf8');const output=ts.transpileModule(src,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
 const m={exports:{}};new Function('require','module','exports',output)(id=>id in deps?deps[id]:require(id),m,m.exports);return m.exports;
}
const catalog=load('src/circuit/expansion-catalog.ts');
const library=load('src/circuit-lab/physical-models-2d.tsx',{'@/circuit/expansion-catalog':catalog,'@/circuit/offboard-controllers':{
 isOffboardController:p=>p.kind==='mcu'||/^board-(nano|mega|esp32|pico)$/.test(p.props.moduleId??''),
 controllerDimensionsForPart:()=>({width:2.72,depth:2.12}),
}});
const base=['resistor','led','diode','zener','capacitor','inductor','fuse','ldr','thermistor','rgb-led','button','switch','pot','motor','servo','speaker','buzzer','relay','transistor','mosfet','opamp','timer555','optocoupler','regulator','seven-segment','lcd','oled','mcu'];
const parts=[...base.map(kind=>({label:kind.replaceAll('-',' ').toUpperCase(),kind,props:{}})),...catalog.EXPANSION_COMPONENTS.map(x=>({label:x.name,kind:'module',props:{moduleId:x.id}}))];
const cellW=205,cellH=173,cols=6,rows=Math.ceil(parts.length/cols),W=cols*cellW,H=rows*cellH+40;
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const cards=parts.map((spec,i)=>{
 const x=(i%cols)*cellW,y=Math.floor(i/cols)*cellH+30;
 const part={id:'preview-'+i,kind:spec.kind,props:spec.props,pins:{}};
 const allPins=Array.from({length:30},(_,j)=>({x:(j%15-7)*11,y:j<15?-52:52}));
 const markup=renderToStaticMarkup(React.createElement(library.PhysicalModel2D,{part,center:{x:0,y:0},pins:allPins,selected:false,lit:false}));
 return `<g transform="translate(${x} ${y})"><rect x="5" y="3" width="195" height="164" rx="11" fill="#ffffff" stroke="#d6e2ed"/>
 <g transform="translate(103 73) scale(.67)">${markup}</g><text x="103" y="154" font-family="Arial,sans-serif" font-size="11" font-weight="bold" text-anchor="middle" fill="#24384b">${esc(spec.label.slice(0,31))}</text></g>`;
});
const out=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#eff3f7"/><text x="18" y="23" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#18324c">ElectroLab · Physical 2D Model Library (${parts.length} illustrated families)</text>${cards.join('')}</svg>`;
fs.writeFileSync(process.argv[2]??path.join(root,'2D_MODEL_PREVIEW.svg'),out);
console.log(`Rendered ${parts.length} physical models`);
