/**
 * Shared-state physical 2D breadboard editor.
 *
 * This is deliberately NOT the standalone schematic editor. It projects the
 * same breadboard holes, off-board controller headers, component footprints,
 * wires and simulation state that the 3D scene uses. Switching views never
 * serializes, duplicates or changes a circuit.
 */
import './breadboard-2d.css';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react';
import { BOARD, getAllHoles, holePosition, holeStrip, nearestHole } from '@/circuit/breadboard';
import { expansionById } from '@/circuit/expansion-catalog';
import { PhysicalModel2D } from './physical-models-2d';
import { controllerDimensionsForPart, controllerPosition, constrainBenchPoint, isControllerTool, isOffboardController } from '@/circuit/offboard-controllers';
import { terminalPosition } from '@/circuit/mcu-headers';
import { buildPreviewPart, useLab } from '@/store/lab';
import type { HoleId, PlacedPart, ToolId, Wire } from '@/circuit/types';

export type Physical2DDrop = { tool: ToolId; clientX: number; clientY: number };
export const PHYSICAL_2D_DROP_EVENT = 'electrolab:physical-2d-drop';
export const PHYSICAL_2D_DRAG_EVENT = 'electrolab:physical-2d-drag';
export const PHYSICAL_2D_DRAG_END_EVENT = 'electrolab:physical-2d-drag-end';

const PX = 76; // 0.2 breadboard units = 15.2 screen pixels
const HOLE = 3.45;
const COLORS: Record<string, string> = {
  black: '#202731', red: '#e84747', blue: '#2564d9', green: '#119e77',
  yellow: '#e2b223', orange: '#e96322', white: '#f7f8fb',
};
const labelStyle: CSSProperties = { userSelect: 'none', pointerEvents: 'none' };
type Point = { x: number; y: number };

