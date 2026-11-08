import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { PlacedPart, SimResult } from '@/circuit/types';
import { BOARD, holePosition } from '@/circuit/breadboard';
import { expansionById } from '@/circuit/expansion-catalog';
import { useLab } from '@/store/lab';
import { Html } from '@react-three/drei';
import { controllerDimensions, controllerDimensionsForPart, controllerPosition, controllerBodyY, modulePinLocal, isOffboardController } from '@/circuit/offboard-controllers';
import { terminalPosition } from '@/circuit/mcu-headers';
import { useState } from 'react';

const metallic = '#b2bec9';
const black = '#171c25';

/** Baked canvas ink uses local textures: no CDN fonts/assets and no overlay
 * that can block the physical mesh when the student clicks a part. */
function Mark({text, position, width=0.7, height=0.18, ink='#eff7ff'}:{text:string;position:[number,number,number];width?:number;height?:number;ink?:string}) {
  const texture = useMemo(() => {
    const cv = document.createElement('canvas');cv.width=768;cv.height=144;
    const c=cv.getContext('2d')!;c.clearRect(0,0,768,144);
    c.font='bold 65px Arial, sans-serif'; c.textAlign='center';c.textBaseline='middle';c.fillStyle=ink;
    c.fillText(text,384,72,710);
    const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=8;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t;
  },[text,ink]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={position} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
    <planeGeometry args={[width,height]}/>
    <meshBasicMaterial map={texture} transparent depthWrite={false} side={THREE.DoubleSide}/>
  </mesh>;
}
/** A mechanically exposed header that is easy to hit in 3D.
 * The vertical plated lead still goes into its original breadboard hole;
 * only its *visual* socket height differs between breakout boards and DIPs.
 */
function Pin({position,hole,name,raised=false,activePin=false}:{position:[number,number,number];hole:string;name:string;raised?:boolean;activePin?:boolean}) {
  const [hovered,setHovered]=useState(false);
  const top = raised ? BOARD.height + .225 : BOARD.height + .075;
  const stem = Math.max(.055, top - position[1]);
  return <group position={[position[0],top,position[2]]}
    onPointerDown={event=>{
      if(event.button!==0)return;
      const lab=useLab.getState();
      if(lab.tool!=='wire' && lab.tool!=='probe' && !lab.pinEditTarget)return;
      event.stopPropagation();lab.clickHole(hole);
    }}
    onPointerOver={event=>{
      if(!['wire','probe','select'].includes(useLab.getState().tool))return;
      event.stopPropagation();setHovered(true);useLab.getState().setHover(hole);
    }}
    onPointerOut={event=>{
      event.stopPropagation();setHovered(false);useLab.getState().setHover(null);
    }}>
    {/* A small low-profile hit target follows the socket, not the buried leg. */}
    <mesh position={[0,.008,0]}>
      <cylinderGeometry args={[.075,.075,.07,12]}/>
      <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>
    <mesh position={[0,-stem/2,0]} raycast={()=>null} castShadow>
      <cylinderGeometry args={[.014,.014,stem,10]}/>
      <meshStandardMaterial color="#9faab5" metalness={.88} roughness={.24}/>
    </mesh>
    <mesh position={[0,-.023,0]} castShadow>
      <boxGeometry args={[.10,.078,.10]}/>
      <meshStandardMaterial color={raised?'#14191e':'#252a31'} roughness={.68} metalness={.03}/>
    </mesh>
    <mesh position={[0,.02,0]} raycast={() => null}>
      <cylinderGeometry args={[.046,.046,.012,16]}/>
      <meshStandardMaterial color={hovered?'#65cbe6':'#c9a65c'} metalness={.91} roughness={.22}/>
    </mesh>
    <mesh position={[0,.027,0]} raycast={() => null}>
      <cylinderGeometry args={[.025,.025,.012,16]}/>
      <meshStandardMaterial color="#0a1017" roughness={.93}/>
    </mesh>
    {activePin && <Html center position={[0,.26,0]} distanceFactor={7}
      style={{pointerEvents:'none',userSelect:'none',whiteSpace:'nowrap',padding:'4px 7px',borderRadius:5,background:'rgba(7,22,35,.95)',color:'#d9f6ff',fontSize:11,fontWeight:800,border:'1px solid #338ea8'}}>
      {name.toUpperCase()}
    </Html>}
  </group>;
}

/** Subtle plated vias, solder-mask traces and pad rings stamped into the PCB.
 * These are part of the 3D surface and cannot intercept wiring clicks.
 */
let sharedBoardManufacturingMap: THREE.CanvasTexture | null = null;
function BoardManufacturingPrint({w,d}:{w:number;d:number}) {
  const texture=useMemo(()=>{
    // Every module reuses the exact same GPU artwork: no 4MB texture per PCB.
    if (sharedBoardManufacturingMap) return sharedBoardManufacturingMap;
    const cv=document.createElement('canvas');cv.width=1024;cv.height=1024;
    const ctx=cv.getContext('2d');if(!ctx)return null;
    let seed=8101;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
    ctx.lineCap='round';ctx.lineJoin='round';
    for(let i=0;i<46;i++){
      const x=70+random()*890,y=70+random()*890;
      const l=20+random()*135;
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+l*.6,y);
      ctx.lineTo(x+l*.6,y+(i%2?1:-1)*l*.34);
      ctx.strokeStyle='rgba(133,197,206,.24)';ctx.lineWidth=1.5+random();ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,2.8,0,Math.PI*2);
      ctx.strokeStyle='rgba(232,190,95,.64)';ctx.lineWidth=2;ctx.stroke();
    }
    ctx.strokeStyle='rgba(235,248,248,.36)';ctx.lineWidth=3;
    ctx.strokeRect(25,25,974,974);
    for(let i=0;i<18;i++){
      const x=65+random()*890,y=65+random()*890;
      ctx.strokeStyle='rgba(238,245,251,.26)';ctx.lineWidth=1.5;
      ctx.strokeRect(x,y,15+random()*46,8+random()*30);
    }
    const image=new THREE.CanvasTexture(cv);image.colorSpace=THREE.SRGBColorSpace;image.anisotropy=4;
    sharedBoardManufacturingMap=image;
    return image;
  },[]);
  if(!texture)return null;
  return <mesh position={[0,.049,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
    <planeGeometry args={[w*.96,d*.96]}/>
    <meshBasicMaterial map={texture} transparent opacity={.74} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/>
  </mesh>;
}
function MainBoard({w,d,shade,selected}:{w:number;d:number;shade:string;selected:boolean}) {
  return <>
    <mesh castShadow receiveShadow position={[0,0,0]}><boxGeometry args={[w,0.09,d]}/><meshPhysicalMaterial color={selected?'#316b95':shade} metalness={0.08} roughness={0.48} clearcoat={.24} clearcoatRoughness={.4}/></mesh>
    <BoardManufacturingPrint w={w} d={d}/>
    {[-1,1].flatMap(x=>[-1,1].map(z=><mesh key={`foot-${x}-${z}`} castShadow position={[x*(w/2-.13),-.075,z*(d/2-.13)]}>
      <cylinderGeometry args={[.055,.060,.070,12]}/><meshStandardMaterial color="#202428" roughness={.89}/>
    </mesh>))}
    {[-1,1].flatMap(x=>[-1,1].map(z=><mesh key={`${x}-${z}`} position={[x*(w/2-0.09),0.052,z*(d/2-0.09)]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[0.034,0.008,8,16]}/><meshStandardMaterial color="#a9b9ba" metalness={0.78} roughness={0.35}/>
    </mesh>))}
  </>;
}
function Chip({x=0,z=0,w=0.28,d=0.22,label}:{x?:number;z?:number;w?:number;d?:number;label?:string}) {
  return <group position={[x,0.095,z]}>
    <mesh castShadow><boxGeometry args={[w,0.12,d]}/><meshStandardMaterial color={black} roughness={0.64} metalness={0.07}/></mesh>
    {Array.from({length:4},(_,i)=><group key={i}>
      {[-1,1].map(k=><mesh key={k} position={[(i-1.5)*w/5,-0.01,k*(d/2+0.016)]}>
        <boxGeometry args={[0.025,0.03,0.08]}/><meshStandardMaterial color="#b1b5b8" metalness={0.82} roughness={0.26}/>
      </mesh>)}
    </group>)}
    {label && <Mark text={label} position={[0,0.066,0]} width={Math.min(w*0.92,0.5)} height={0.09}/>}
  </group>;
}
function Disk({x=0,z=0,rad=0.18,shade='#d8dee5'}:{x?:number;z?:number;rad?:number;shade?:string}) {
  return <mesh position={[x,0.13,z]} rotation={[0,0,0]} castShadow><cylinderGeometry args={[rad,rad,0.14,28]}/><meshStandardMaterial color={shade} roughness={0.42} metalness={0.56}/></mesh>;
}
/**
 * A real four-digit seven-segment LED package, not four short bar graphs on
 * a generic PCB. The 12 pins are placed by the normal DIP footprint, with six
 * leads on each side of the breadboard channel. The red light-pipes are left
 * unlit until a multiplexing simulation is implemented; the current catalog
 * entry intentionally remains an electrical prototype.
 */
const FOUR_DIGIT_BAR_GEOMETRY = (() => {
  // Chamfer both ends of the molded LED segment. The same geometry is rotated
  // to make the horizontal and vertical strokes of every digit.
  const shape = new THREE.Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(-0.42, 0.10);
  shape.lineTo(0.42, 0.10);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.42, -0.10);
  shape.lineTo(-0.42, -0.10);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
})();

