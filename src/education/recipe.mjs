import {data,dimensions,validateEducation} from './project.mjs';
export function region(id){if(/^(wheel_front|bearing_|spacer_|front_axle|shaft_collar|collar_|cap_|idler_)/.test(id))return 'front';if(/^(motor_|wheel_rear|drive_|display_|mosaico|screen_)/.test(id))return 'rear';return 'fixed';}
export function category(id){if(id==='chassis')return 'chassis';if(/mosaico|screen|display/.test(id))return 'display';if(/battery|tray/.test(id))return 'battery';if(/motor/.test(id))return 'motor';if(/pcb/.test(id))return 'pcb';return 'wheels';}
export function recipe(c){
 const errors=validateEducation(c);if(errors.length)throw Error(errors.join('\n'));
 const d=dimensions(c),delta=(c.geometry.length-90)/2;
 const parts=data.parts.map(p=>({...p,kind:'source',group:category(p.id),translation:[0,region(p.id)==='front'?-delta:region(p.id)==='rear'?delta:0,d.dz],outerRadius:p.id.startsWith('wheel_')?c.geometry.wheelDiameter/2:undefined,fixedHubRadius:p.id.startsWith('wheel_')?18.5:undefined,color:p.id.startsWith('wheel_')?c.wheelColor:undefined}));
 const wheels=data.wheels.map(w=>({id:w.wheel_id,group:w.group,center:[w.center_mm[0],w.center_mm[1]+(w.group.includes('f')?-delta:delta),d.axleZ],axis:[1,0,0]}));
 const holes=[];const hole=(x,y,r,z=26,h=3)=>holes.push({x,y,r,z,h});
 for(const x of [70,130])for(const y of [92,134])hole(x,y+delta,1.1);
 for(const x of [76,124]){for(const y of [66,82])hole(x,y-delta,1.1);hole(x,70-delta,1.1);}
 for(const x of [81.6,118.4])for(const y of [90,105])hole(x,y,1.1);
 for(const x of [68,132])for(const y of [105,117])hole(x,y+delta,1.1);
 for(const x of [74,126])for(const y of [61,141])hole(x,y+(y<100?-delta:delta),1.1);
 return {schema:'education-recipe/1',sourceSha256:data.manifestSha256,config:structuredClone(c),dimensions:d,parts,wheels,chassis:{length:c.geometry.length,width:70,radius:5,bottom:26,thickness:3,holes,bosses:[80.5,119.5].flatMap(x=>[75.5,114.5].map(y=>({x,y,r:3,bottom:29,height:5.5,bore:1.6,boreBottom:31.3}))),frontY:74-delta,rearDelta:delta},wheelExtension:{innerRadius:18.5,baseRadius:20,outerRadius:c.geometry.wheelDiameter/2,baseWidth:10,width:c.geometry.wheelWidth,widening:'outboard',color:c.wheelColor}};
}