function readableLabel(part: PlacedPart): string {
  if (part.props.label?.trim()) return part.props.label;
  if (part.kind === 'mcu') return 'Arduino Uno R3';
  if (part.kind === 'module') return expansionById(part.props.moduleId)?.name ?? 'Module';
  return part.kind.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function wirePath(wire: Wire, from: Point, to: Point, project: (x: number, z: number) => Point): string {
  if (wire.bends?.length && wire.bendAnchors?.a === wire.a && wire.bendAnchors?.b === wire.b) {
    return [from, ...wire.bends.map(p => project(p.x, p.z)), to].map((p, index) => `${index ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  }
  if (Math.abs(from.x - to.x) < 3 || Math.abs(from.y - to.y) < 3) return `M${from.x} ${from.y} L${to.x} ${to.y}`;
  // Route along a single orthogonal lane. Intersections without a dot have no
  // electrical junction, just as in the 3D graph.
  const middle = (from.y + to.y) / 2;
  return `M${from.x} ${from.y} L${from.x} ${middle} L${to.x} ${middle} L${to.x} ${to.y}`;
}

/** SVG model artwork is maintained in physical-models-2d.tsx. */
export function PhysicalBreadboard2D({ panMode = false }: { panMode?: boolean }) {
  const svgRef = useRef<SVGSVGElement|null>(null);
  const parts = useLab(s=>s.parts);
  const wires = useLab(s=>s.wires);
  const boardId = useLab(s=>s.boardId);
  const tool = useLab(s=>s.tool);
  const selectedId = useLab(s=>s.selectedId);
  const pendingHoles = useLab(s=>s.pendingHoles);
  const hoverHole = useLab(s=>s.hoverHole);
  const powerOn = useLab(s=>s.powerOn);
  const sim = useLab(s=>s.sim);
  const psuPositive = useLab(s=>s.psuPositive);
  const psuNegative = useLab(s=>s.psuNegative);
  const psuVoltage = useLab(s=>s.psuVoltage);
  const probeHole = useLab(s=>s.probeHole);
  const partDragEnabled = useLab(s=>s.partDragEnabled);
  const showWireFlow = useLab(s=>s.showWireFlow);
  const paletteDragging = useLab(s=>s.paletteDragging);
  const placementError = useLab(s=>s.placementError);
  const movingSelected = useLab(s=>s.movingSelected);
  const pinEditTarget = useLab(s=>s.pinEditTarget);

  // BOARD is mutable; subscribing to boardId guarantees recalculation.
  const metrics = useMemo(()=>{
    void boardId;
    const bw=BOARD.width*PX, bh=BOARD.depth*PX;
    const width=bw+590, height=bh+595;
    const origin={x:width/2+45, y:320+bh/2};
    return {bw,bh,width,height,origin};
  },[boardId]);
  const project = useCallback((x:number,z:number):Point=>({x:metrics.origin.x+x*PX,y:metrics.origin.y+z*PX}),[metrics]);
  const toWorld = useCallback((p:Point)=>({x:(p.x-metrics.origin.x)/PX,z:(p.y-metrics.origin.y)/PX}),[metrics]);
  const [view,setView] = useState(()=>({x:0,y:0,w:metrics.width,h:metrics.height}));
  useEffect(()=>{setView({x:0,y:0,w:metrics.width,h:metrics.height})},[metrics]);
  const [showGrid,setShowGrid] = useState(true);
  const [draggingPart,setDraggingPart] = useState<{id:string;pointer:number;start:Point;initial:{x:number;z:number};anchor:HoleId|null;bench:{x:number;z:number}|null; moved:boolean}|null>(null);
  const [pan,setPan] = useState<{pointer:number;client:{x:number;y:number};view:{x:number;y:number;w:number;h:number}}|null>(null);
  const [cursor,setCursor] = useState<Point|null>(null);
  const [previewBench,setPreviewBench] = useState<{x:number;z:number}|null>(null);
  const [externalDrag,setExternalDrag] = useState<{tool:ToolId;hole:HoleId|null;bench:{x:number;z:number}|null}|null>(null);

  const pointerToSvg = useCallback((clientX:number,clientY:number):Point|null=>{
    const svg=svgRef.current, ctm=svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p=svg.createSVGPoint();p.x=clientX;p.y=clientY;
    const result=p.matrixTransform(ctm.inverse());
    return {x:result.x,y:result.y};
  },[]);
  const pointInSvg=(clientX:number,clientY:number)=>{
    const rect=svgRef.current?.getBoundingClientRect();
    return Boolean(rect&&clientX>=rect.left&&clientX<=rect.right&&clientY>=rect.top&&clientY<=rect.bottom);
  };
  const nearest = useCallback((p:Point|null,maxDist=.12):HoleId|null=>{
    if (!p) return null;
    const w=toWorld(p);
    return nearestHole({x:w.x,y:BOARD.height,z:w.z},maxDist);
  },[toWorld,boardId]);
  const onZoom=useCallback((factor:number,anchor?:Point)=>{
    setView(v=>{
      const zoom=Math.max(.42,Math.min(3.5, metrics.width/v.w*factor));
      const newW=metrics.width/zoom,newH=metrics.height/zoom;
      const cx=anchor?.x??v.x+v.w/2,cy=anchor?.y??v.y+v.h/2;
      const rx=(cx-v.x)/v.w,ry=(cy-v.y)/v.h;
      return {x:cx-rx*newW,y:cy-ry*newH,w:newW,h:newH};
    });
  },[metrics]);
  const onWheel=(e:ReactWheelEvent<SVGSVGElement>)=>{e.preventDefault();const p=pointerToSvg(e.clientX,e.clientY);onZoom(Math.exp(-e.deltaY*.001),p??undefined)};
  const onStagePointerDown=(e:ReactPointerEvent<SVGSVGElement>)=>{
    if(e.button===1 || panMode || (e.button===0 && (tool==='none' || e.shiftKey))){
      const p=pointerToSvg(e.clientX,e.clientY);
      if(p){setPan({pointer:e.pointerId,client:{x:e.clientX,y:e.clientY},view});e.currentTarget.setPointerCapture(e.pointerId)}
      return;
    }
    if(e.button!==0) return;
    const p=pointerToSvg(e.clientX,e.clientY);
    if(p && tool==='select')useLab.getState().select(null);
    if(p && tool!=='select' && tool!=='wire' && tool!=='probe'){
      const hole=nearest(p,.15);
      if(hole)useLab.getState().clickHole(hole);
      else if(isControllerTool(tool)){
        const wp=toWorld(p);
        useLab.getState().placePartAt(tool,'F12',undefined,constrainBenchPoint(wp,tool==='mcu'?undefined:tool));
      }
    }
  };
  const onStageMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
    const p=pointerToSvg(e.clientX,e.clientY);
    if(tool==='wire' || draggingPart) setCursor(p);
    if(p && !pan && !draggingPart){
      const hole=nearest(p,.14);
      if(useLab.getState().hoverHole!==hole) useLab.getState().setHover(hole);
      if(isControllerTool(tool))setPreviewBench(constrainBenchPoint(toWorld(p),tool==='mcu'?undefined:tool));
      else if(previewBench)setPreviewBench(null);
    }
    if(pan&&e.pointerId===pan.pointer){
      const rect=svgRef.current?.getBoundingClientRect();
      if(rect){
        const pxPerUnit=Math.min(rect.width/pan.view.w,rect.height/pan.view.h);
        setView({...pan.view,x:pan.view.x-(e.clientX-pan.client.x)/pxPerUnit,y:pan.view.y-(e.clientY-pan.client.y)/pxPerUnit});
      }
    }
    if(draggingPart&&e.pointerId===draggingPart.pointer&&p){
      const delta={x:(p.x-draggingPart.start.x)/PX,z:(p.y-draggingPart.start.y)/PX};
      const projected={x:draggingPart.initial.x+delta.x,z:draggingPart.initial.z+delta.z};
      const part=parts.find(q=>q.id===draggingPart.id);
      const bench=part&&isOffboardController(part)?constrainBenchPoint(projected,part.props.moduleId):null;
      const anchor=bench?null:nearest(project(projected.x,projected.z),.38);
      setDraggingPart({...draggingPart,bench,anchor,moved:draggingPart.moved||Math.hypot(delta.x,delta.z)>.07});
      if(useLab.getState().hoverHole!==anchor)useLab.getState().setHover(anchor);
    }
  };
  const onStageUp=(e:ReactPointerEvent<SVGSVGElement>)=>{
    if (pan?.pointer===e.pointerId)setPan(null);
    if(draggingPart?.pointer===e.pointerId){
      if(draggingPart.moved){
        const part=parts.find(q=>q.id===draggingPart.id);
        if(part){
          useLab.getState().select(part.id);
          const anchor=draggingPart.anchor ?? part.props.headerAnchor ?? Object.values(part.pins).find(x=>/^[A-T]\d+$/.test(x)) ?? 'F12';
          if(draggingPart.bench || draggingPart.anchor)useLab.getState().moveSelectedTo(anchor,draggingPart.bench??undefined);
        }
      }
      setDraggingPart(null);
    }
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  useEffect(()=>{
    const onPaletteMove=(event:Event)=>{
      const detail=(event as CustomEvent<Physical2DDrop>).detail;
      if(!detail)return;
      if(!pointInSvg(detail.clientX,detail.clientY)){setExternalDrag(null);return;}
      const p=pointerToSvg(detail.clientX,detail.clientY);
      if(!p)return;
      const hole=nearest(p,.45);
      const controller=isControllerTool(detail.tool);
      const bench=controller?constrainBenchPoint(toWorld(p),detail.tool==='mcu'?undefined:detail.tool):null;
      setExternalDrag({tool:detail.tool,hole,bench});
      const target=controller?null:hole;
      if(useLab.getState().hoverHole!==target)useLab.getState().setHover(target);
    };
    const endDrag=()=>{setExternalDrag(null);setPreviewBench(null);};
    window.addEventListener(PHYSICAL_2D_DRAG_EVENT,onPaletteMove);
    window.addEventListener(PHYSICAL_2D_DRAG_END_EVENT,endDrag);
    return()=>{
      window.removeEventListener(PHYSICAL_2D_DRAG_EVENT,onPaletteMove);
      window.removeEventListener(PHYSICAL_2D_DRAG_END_EVENT,endDrag);
    };
  },[pointerToSvg,nearest,toWorld]);
  useEffect(()=>{
    const onDrop=(event:Event)=>{
      const detail=(event as CustomEvent<Physical2DDrop>).detail;
      if(!detail || !pointInSvg(detail.clientX,detail.clientY))return;
      const p=pointerToSvg(detail.clientX,detail.clientY);
      if(!p)return;
      const controller=isControllerTool(detail.tool);
      const hole=nearest(p,.45);
      const bench=controller?constrainBenchPoint(toWorld(p),detail.tool==='mcu'?undefined:detail.tool):undefined;
      if(hole||bench){useLab.getState().placePartAt(detail.tool,hole??'F12',undefined,bench);}
    };
    window.addEventListener(PHYSICAL_2D_DROP_EVENT,onDrop);
    return()=>window.removeEventListener(PHYSICAL_2D_DROP_EVENT,onDrop);
  },[pointerToSvg,nearest,toWorld]);
  useEffect(()=>{
    const onCamera=(e:Event)=>{
      const d=(e as CustomEvent<{type:string}>).detail;
      if(d?.type==='zoom-in')onZoom(1.25);
      if(d?.type==='zoom-out')onZoom(.8);
      if(d?.type==='reset-view'||d?.type==='focus-circuit')setView({x:0,y:0,w:metrics.width,h:metrics.height});
    };
    window.addEventListener('ece-lab-camera',onCamera);
    return()=>window.removeEventListener('ece-lab-camera',onCamera);
  },[onZoom,metrics]);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement)?.tagName||'') || (e.target as HTMLElement)?.isContentEditable)return;
      const state=useLab.getState();
      if((e.ctrlKey||e.metaKey)&&!e.altKey){
        if(e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)state.redo();else state.undo();return;}
        if(e.key.toLowerCase()==='y'){e.preventDefault();state.redo();return;}
        return;
      }
      if(e.altKey)return;
      const key=e.key.toLowerCase();
      if(key==='w'){state.setTool('wire');return;}
      if(key==='v'){state.setTool('select');return;}
      if(key==='r'&&state.selectedId){e.preventDefault();state.rotateSelected();return;}
      if(key==='delete'||key==='backspace'){if(state.selectedId){e.preventDefault();state.deleteSelected()}return;}
      if(key==='f'){setView({x:0,y:0,w:metrics.width,h:metrics.height});return;}
      if(key==='g'){setShowGrid(v=>!v);return;}
      if(key==='escape'){setDraggingPart(null);state.setHover(null);state.setTool('select')}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[metrics]);

  const projectedHoles=useMemo(()=>getAllHoles().map(id=>{
    const [x,,z]=holePosition(id);return{id,...project(x,z)};
  }),[boardId,project]);
  const terminal=useCallback((id:HoleId)=>{
    const [x,,z]=terminalPosition(id,parts);
    return Number.isFinite(x)&&Number.isFinite(z)?project(x,z):null;
  },[parts,project]);
  const partGeometry=useMemo(()=>parts.map(part=>{
    const offboard=isOffboardController(part);
    const pins=Object.entries(part.pins).map(([name,id])=>({name,id,point:terminal(id)})).filter((v):v is {name:string;id:string;point:Point}=>Boolean(v.point));
    const unique=Array.from(new Map(pins.map(p=>[p.id,p.point])).values());
    const center=offboard?project(controllerPosition(part).x,controllerPosition(part).z):unique.length?{x:unique.reduce((sum,p)=>sum+p.x,0)/unique.length,y:unique.reduce((sum,p)=>sum+p.y,0)/unique.length}:{x:0,y:0};
    return {part,pins,unique,center};
  }),[parts,project,terminal]);
  const pendingStart=pendingHoles[0] ? terminal(pendingHoles[0]) : null;
  const cursorHover=cursor&&pendingStart&&tool==='wire'?cursor:null;
  const selectedPart=parts.find(part=>part.id===selectedId);
  const bodyPreview=hoverHole && !['none','select','wire','delete','probe','psu-positive','psu-negative'].includes(tool) && !isControllerTool(tool) && (!paletteDragging || Boolean(externalDrag))
    ? buildPreviewPart(tool,hoverHole,{ledColor:useLab.getState().ledColor,resistorValue:useLab.getState().resistorValue,capacitorValue:useLab.getState().capacitorValue}) : null;
  const previewPins=bodyPreview?Object.values(bodyPreview.pins).map(id=>terminalPosition(id,parts)).filter(p=>Number.isFinite(p[0])).map(p=>project(p[0],p[2])):[];
  const previewCenter=previewPins.length?{x:previewPins.reduce((s,p)=>s+p.x,0)/previewPins.length,y:previewPins.reduce((s,p)=>s+p.y,0)/previewPins.length}:null;
  const getStroke=(w:Wire)=>COLORS[w.color]??'#2684d8';

  return <div className="physical-2d-editor absolute inset-0" aria-label="Interactive top-down 2D breadboard editor">
    <svg ref={svgRef} className="physical-2d-canvas" viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet" onWheel={onWheel} onPointerDown={onStagePointerDown} onPointerMove={onStageMove} onPointerUp={onStageUp} onPointerCancel={onStageUp} onPointerLeave={()=>{setCursor(null);if(!draggingPart)useLab.getState().setHover(null)}}>
      <defs>
        <pattern id="physical-2d-grid" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M18 0H0V18" fill="none" stroke="#c7d3de" strokeWidth=".65"/></pattern>
        <filter id="physical-2d-shadow" x="-10%" y="-10%" width="125%" height="130%"><feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#122d43" floodOpacity=".2"/></filter>
      </defs>
      <rect x="-1000" y="-1000" width={metrics.width+2000} height={metrics.height+2000} fill="#eef2f6"/>
      {showGrid&&<rect x="-1000" y="-1000" width={metrics.width+2000} height={metrics.height+2000} fill="url(#physical-2d-grid)"/>}
      {/* White physical breadboard with central gap and segmented colored rails. */}
      <rect x={metrics.origin.x-metrics.bw/2} y={metrics.origin.y-metrics.bh/2} width={metrics.bw} height={metrics.bh} rx="15" fill="#f9fafb" stroke="#ccd2d9" strokeWidth="3" filter="url(#physical-2d-shadow)" />
      <rect x={metrics.origin.x-metrics.bw/2+13} y={metrics.origin.y-metrics.bh/2+13} width={metrics.bw-26} height={metrics.bh-26} rx="5" fill="none" stroke="#dde1e7" strokeWidth="1" />
      {(boardId==='full-1660'?[-3.05,0,3.05]:[0]).map((z,i)=>{
        const y=project(0,z).y;
        return <g key={i}><rect x={metrics.origin.x-metrics.bw/2+17} y={y-18} width={metrics.bw-34} height="36" fill="#edf0f3" opacity=".6"/><line x1={metrics.origin.x-metrics.bw/2+17} x2={metrics.origin.x+metrics.bw/2-17} y1={y} y2={y} stroke="#d4d9df" strokeWidth="2"/></g>;
      })}
      {BOARD.hasRails&& (boardId==='full-1660'?['otp','otn','itp','itn','ibp','ibn','obp','obn']:['tp','tn','bp','bn']).map(prefix=>{
        const rail=project(0,holePosition(`${prefix}1`)[2]);
        const positive=prefix.endsWith('p');
        return <g key={prefix}>
          <line x1={metrics.origin.x-metrics.bw/2+14} x2={metrics.origin.x+metrics.bw/2-14} y1={rail.y+(positive?-12:12)} y2={rail.y+(positive?-12:12)} stroke={positive?'#e7464e':'#3478ce'} strokeWidth="3" />
          <text x={metrics.origin.x-metrics.bw/2+5} y={rail.y+4} fontSize="10" fill={positive?'#d2353f':'#275eab'} fontWeight="bold" textAnchor="middle" style={labelStyle}>{positive?'+':'−'}</text>
        </g>;
      })}
      {Array.from({length:BOARD.cols},(_,i)=>i+1).filter(col=>col===1||col%5===0).map(col=><text key={col} x={project(holePosition(`A${col}`)[0],0).x} y={project(0,boardId==='full-1660'?-4.9:-1.38).y} fontSize="9" textAnchor="middle" fill="#8893a0" style={labelStyle}>{col}</text>)}
      {(boardId==='full-1660'?'ABCDEFGHIJKLMNOPQRST':'ABCDEFGHIJ').split('').map(row=>{
        const p=project(holePosition(`${row}1`)[0],holePosition(`${row}1`)[2]);
        return <text key={row} x={metrics.origin.x-metrics.bw/2+14} y={p.y+3} fill="#768393" fontSize="10" textAnchor="middle" style={labelStyle}>{row}</text>;
      })}
      <text x={metrics.origin.x} y={metrics.origin.y+metrics.bh/2-17} fontSize="11" fill="#b5bcc5" textAnchor="middle" letterSpacing="3" style={labelStyle}>ELECTROLAB · SOLDERLESS BREADBOARD</text>
      {projectedHoles.map(p=><g key={p.id}>
        <circle cx={p.x} cy={p.y} r={HOLE+1.1} fill="#bfc8d1" opacity=".5"/>
        <circle cx={p.x} cy={p.y} r={HOLE} fill="#18232d" />
        <circle cx={p.x-.85} cy={p.y-.8} r=".86" fill="#7d8f9d" opacity=".65" />
        <circle cx={p.x} cy={p.y} r="7.8" fill="transparent" style={{cursor:'crosshair'}} aria-label={`Breadboard hole ${p.id}`} onPointerDown={e=>{
          if(e.button!==0||panMode||e.shiftKey)return;e.stopPropagation();
          if(tool==='select')useLab.getState().select(null); else useLab.getState().clickHole(p.id);
        }} onPointerEnter={()=>{if(useLab.getState().hoverHole!==p.id)useLab.getState().setHover(p.id)}} />
      </g>)}
      {/* The external bench PSU is projected alongside the breadboard. */}
      <g transform={`translate(${metrics.origin.x-metrics.bw/2-173},${metrics.origin.y-metrics.bh*.12})`}>
        <rect x="-88" y="-60" width="156" height="124" rx="11" fill="#dfe6ed" stroke="#7f94a4" strokeWidth="2"/>
        <rect x="-76" y="-45" width="127" height="75" rx="6" fill="#172738" stroke="#6b7f90"/>
        <rect x="-68" y="-37" width="115" height="33" rx="3" fill="#0a1520" />
        <text x="-11" y="-14" textAnchor="middle" fontFamily="monospace" fontSize="18" fontWeight="700" fill="#fa585e" style={labelStyle}>{powerOn?psuVoltage.toFixed(1):'OFF'}<tspan fontSize="10"> V</tspan></text>
        <circle cx="-49" cy="14" r="6.5" fill="#c32d31" stroke="#82151f" strokeWidth="2"/>
        <circle cx="22" cy="14" r="6.5" fill="#232a35" stroke="#121920" strokeWidth="2"/>
        <text x="-49" y="41" fontSize="10" textAnchor="middle" fill="#5e6978" style={labelStyle}>+</text><text x="22" y="41" fontSize="10" textAnchor="middle" fill="#5e6978" style={labelStyle}>−</text>
        <text x="-5" y="55" fontSize="11" textAnchor="middle" fill="#2d4b63" fontWeight="700" style={labelStyle}>DC POWER</text>
      </g>
      {[[psuPositive,'#e84747',-222],[psuNegative,'#202631',-151]].map(([id,color,x],i)=>{
        const end=typeof id==='string'?terminal(id):null;
                const sx=metrics.origin.x-metrics.bw/2+Number(x),sy=metrics.origin.y-metrics.bh*.12+14;
        return end?<path key={i} d={`M${sx} ${sy} C${sx+70} ${sy-70},${end.x-75} ${end.y-64},${end.x} ${end.y}`} stroke={String(color)} strokeWidth="4" strokeLinecap="round" fill="none"/>:null;
      })}
      {/* Component packages sit above the holes, as on a physical board. */}
      {partGeometry.map(({part,center,unique,pins})=>{
        const selected=part.id===selectedId;
        const offboard=isOffboardController(part);
        const lit=Boolean(sim.leds?.[part.id]?.on);
        return <g key={part.id}>
          {selected&&<rect x={center.x-(offboard?controllerDimensionsForPart(part).width*PX/2+9:54)} y={center.y-(offboard?controllerDimensionsForPart(part).depth*PX/2+9:40)} width={offboard?controllerDimensionsForPart(part).width*PX+18:108} height={offboard?controllerDimensionsForPart(part).depth*PX+18:80} rx="7" fill="none" stroke="#2998ff" strokeWidth="2.7" strokeDasharray="7 4" pointerEvents="none"/>}
          <g style={{cursor:tool==='wire'?'crosshair':partDragEnabled?'grab':'pointer'}} onDoubleClick={e=>{
            if(part.kind==='switch'||part.kind==='button'){
              e.stopPropagation();useLab.getState().select(part.id);
              useLab.getState().setSelectedProp('closed',!part.props.closed);
            }
          }} onPointerDown={e=>{
            if(e.button!==0||panMode||e.shiftKey)return;
            if(tool==='wire'||tool==='probe'||pinEditTarget)return;
            e.stopPropagation();useLab.getState().select(part.id);
            if(tool!=='select'&&tool!=='none')return;
            if(partDragEnabled){
              const p=pointerToSvg(e.clientX,e.clientY);if(!p)return;
              const anchor=offboard?controllerPosition(part):toWorld(unique[0]??center);
              setDraggingPart({id:part.id,pointer:e.pointerId,start:p,initial:anchor,anchor:null,bench:null,moved:false});
              e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
            }
          }}>
            <PhysicalModel2D part={part} center={center} pins={unique} selected={selected} lit={lit} segments={sim.sevenSegments?.[part.id]?.segments}/>
            {/* Larger transparent hit rectangle; no hover labels. */}
            <rect x={center.x-(offboard?controllerDimensionsForPart(part).width*PX/2:Math.max(13,Math.min(85,(Math.max(...unique.map(q=>q.x),center.x)-Math.min(...unique.map(q=>q.x),center.x))/2)))} y={center.y-(offboard?controllerDimensionsForPart(part).depth*PX/2:17)} width={offboard?controllerDimensionsForPart(part).width*PX:Math.max(26,Math.min(170,Math.max(...unique.map(q=>q.x),center.x)-Math.min(...unique.map(q=>q.x),center.x)))} height={offboard?controllerDimensionsForPart(part).depth*PX:34} rx="4" fill="transparent"/>
          </g>
          {Boolean(sim.burned?.[part.id]) && <g pointerEvents="none"><circle cx={center.x+18} cy={center.y-24} r="12" fill="#faecdd" stroke="#de4931" strokeWidth="2"/><text x={center.x+18} y={center.y-18} fontSize="18" fontWeight="bold" textAnchor="middle" fill="#d63e2e">!</text></g>}
          {/* Each visible pin targets its true shared electrical terminal ID. */}
          {pins.map(({name,id,point})=><g key={name}>
            <circle cx={point.x} cy={point.y} r={offboard?4.4:3.8} fill={offboard?'#d6b967':'#445d70'} stroke={offboard?'#162738':'#a7bfcc'} strokeWidth=".9"/>
            <circle cx={point.x} cy={point.y} r="8.2" fill="transparent" cursor="crosshair" aria-label={`${readableLabel(part)} pin ${name}`} onPointerEnter={()=>{if(useLab.getState().hoverHole!==id)useLab.getState().setHover(id)}} onPointerDown={e=>{
              if(e.button!==0||panMode||e.shiftKey)return;
              e.stopPropagation();
              if(tool==='wire'||tool==='probe'||pinEditTarget||movingSelected){useLab.getState().clickHole(id);return;}
              useLab.getState().select(part.id);
            }} />
            {selected&&<text x={point.x+6} y={point.y-8} fontSize="9" fill="#1c668d" style={labelStyle}>{name}</text>}
          </g>)}
        </g>;
      })}
      {/* Stored physical wires follow the same connection IDs as 3D. */}
      {wires.map(w=>{
        const a=terminal(w.a),b=terminal(w.b);if(!a||!b)return null;
        const path=wirePath(w,a,b,project),stroke=getStroke(w),selected=w.id===selectedId;
        return <g key={w.id}>
          <path d={path} fill="none" stroke="#233443" opacity=".22" strokeWidth={selected?10:7} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none"/>
          <path d={path} fill="none" stroke={stroke} strokeWidth={selected?5.5:4.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={w.style==='jumper'?'none':undefined} pointerEvents="none"/>
          {selected&&<path d={path} fill="none" stroke="#56c5ff" strokeWidth="1.3" strokeDasharray="6 7" pointerEvents="none"/>}
          {showWireFlow&&powerOn&&<path d={path} className="physical-2d-current" fill="none" stroke="#fff4a7" strokeWidth="1.6" opacity=".7" strokeDasharray="4 14" strokeLinecap="round" pointerEvents="none"/>}
          <path d={path} fill="none" stroke="transparent" strokeWidth="15" pointerEvents={tool==='wire' || tool==='probe' || Boolean(pinEditTarget) ? 'none' : undefined} cursor="pointer" onPointerDown={e=>{if(tool==='wire'||tool==='probe')return;e.stopPropagation();useLab.getState().select(w.id)}}/>
          <circle cx={a.x} cy={a.y} r="4.5" fill={stroke} stroke="#fbfcff" strokeWidth="1" pointerEvents="none"/>
          <circle cx={b.x} cy={b.y} r="4.5" fill={stroke} stroke="#fbfcff" strokeWidth="1" pointerEvents="none"/>
        </g>;
      })}
      {pendingStart&&<circle cx={pendingStart.x} cy={pendingStart.y} r="11" stroke="#168dfe" strokeWidth="2.8" fill="#8bd4ff" fillOpacity=".22" pointerEvents="none"/>}
      {pendingStart&&cursorHover&&<path d={`M${pendingStart.x} ${pendingStart.y} L${cursorHover.x} ${cursorHover.y}`} stroke={COLORS[useLab.getState().wireColor]} strokeWidth="3" strokeDasharray="7 5" opacity=".8" pointerEvents="none"/>}
      {hoverHole&&(()=>{const p=terminal(hoverHole);return p?<circle cx={p.x} cy={p.y} r="9" stroke="#23a5ff" strokeWidth="1.9" fill="#27a3ff" fillOpacity=".18" pointerEvents="none"/>:null})()}
      {previewCenter&&bodyPreview&&<g opacity=".5" pointerEvents="none"><PhysicalModel2D part={bodyPreview} center={previewCenter} pins={previewPins} lit={false} selected={false}/></g>}
      {(externalDrag?.bench??previewBench)&&isControllerTool(tool)&&(cursor||externalDrag)&&<rect x={project((externalDrag?.bench??previewBench)!.x,(externalDrag?.bench??previewBench)!.z).x-65} y={project((externalDrag?.bench??previewBench)!.x,(externalDrag?.bench??previewBench)!.z).y-34} width="130" height="68" rx="5" fill="#2686b8" fillOpacity=".18" stroke="#19a8e6" strokeDasharray="7 5" strokeWidth="2" pointerEvents="none"/>}
      {draggingPart?.moved&&draggingPart.anchor&&(()=>{const p=terminal(draggingPart.anchor);return p?<circle cx={p.x} cy={p.y} r="11" fill="none" stroke="#008fff" strokeWidth="3" pointerEvents="none"/>:null})()}
      {draggingPart?.moved&&draggingPart.bench&&<rect x={project(draggingPart.bench.x,draggingPart.bench.z).x-70} y={project(draggingPart.bench.x,draggingPart.bench.z).y-36} width="140" height="72" rx="7" fill="#48bfff" fillOpacity=".12" stroke="#1ba2fe" strokeWidth="2.5" strokeDasharray="7 4" pointerEvents="none"/>}
    </svg>
    <div className="physical-2d-toolbar" role="group" aria-label="2D canvas navigation">
      <span className="physical-2d-tag">2D · Physical layout</span>
      <button type="button" title="Zoom out" onClick={()=>onZoom(.8)}>−</button>
      <span className="physical-2d-zoom">{Math.round(metrics.width/view.w*100)}%</span>
      <button type="button" title="Zoom in" onClick={()=>onZoom(1.25)}>+</button>
      <button type="button" title="Fit full breadboard" onClick={()=>setView({x:0,y:0,w:metrics.width,h:metrics.height})}>Fit</button>
      <button type="button" title="Toggle snap grid" aria-pressed={showGrid} onClick={()=>setShowGrid(v=>!v)}>{showGrid?'Grid on':'Grid off'}</button>
    </div>
    <div className="physical-2d-hint" aria-live="polite">
      {paletteDragging?'Release to place component':tool==='wire'?pendingHoles.length?`Wire from ${pendingHoles[0]} · choose the destination terminal`:'Wire: click two holes or device pins':tool==='select'?'Click to select · drag to move · scroll to zoom':isControllerTool(tool)?'Click the desk area to place a controller':'Choose a breadboard hole to place the selected part'}
    </div>
    {placementError&&<div className="physical-2d-error" role="alert">{placementError}</div>}
    {(sim.shortCircuit || sim.supplyOverload || sim.sourceConflict)&&<div className="physical-2d-fault" role="alert">⚠ {sim.sourceConflict?'Conflicting power sources':sim.shortCircuit?'Short circuit detected':'Power supply overloaded'}</div>}
    {probeHole && <div className="physical-2d-probe"><strong>PROBE · {probeHole}</strong><span>{(sim.voltages[probeHole] ?? sim.stripVoltages?.[holeStrip(probeHole)] ?? 0).toFixed(2)} V</span><small>{((sim.nodeCurrents?.[probeHole]??0)*1e6).toFixed(1)} µA</small></div>}
    {selectedPart&&<span className="physical-2d-selection">Selected: {readableLabel(selectedPart)}</span>}
    {parts.length===0&&<div className="physical-2d-empty">Open <strong>Insert</strong> to place components and wire them directly in 2D.</div>}
  </div>;
}