/** Clockwise physical a, b, c, d, e, f, g locations for each digit. */
const FOUR_DIGIT_SEGMENTS: ReadonlyArray<{name:string; x:number; z:number; vertical?:boolean}> = [
  {name:'a', x:0, z:-0.44},
  {name:'b', x:0.35, z:-0.22, vertical:true},
  {name:'c', x:0.35, z:0.22, vertical:true},
  {name:'d', x:0, z:0.44},
  {name:'e', x:-0.35, z:0.22, vertical:true},
  {name:'f', x:-0.35, z:-0.22, vertical:true},
  {name:'g', x:0, z:0},
];

function FourDigitDisplayPackage({w,d,selected}:{w:number;d:number;selected:boolean}) {
  // Keep the body over the DIP-12 pin footprint; all four characters should
  // fill the front glass, with plausible spacing and molded rim proportions.
  const width=Math.max(1.18,w), depth=.56;
  const glassW=width*.925,glassD=depth*.83;
  const gap=glassW*.038;
  const digitW=(glassW-gap*3)/4;
  const digitH=glassD*.78;
  const barThickness=Math.min(digitW*.12,digitH*.068);
  const horizLength=digitW*.64;
  const vertLength=digitH*.40;
  const offMaterial={color:'#622020',emissive:'#240605',emissiveIntensity:0.035,roughness:.58};
  return <group>
    {/* Black epoxy body with a subtle chamfered-looking bezel. No blue PCB. */}
    <mesh castShadow receiveShadow>
      <boxGeometry args={[width,.22,depth]}/>
      <meshPhysicalMaterial color={selected?'#26384a':'#12161b'} roughness={.59} metalness={.04} clearcoat={.16} clearcoatRoughness={.57}/>
    </mesh>
    <mesh position={[0,.116,0]} raycast={()=>null}>
      <boxGeometry args={[width*.969,.017,depth*.938]}/>
      <meshStandardMaterial color="#29262a" metalness={.08} roughness={.49}/>
    </mesh>
    {/* Four-digit dark red filtered lens, visibly inset into the housing. */}
    <mesh position={[0,.127,0]} raycast={()=>null}>
      <boxGeometry args={[glassW,.013,glassD]}/>
      <meshPhysicalMaterial color="#260909" metalness={.04} roughness={.25} clearcoat={.66} clearcoatRoughness={.18}/>
    </mesh>
    {Array.from({length:4},(_,digit)=>{
      const centerX=(digit-1.5)*(digitW+gap);
      return <group key={`digit-${digit+1}`} position={[centerX,.137,0]}>
        {/* Each of the four digits has seven genuine a-g segments. */}
        {FOUR_DIGIT_SEGMENTS.map(seg=><group key={seg.name}
          position={[seg.x*digitW,0,seg.z*digitH]}
          rotation={[0,seg.vertical?Math.PI/2:0,0]}>
          <mesh geometry={FOUR_DIGIT_BAR_GEOMETRY}
            rotation={[-Math.PI/2,0,0]}
            scale={[seg.vertical?vertLength:horizLength,barThickness/.2,1]}
            raycast={()=>null}>
            <meshStandardMaterial {...offMaterial} side={THREE.DoubleSide}/>
          </mesh>
        </group>)}
        {/* Independent decimal point below and to the right of each digit. */}
        <mesh position={[digitW*.42,.002,digitH*.44]}
          rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
          <circleGeometry args={[Math.min(digitW*.065,.018),16]}/>
          <meshStandardMaterial {...offMaterial} side={THREE.DoubleSide}/>
        </mesh>
      </group>;
    })}
    {/* Fine topmost lens glaze gives the same smoked glass look as real LED modules. */}
    <mesh position={[0,.142,0]} rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
      <planeGeometry args={[glassW,glassD]}/>
      <meshPhysicalMaterial color="#5d1717" transparent opacity={.13}
        depthWrite={false} roughness={.22} metalness={0} clearcoat={.6} side={THREE.DoubleSide}/>
    </mesh>
  </group>;
}

