/** Pure truth models for the *combinational* expansion chips.
 * Supply thresholds, voltage drivers and pin connectivity live in simulate.ts.
 * Sequential parts are deliberately not treated as combinational logic.
 */
export const EXPANSION_LOGIC_POWER: Record<string,{vcc:string;gnd:string}> = {
  'ic-74hc283': {vcc:'p16',gnd:'p8'},
  'ic-cd4511': {vcc:'p16',gnd:'p8'},
  'ic-74hc138': {vcc:'p16',gnd:'p8'},
};
const SEGMENTS: Record<number,string> = {
  0:'abcdef',1:'bc',2:'abdeg',3:'abcdg',4:'bcfg',5:'acdfg',6:'acdefg',7:'abc',8:'abcdefg',9:'abcdfg',
};
export function expansionLogicOutputs(id:string, high:(pin:string)=>boolean):Record<string,boolean> {
  if(id==='ic-74hc283') {
    const a=[5,3,14,12].reduce((v,p,i)=>v+(high(`p${p}`)?(1<<i):0),0);
    const b=[6,2,15,11].reduce((v,p,i)=>v+(high(`p${p}`)?(1<<i):0),0);
    const sum=a+b+Number(high('p7'));
    return Object.fromEntries([[4,0],[1,1],[13,2],[10,3],[9,4]].map(([pin,bit])=>[`p${pin}`,Boolean(sum & (1<<bit))]));
  }
  if(id==='ic-cd4511') {
    // LT / BI / LE are external active-low lamp test / blanking / latch.
    // LE is simplified transparent in the DC-only model (no latch memory).
    const digits=[7,1,2,6];
    const input=digits.reduce((v,p,i)=>v+(high(`p${p}`)?(1<<i):0),0);
    const active = high('p4'); // BI must be high to unblank.
    const lampTest = !high('p3');
    const on=active?(lampTest?'abcdefg':SEGMENTS[input]??''):'';
    return Object.fromEntries(([['a',13],['b',12],['c',11],['d',10],['e',9],['f',15],['g',14]] as const)
      .map(([seg,p])=>[`p${p}`,on.includes(seg)]));
  }
  if(id==='ic-74hc138') {
    // G1 high; /G2A and /G2B low. Outputs Y0..Y7 are active LOW.
    const enabled=high('p6')&&!high('p4')&&!high('p5');
    const code=Number(high('p1'))+2*Number(high('p2'))+4*Number(high('p3'));
    return Object.fromEntries([15,14,13,12,11,10,9,7].map((pin,i)=>[`p${pin}`,!(enabled && i===code)]));
  }
  return {};
}
