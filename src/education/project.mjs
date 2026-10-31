import data from './data.json' with {type:'json'};
export const SIGNALS=['PWMA','AIN1','AIN2','PWMB','BIN1','BIN2','STBY'];
export const FIELDS=[['length','底盘长度',90,150,1],['wheelDiameter','轮胎直径',40,60,1],['wheelWidth','轮胎宽度',10,16,.5]];
export function defaultEducation(){return {schemaVersion:2,model:'sophimotion-education-parametric',name:'教育版小车',geometry:{length:90,wheelDiameter:40,wheelWidth:10},wheelColor:'#fabc0b',pins:Object.fromEntries(SIGNALS.map(k=>[k,null])),prices:{},motion:{maxDuty:35,watchdogMs:400,outputRPM:150,leftSign:1,rightSign:1}};}
export function dimensions(c){const g=c.geometry,dz=(g.wheelDiameter-40)/2;return {wheelbase:g.length-38,hubTrack:86,wheelTrack:86+g.wheelWidth-10,axleZ:g.wheelDiameter/2,dz,totalWidth:Math.max(111,76+2*g.wheelWidth),totalLength:Math.max(g.length,g.length-38+g.wheelDiameter),boardTop:109+dz,deckBottom:26+dz,groundClearance:7.5+dz};}
export function validateEducation(c){
 if(!c||c.schemaVersion!==2||c.model!=='sophimotion-education-parametric')return ['配置不属于新版教育小车，旧版本不能直接套用。'];
 const e=[];if(typeof c.name!=='string'||!c.name.trim()||c.name.length>80)e.push('工程名称需要1–80个字符。');
 if(!c.geometry||!c.pins||!c.prices||!c.motion)return ['缺少几何、电气、价格或运动配置。'];
 for(const [k,n,min,max] of FIELDS)if(!Number.isFinite(c.geometry[k])||typeof c.geometry[k]!=='number'||c.geometry[k]<min||c.geometry[k]>max)e.push(`${n}应为 ${min}–${max} mm。`);
 if(typeof c.wheelColor!=='string'||!/^#[\da-f]{6}$/i.test(c.wheelColor))e.push('轮胎颜色需要六位十六进制色值。');
 if(c.geometry.length-38<c.geometry.wheelDiameter+6)e.push('前后轮间隙至少6 mm，请加长底盘或减小轮径。');
 const pins=SIGNALS.map(k=>c.pins[k]);if(pins.some(p=>p!==null&&(!Number.isInteger(p)||p<0||p>30)))e.push('GPIO需为空或0–30的整数，具体可用性按实际C6板核定。');
 const set=pins.filter(p=>p!==null);if(new Set(set).size!==set.length)e.push('已分配的GPIO不可重复。');
 for(const [k,min,max] of [['maxDuty',1,60],['watchdogMs',100,1000],['outputRPM',20,500]])if(!Number.isFinite(c.motion[k])||c.motion[k]<min||c.motion[k]>max)e.push(`${k}超出允许范围。`);
 for(const k of ['leftSign','rightSign'])if(![1,-1].includes(c.motion[k]))e.push('电机极性必须为1或−1。');
 if(typeof c.prices!=='object'||Array.isArray(c.prices)||Object.entries(c.prices).some(([k,v])=>!/^[-\w]+$/.test(k)||!(v===null||Number.isFinite(v)&&v>=0&&v<=100000)))e.push('BOM价格无效。');
 return e;
}
export function parseEducation(text){let c;try{c=JSON.parse(text);}catch{throw Error('不是有效JSON文件。');}const errors=validateEducation(c);if(errors.length)throw Error(errors.join('\n'));const fresh=defaultEducation();for(const key of Object.keys(fresh))fresh[key]=structuredClone(c[key]);return fresh;}
export function buildEducationBOM(c,count=1){
 const groups=new Map();for(const r of data.bom){if(Number(r.procurement_qty)<=0)continue;const key=r.preparation_item;let row=groups.get(key);if(!row){row={id:r.id,name:key,category:r.category,spec:r.spec,note:r.assembly_note,qty:0};groups.set(key,row);}row.qty+=Number(r.procurement_qty);}
 const rows=[...groups.values()].map(r=>{let spec=r.spec;if(r.id==='chassis')spec=`70 × ${c.geometry.length} × 3 mm，轴距 ${dimensions(c).wheelbase}`;if(r.id.startsWith('wheel_'))spec=`Ø${c.geometry.wheelDiameter} × ${c.geometry.wheelWidth} mm，固定原轮毂接口`;const price=c.prices[r.id]??null;return {...r,spec,qty:r.qty*count,price,subtotal:price===null?null:Math.round(price*100)*r.qty*count/100};});
 return {rows,totalKnown:rows.reduce((s,r)=>s+(r.subtotal??0),0),unknownCount:rows.filter(r=>r.price===null).length};
}
export function bomCSV(c,count=1){const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\uFEFF'+[['零件','类别','数量','规格','单价','小计','说明'],...buildEducationBOM(c,count).rows.map(r=>[r.name,r.category,r.qty,r.spec,r.price,r.subtotal,r.note])].map(r=>r.map(q).join(',')).join('\r\n');}
export function differential(c,linear,angular){const d=dimensions(c),rpm=v=>v*60000/(Math.PI*c.geometry.wheelDiameter);let l=rpm(linear-angular*d.wheelTrack/2000),r=rpm(linear+angular*d.wheelTrack/2000);const max=c.motion.outputRPM*c.motion.maxDuty/100,s=Math.max(1,Math.abs(l)/max,Math.abs(r)/max);l/=s;r/=s;return {leftRPM:l,rightRPM:r,linear:(l+r)*Math.PI*c.geometry.wheelDiameter/120000,angular:(r-l)*Math.PI*c.geometry.wheelDiameter/(60*d.wheelTrack),saturated:s>1};}
export {data};