function Body({specId,w,d,selected,sim,part}:{specId:string;w:number;d:number;selected:boolean;sim:SimResult;part:PlacedPart}) {
  const spec=expansionById(specId)!;
  const halfW=w/2,halfD=d/2;
  const shade=spec.color ?? (spec.shape==='microcontroller'?'#075a95':'#17578a');
  if (spec.shape==='dip') return <>
    <mesh castShadow receiveShadow><boxGeometry args={[w,0.22,Math.min(d,0.73)]}/><meshStandardMaterial color={selected?'#304256':'#171a20'} roughness={0.72}/></mesh>
    <mesh position={[-halfW+0.09,0.117,0]} rotation={[-Math.PI/2,0,0]}>
      <circleGeometry args={[0.037,20,0,Math.PI]}/><meshStandardMaterial color="#8994a6" roughness={0.55}/>
    </mesh>
    <Mark text={spec.name.split(' ·')[0].replace('IC ','')} position={[0,0.119,0]} width={Math.min(w*0.87,1.4)} height={0.16}/>
  </>;
  if(spec.shape==='microcontroller') return <>
    {/* Color-accurate PCB, mounting eyelets and satin solder mask. */}
    <MainBoard w={w} d={d} shade={shade} selected={selected}/>
    {/* Plated through-hole female headers. Socket openings share exact coordinates
        with the connection/raycast geometry and move with the board. */}
    {[-1,1].map(side=><group key={side} position={[0,.085,side*(halfD-.105)]}>
      <mesh castShadow><boxGeometry args={[w*.92,.135,.145]}/>
        <meshPhysicalMaterial color="#101316" roughness={.64} metalness={.04} clearcoat={.06}/></mesh>
    </group>)}
    {spec.pins.map(pin=>{
      const p=modulePinLocal(part,pin);
      if(!p)return null;
      return <group key={`socket-${pin}`} position={[p[0],.155,p[2]]}>
        <mesh><cylinderGeometry args={[.036,.036,.008,12]}/>
          <meshStandardMaterial color="#c3a66a" metalness={.89} roughness={.20}/></mesh>
        <mesh position={[0,.006,0]}><cylinderGeometry args={[.020,.020,.010,12]}/>
          <meshStandardMaterial color="#12171d" roughness={.82}/></mesh>
      </group>;
    })}
    {/* Silkscreen labels are printed on PCB texture, never over clickable sockets. */}
    <Mark text={spec.id==='board-esp32'?'ESP32 DevKit':spec.id==='board-pico'?'Raspberry Pi Pico':spec.id==='board-mega'?'MEGA 2560':'Arduino Nano'}
      position={[0,.052,halfD*.62]} width={Math.min(w*.75,1.7)} height={.12}/>
    <Chip x={-w*.08} z={0.0} w={Math.min(.65,w*.27)} d={Math.min(.43,d*.34)}
      label={spec.id==='board-pico'?'RP2040':spec.id==='board-esp32'?'ESP32-WROOM':spec.id==='board-mega'?'ATmega2560':'ATmega328P'}/>
    {/* USB metal shell, tongue and visible port opening. */}
    <group position={[halfW-.065,.125,0]}>
      <mesh castShadow><boxGeometry args={[.30,.19,.33]}/>
        <meshStandardMaterial color="#bac3cb" metalness={.81} roughness={.23}/></mesh>
      <mesh position={[.158,0,0]}><boxGeometry args={[.009,.115,.235]}/>
        <meshStandardMaterial color="#1b2027" roughness={.52}/></mesh>
      <mesh position={[.164,-.025,0]}><boxGeometry args={[.012,.018,.16]}/>
        <meshStandardMaterial color="#d3a95c" metalness={.9} roughness={.19}/></mesh>
    </group>
    {/* ESP32 metal RF shielding and antenna keep its identity distinct from Pico / Nano. */}
    {spec.id==='board-esp32' && <>
      <mesh position={[-w*.21,.138,0]} castShadow><boxGeometry args={[.53,.16,.46]}/>
        <meshStandardMaterial color="#adb3b9" metalness={.74} roughness={.28}/></mesh>
      <Mark text="ESP32" position={[-w*.21,.224,0]} width={.36} height={.11} ink="#19212b"/>
      {Array.from({length:4},(_,i)=><mesh key={i} position={[-halfW+.11+i*.085,.055,-halfD+.30]}>
        <boxGeometry args={[.038,.009,.18]}/><meshStandardMaterial color="#d5ad5e" metalness={.82}/>
      </mesh>)}
    </>}
    {/* Ceramic oscillator, capacitors and readable power indicator. */}
    {[-1,1].map(side=><group key={side} position={[-w*.30,.085,side*d*.20]}>
      <mesh castShadow><boxGeometry args={[.15,.055,.09]}/>
        <meshStandardMaterial color="#abb6bf" metalness={.6} roughness={.32}/></mesh>
      <mesh position={[.16,.006,0]}><boxGeometry args={[.09,.045,.058]}/>
        <meshStandardMaterial color="#373b41" roughness={.55}/></mesh>
    </group>)}
    <mesh position={[halfW-.35,.075,-halfD+.23]}>
      <sphereGeometry args={[.027,12,12]}/><meshStandardMaterial color="#58c976" emissive="#17884b" emissiveIntensity={.7}/>
    </mesh>
  </>;
  if(spec.shape==='sensor') return <>
    <MainBoard w={w} d={d} shade={spec.id==='sensor-dht22'?'#d4ddd9':shade} selected={selected}/>
    {spec.id==='sensor-hcsr04' ? [-1,1].map(side=><group key={side} position={[side*w*0.23,0.14,0]}>
      <mesh castShadow><cylinderGeometry args={[.18,.18,.23,36]}/><meshStandardMaterial color="#b9bec5" metalness={.81} roughness={.27}/></mesh>
      <mesh position={[0,.119,0]}><cylinderGeometry args={[.148,.148,.013,36]}/><meshStandardMaterial color="#87929a" metalness={.61} roughness={.32}/></mesh>
      <mesh position={[0,.128,0]}><cylinderGeometry args={[.112,.112,.017,36]}/><meshStandardMaterial color="#343d45" roughness={.85} metalness={.14}/></mesh>
      <mesh position={[0,.141,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.141,.013,8,36]}/><meshStandardMaterial color="#d0d5d9" roughness={.23} metalness={.87}/></mesh>
    </group>) : spec.id==='sensor-pir' ? <group>
      <mesh position={[0,.22,0]} castShadow><sphereGeometry args={[.24,32,18,0,Math.PI*2,0,Math.PI/2]}/><meshPhysicalMaterial color="#eeeede" roughness={.52} metalness={0} transmission={.035}/></mesh>
      {[.10,.15,.20].map((r,i)=><mesh key={r} position={[0,.22+(.24*.92)*(1-i*.22),0]} rotation={[-Math.PI/2,0,0]} raycast={() => null}>
        <torusGeometry args={[r,.006,5,32]}/><meshStandardMaterial color="#c8c9b8" transparent opacity={.48} roughness={.7}/>
      </mesh>)}
    </group> : spec.id==='sensor-dht22' ? <>
      <mesh position={[0,0.14,0]} castShadow><boxGeometry args={[w*0.56,0.22,d*0.8]}/><meshStandardMaterial color="#e6e8df" roughness={0.8}/></mesh>
      {Array.from({length:7},(_,i)=><mesh key={i} position={[(i-3)*Math.min(w*.075,.075),0.255,0]}><boxGeometry args={[.022,.01,d*.58]}/><meshStandardMaterial color="#788b91" roughness={.8}/></mesh>)}
      <Mark text="DHT22" position={[0,.262,-d*.34]} width={Math.min(w*.52,.58)} height={.11} ink="#33424e"/>
    </> : spec.id==='sensor-ir' ? [-1,1].map(k=><Disk key={k} x={k*0.15} rad={0.09} shade={k===1?'#15181d':'#d8e0e3'}/>) : <Chip label={spec.id==='sensor-mpu6050'?'MPU6050':spec.id==='sensor-hall'?'HALL':'SENSOR'}/>}
    {spec.id !== 'sensor-dht22' && <Mark text={spec.name.split(' ')[0]} position={[0,0.052,-halfD+0.12]} width={Math.min(w*0.88,0.8)} height={0.12}/>}
  </>;
  if(spec.shape==='keypad') return <>
    <MainBoard w={w} d={d} shade="#344557" selected={selected}/>
    {Array.from({length:16},(_,i)=>{
      const col=i%4,row=Math.floor(i/4);return <group key={i} position={[(col-1.5)*(w*.21),0.11,(row-1.5)*(d*.22)]}>
        <mesh castShadow><boxGeometry args={[w*.17,0.11,d*.18]}/><meshStandardMaterial color="#cfd5dc" roughness={0.57}/></mesh>
        <Mark text={'123A456B789C*0#D'[i]} position={[0,0.063,0]} width={w*.12} height={0.13} ink="#202934"/>
      </group>
    })}
  </>;
  if(spec.shape==='encoder') return <>
    <MainBoard w={w} d={d} shade={shade} selected={selected}/><Disk rad={0.25}/>
    <mesh position={[0,0.36,0]} castShadow><cylinderGeometry args={[0.085,0.085,0.33,16]}/><meshStandardMaterial color="#a5b7c5" metalness={0.78} roughness={0.25}/></mesh>
    <mesh position={[0,0.53,0]}><cylinderGeometry args={[0.13,0.13,0.06,28]}/><meshStandardMaterial color="#4b6073" roughness={0.7}/></mesh>
  </>;
  if(spec.shape==='matrix') return <>
    <MainBoard w={w} d={d} shade={shade} selected={selected}/>
    <mesh position={[0,0.085,0]}><boxGeometry args={[w*.82,0.12,d*.79]}/><meshStandardMaterial color="#15171c" roughness={0.44}/></mesh>
    {Array.from({length:64},(_,i)=><mesh key={i} position={[(i%8-3.5)*w*.09,0.15,(Math.floor(i/8)-3.5)*d*.086]}>
      <sphereGeometry args={[Math.min(w*.036,0.07),7,7]}/><meshStandardMaterial color="#6c1414" emissive="#ef2e2e" emissiveIntensity={0.15} roughness={0.45}/>
    </mesh>)}
    {spec.id==='display-max7219'&&<Chip x={0} z={d*.34} w={0.25} d={0.13}/>}
  </>;
  if(spec.id==='display-4digit') return <FourDigitDisplayPackage w={w} d={d} selected={selected}/>;
  if(spec.id==='display-ledbar') return <>
    <MainBoard w={w} d={d} shade="#252c36" selected={selected}/>
    {Array.from({length:10},(_,i)=><mesh key={i} position={[(i-4.5)*w*.084,0.12,0]}>
      <boxGeometry args={[w*.06,0.03,d*.40]}/><meshStandardMaterial color={i<5?'#b53328':'#39693b'} emissive={i<5?'#ef401a':'#43aa53'} emissiveIntensity={0.15}/>
    </mesh>)}
  </>;
  if(spec.shape==='driver') return <>
    <MainBoard w={w} d={d} shade={spec.id==='driver-l298n'?'#af2632':shade} selected={selected}/>
    <Chip w={0.49} d={0.34} label={spec.id==='driver-l298n'?'L298N':'ULN2003'}/>
    {spec.id==='driver-l298n' && <group position={[0,0.25,0]}>
      <mesh><boxGeometry args={[0.49,0.33,0.13]}/><meshStandardMaterial color="#a6afb9" metalness={0.8} roughness={0.24}/></mesh>
      {[-.17,-.08,0,.08,.17].map(x=><mesh key={x} position={[x,0,0]}><boxGeometry args={[0.024,0.33,0.21]}/><meshStandardMaterial color="#697785" metalness={0.65}/></mesh>)}
    </group>}
    {[-1,1].map(k=><group key={k} position={[k*(halfW-0.17),.12,0]}>
      <mesh castShadow><boxGeometry args={[.22,.20,.33]}/><meshStandardMaterial color="#0b6a91" roughness={.56}/></mesh>
      {[-1,0,1].map(i=><mesh key={i} position={[0,.111,i*.09]} rotation={[-Math.PI/2,0,0]}>
        <cylinderGeometry args={[.032,.032,.009,12]}/><meshStandardMaterial color="#a5b2bc" metalness={.88} roughness={.25}/></mesh>)}
    </group>)}
  </>;
  if(spec.shape==='motor') return <>
    <MainBoard w={w} d={d} shade={spec.id==='motor-28byj48'?'#d5d9e0':'#555f69'} selected={selected}/>
    {spec.id==='motor-28byj48' ? <>
      <mesh castShadow position={[0,.19,0]}><cylinderGeometry args={[.29,.29,.22,40]}/><meshStandardMaterial color="#d4dadd" roughness={.63} metalness={.15}/></mesh>
      <mesh castShadow position={[0,.305,0]}><cylinderGeometry args={[.235,.235,.036,40]}/><meshStandardMaterial color="#a1aeb9" roughness={.35} metalness={.55}/></mesh>
      {[-1,1].map(v=><mesh key={v} position={[v*.21,.329,.10]} rotation={[-Math.PI/2,0,0]}>
        <torusGeometry args={[.027,.012,6,14]}/><meshStandardMaterial color="#6b7783" metalness={.74}/>
      </mesh>)}
      <mesh castShadow position={[0,.46,0]}><cylinderGeometry args={[.055,.055,.27,20]}/><meshStandardMaterial color="#bdcbd4" roughness={.24} metalness={.9}/></mesh>
      <Mark text="28BYJ-48" position={[0,.348,-.08]} width={Math.min(.43,w*.58)} height={.11} ink="#233345"/>
      <mesh position={[-halfW+.18,.10,0]}><boxGeometry args={[.27,.15,.17]}/><meshStandardMaterial color="#faf6e7" roughness={.72}/></mesh>
    </> : <>
      <mesh castShadow position={[0,.19,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.22,.22,Math.max(.44,w*.6),32]}/><meshStandardMaterial color="#788696" roughness={.32} metalness={.73}/></mesh>
      <mesh castShadow position={[w*.29,.19,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.095,.095,.18,18]}/><meshStandardMaterial color="#c0c8d1" roughness={.23} metalness={.83}/></mesh>
      <mesh position={[0,.19,.224]}><boxGeometry args={[w*.34,.045,.028]}/><meshStandardMaterial color="#c2a46c" metalness={.79}/></mesh>
    </>}
  </>;
  if(spec.shape==='power') return <>
    <MainBoard w={w} d={d} shade={spec.id==='power-bridge'?'#353940':'#125a82'} selected={selected}/>
    {spec.id==='power-battery'?<>
      <mesh position={[0,.095,0]} castShadow><boxGeometry args={[w*.78,.18,d*.62]}/><meshStandardMaterial color="#151a20" roughness={.82}/></mesh>
      <mesh position={[0,.235,0]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.18,.18,Math.max(.45,w*.62),32]}/><meshPhysicalMaterial color="#276a51" roughness={.48} metalness={.15} clearcoat={.22}/></mesh>
      {[-1,1].map(side=><group key={side} position={[side*w*.32,.235,0]}>
        <mesh rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.14,.14,.025,24]}/><meshStandardMaterial color="#b8c0c8" metalness={.86} roughness={.29}/></mesh>
        <mesh position={[side*.024,0,0]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.062,.062,.025,16]}/><meshStandardMaterial color="#d2d7da" metalness={.88} roughness={.25}/></mesh>
      </group>)}
      <Mark text="18650 Li-ion" position={[0,.42,0]} width={Math.min(w*.53,.8)} height={.12} ink="#e8f3ef"/>
    </> : spec.id==='power-tp4056'? <>
      <Chip label="TP4056"/><mesh position={[halfW-.14,.13,0]}><boxGeometry args={[.2,.13,.2]}/><meshStandardMaterial color="#afb8c1" metalness={.74}/></mesh>
    </> : spec.id==='power-bridge'? <Chip label="BRIDGE" w={.48} d={.36}/> : <>
      <mesh castShadow position={[-w*.13,.16,0]}><torusGeometry args={[.20,.10,12,28]}/><meshStandardMaterial color="#b58b35" metalness={.72} roughness={.4}/></mesh>
      <Disk x={w*.22} rad={.16} shade="#343b44"/>
      <Chip x={w*.05} z={d*.24} w={.35} d={.18}/>
    </>}
    <Mark text={spec.name.split(' ·')[0]} position={[0,.052,-halfD+.13]} width={Math.min(.9,w*.78)} height={.12}/>
  </>;
  // Bench instruments are screen-and-dial shaped, with real DC readings where
  // supported (no invented waveform animation / frequency readings).
  if(spec.shape==='instrument') {
    const pin = part.pins[spec.id==='instrument-meter'?'v':spec.id==='instrument-scope'?'ch1':spec.id==='instrument-logic'?'d0':'in'];
    const ref = part.pins[spec.id==='instrument-meter'?'com':'gnd'];
    const volts=(sim.voltages[pin]??0)-(sim.voltages[ref]??0);
    const caption=spec.behavior==='dc-probe' ? (spec.id==='instrument-logic'?(volts>=2.5?'HIGH':'LOW'):`${volts.toFixed(2)} V`):'READY';
    return <>
      <mesh position={[0,.055,0]} castShadow receiveShadow><boxGeometry args={[w,.26,d]}/><meshPhysicalMaterial color={selected?'#334657':'#242b35'} roughness={.66} metalness={.19} clearcoat={.12}/></mesh>
      <mesh position={[0,.196,d*.07]} castShadow><boxGeometry args={[w*.76,.025,d*.64]}/><meshStandardMaterial color="#070f19" roughness={.17} metalness={.17}/></mesh>
      <mesh position={[0,.212,d*.07]} raycast={() => null}><boxGeometry args={[w*.70,.004,d*.55]}/><meshStandardMaterial color="#092d34" metalness={.21} roughness={.27} emissive="#06252c" emissiveIntensity={.2}/></mesh>
      <Mark text={caption} position={[0,.22,d*.06]} width={w*.62} height={Math.min(.22,d*.32)} ink="#92f0cf"/>
      {[-1,1].map(k=><group key={k} position={[k*w*.36,.213,-d*.37]}>
        <mesh><cylinderGeometry args={[.076,.076,.06,20]}/><meshStandardMaterial color="#707a87" metalness={.64} roughness={.34}/></mesh>
        <mesh position={[0,.032,0]}><cylinderGeometry args={[.047,.047,.015,20]}/><meshStandardMaterial color="#252b32" roughness={.69}/></mesh>
      </group>)}
      <Mark text={spec.name.split(' (')[0]} position={[0,.195,-halfD+.07]} width={Math.min(.78,w*.7)} height={.10}/>
    </>;
  }
  return <><MainBoard w={w} d={d} shade={shade} selected={selected}/><Chip label="IC"/></>;
}

