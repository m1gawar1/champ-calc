// statSolve のロジックを合成データで往復検証（実ファイルの式と同一実装で確認）
const LEVEL = 50;
const spToEv = sp => sp * 8;
const calcHp = (base, iv, sp) => Math.floor(((2*base+iv+Math.floor(spToEv(sp)/4))*LEVEL)/100 + LEVEL + 10);
const calcStat = (base, iv, sp, m) => Math.floor(Math.floor(((2*base+iv+Math.floor(spToEv(sp)/4))*LEVEL)/100 + 5) * m);

const NON_HP = ['atk','def','spa','spd','spe'];

function solveStat(base, reading) {
  const mults=[1.0,1.1,0.9];
  const hit=mults.filter(m=>calcStat(base,31,reading.sp,m)===reading.value);
  if(hit.length===1) return {sp:reading.sp,mult:hit[0],ok:true};
  if(hit.length>1) return {sp:reading.sp,mult:hit.includes(1.0)?1.0:hit[0],ok:true};
  const cands=[];
  for(let sp=0;sp<=32;sp++) for(const m of mults) if(calcStat(base,31,sp,m)===reading.value) cands.push({sp,mult:m});
  if(!cands.length) return {sp:reading.sp,mult:1.0,ok:false};
  cands.sort((a,b)=>{const da=Math.abs(a.sp-reading.sp),db=Math.abs(b.sp-reading.sp);if(da!==db)return da-db;return (a.mult===1?0:1)-(b.mult===1?0:1);});
  return {sp:cands[0].sp,mult:cands[0].mult,ok:true};
}

// テストケース: 任意の種族値・SP・性格を選び、実数値を生成→逆算が一致するか
const base={hp:74,atk:65,def:67,spa:125,spd:128,spe:92}; // フラエッテ近似
const cases=[
  {name:'特攻↑素早↓', sp:{hp:14,atk:0,def:0,spa:20,spd:0,spe:32}, inc:'spa', dec:'spe'},
  {name:'無補正',     sp:{hp:4,atk:8,def:0,spa:12,spd:4,spe:6},   inc:null,  dec:null},
  {name:'素早↑攻↓',   sp:{hp:0,atk:0,def:8,spa:0,spd:0,spe:32},   inc:'spe', dec:'atk'},
];

let pass=0, fail=0;
for(const c of cases){
  // 実数値を生成
  const readings={};
  readings.hp={value:calcHp(base.hp,31,c.sp.hp), sp:c.sp.hp};
  for(const k of NON_HP){
    const m = c.inc===k?1.1 : c.dec===k?0.9 : 1.0;
    readings[k]={value:calcStat(base[k],31,c.sp[k],m), sp:c.sp[k]};
  }
  // 逆算（SP正常ケース）
  const mults={};
  const solvedSp={};
  for(const k of NON_HP){const r=solveStat(base[k],readings[k]);mults[k]=r.mult;solvedSp[k]=r.sp;}
  const incs=NON_HP.filter(k=>mults[k]>1.0);
  const decs=NON_HP.filter(k=>mults[k]<1.0);
  const incOk = (c.inc===null && incs.length===0) || (incs.length===1 && incs[0]===c.inc);
  const decOk = (c.dec===null && decs.length===0) || (decs.length===1 && decs[0]===c.dec);
  const spOk = NON_HP.every(k=>solvedSp[k]===c.sp[k]);
  const ok = incOk && decOk && spOk;
  console.log(`[${ok?'OK':'NG'}] ${c.name}  inc=${incs}(期待${c.inc}) dec=${decs}(期待${c.dec}) spOk=${spOk}`);
  ok?pass++:fail++;

  // SP誤読ケース: spa の SP を +3 ずらして読んだ場合でも実数値から復元できるか
  if(c.inc==='spa'){
    const r2=solveStat(base.spa,{value:readings.spa.value, sp:c.sp.spa+3});
    console.log(`   SP誤読復元: 読SP=${c.sp.spa+3} → 復元SP=${r2.sp}(期待${c.sp.spa}) mult=${r2.mult}`);
  }
}
console.log(`\n結果: ${pass} pass / ${fail} fail`);