/** A visible female socket. An explicitly selected wire endpoint may
 * display its name; mere pointer hover never creates floating text. */
function ControllerSocket({part,pinName,position,activePin=false}:{part:PlacedPart;pinName:string;position:[number,number,number];activePin?:boolean}) {
  const [hovered,setHovered]=useState(false);
  const id=part.pins[pinName];
  return <group position={position}
    onPointerOver={event=>{event.stopPropagation();setHovered(true);useLab.getState().setHover(id);}}
    onPointerOut={event=>{event.stopPropagation();setHovered(false);useLab.getState().setHover(null);}}
    onPointerDown={event=>{
      const lab=useLab.getState();
      if(event.button!==0 || !['wire','probe'].includes(lab.tool))return;
      event.stopPropagation();lab.clickHole(id);
    }}>
    <mesh position={[0,-.022,0]}>
      <boxGeometry args={[.11,.13,.115]}/>
      <meshBasicMaterial transparent opacity={0} depthWrite={false}/>
    </mesh>
    <mesh position={[0,-.04,0]}>
      <cylinderGeometry args={[.034,.034,.016,14]}/>
      <meshStandardMaterial color={hovered?'#26c9e8':'#c5a96e'} metalness={.84} roughness={.23}/>
    </mesh>
    <mesh position={[0,-.028,0]}>
      <cylinderGeometry args={[.019,.019,.012,12]}/>
      <meshStandardMaterial color="#111820" roughness={.78}/>
    </mesh>
    {activePin && <Html center position={[0,.17,0]} distanceFactor={7}
      style={{pointerEvents:'none',whiteSpace:'nowrap',userSelect:'none',borderRadius:5,padding:'4px 6px',fontSize:10,fontWeight:800,color:'#e5faff',background:'rgba(6,20,35,.93)',border:'1px solid #2caccd'}}>{pinName.toUpperCase()}</Html>}
  </group>;
}

/** Existing breadboard parts use metal leads in holes; controller PCBs are separate
 * bench objects and use their own 3D socket terminals to connect jumpers. */
export function ExpansionPartMesh({part,selected,sim,showSelectedLabel=true}:{part:PlacedPart;selected:boolean;sim:SimResult;showSelectedLabel?:boolean}) {
  const spec=expansionById(part.props.moduleId);
  const selectedWireEndpoint=useLab((s)=>s.pendingHoles[0] ?? null);
  if(!spec)return null;
  const isController=isOffboardController(part);
  if(isController) {
    const pos=controllerPosition(part);
    const {width,depth}=controllerDimensionsForPart(part);
    return <group>
      <group position={[pos.x,controllerBodyY,pos.z]}>
        <Body specId={spec.id} w={width} d={depth} selected={selected} sim={sim} part={part}/>
      </group>
      {selected && showSelectedLabel && <Html center position={[pos.x,controllerBodyY+.39,pos.z]} distanceFactor={8}
        style={{pointerEvents:'none',userSelect:'none',whiteSpace:'nowrap',padding:'5px 8px',borderRadius:6,background:'rgba(8,19,34,.93)',color:'#e0f2fe',border:'1px solid #3b82f6',fontSize:11,fontWeight:750}}>{part.props.label || spec.name}</Html>}
      {spec.pins.map(pinName=>{
        const position=terminalPosition(part.pins[pinName], [part]);
        if (!position.every(Number.isFinite))return null;
        return <ControllerSocket key={pinName} part={part} pinName={pinName} position={position} activePin={selectedWireEndpoint===part.pins[pinName]}/>;
      })}
    </group>;
  }
  const pinEntries=Object.entries(part.pins).map(([name,hole])=>({name,hole,position:holePosition(hole)}));
  const physicalPins=pinEntries.map(({position})=>position);
  if(!physicalPins.length)return null;
  const minX=Math.min(...physicalPins.map(p=>p[0])),maxX=Math.max(...physicalPins.map(p=>p[0]));
  const minZ=Math.min(...physicalPins.map(p=>p[2])),maxZ=Math.max(...physicalPins.map(p=>p[2]));
  const centerX=(minX+maxX)/2,centerZ=(minZ+maxZ)/2;
  const w=Math.max(0.77,maxX-minX+.40),d=Math.max(spec.footprint==='dip'?.64:0.75,maxZ-minZ+.35);
  const bodyHeight=BOARD.height + (spec.shape==='instrument' ? .24:.17);
  return <group onClick={ev=>{
    if(useLab.getState().tool !== 'select') return;
    ev.stopPropagation();
    useLab.getState().select(part.id);
  }}>
    {pinEntries.map(({name,hole,position})=><Pin key={`${name}:${hole}`} name={name} hole={hole} position={position} raised={spec.footprint!=='dip'} activePin={selectedWireEndpoint===hole}/>)}
    <group position={[centerX,bodyHeight,centerZ]}>
      <Body specId={spec.id} w={w} d={d} selected={selected} sim={sim} part={part}/>
    </group>
    {selected && showSelectedLabel && <Html center position={[centerX,bodyHeight+.32,centerZ]} distanceFactor={8}
      style={{pointerEvents:'none',userSelect:'none',whiteSpace:'nowrap',padding:'5px 8px',borderRadius:6,background:'rgba(8,19,34,.93)',color:'#e0f2fe',border:'1px solid #3b82f6',fontSize:11,fontWeight:750}}>{part.props.label || spec.name}</Html>}
  </group>;
}
