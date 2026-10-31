import * as T from 'three';
import {Brush,Evaluator,SUBTRACTION} from 'three-bvh-csg';
import {recipe} from './recipe.mjs';

export function roundedProfile(width,length,radius){const s=new T.Shape(),x=-width/2,y=-length/2,r=radius;s.moveTo(x+r,y);s.lineTo(x+width-r,y);s.absarc(x+width-r,y+r,r,-Math.PI/2,0,false);s.lineTo(x+width,y+length-r);s.absarc(x+width-r,y+length-r,r,0,Math.PI/2,false);s.lineTo(x+r,y+length);s.absarc(x+r,y+length-r,r,Math.PI/2,Math.PI,false);s.lineTo(x,y+r);s.absarc(x+r,y+r,r,Math.PI,Math.PI*1.5,false);return s;}
function hole(shape,x,y,r){const h=new T.Path();h.absarc(x,y,r,0,Math.PI*2,true);shape.holes.push(h);}
function extrude(shape,depth){const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32});g.computeVertexNormals();return g;}
function ring(ro,ri,width){const s=new T.Shape();s.absarc(0,0,ro,0,Math.PI*2,false);hole(s,0,0,ri);const g=extrude(s,width);g.translate(0,0,-width/2);g.rotateY(Math.PI/2);return g;}
export function createEducationAssembly(c,source){
 const r=recipe(c),assembly=new T.Group();assembly.name='education';assembly.userData={partCount:source.parts.length,recipe:r};
 const parts=new Map(r.parts.map(p=>[p.id,p])),wheels=new Map(r.wheels.map(p=>[p.id,p]));
 for(const row of source.parts){
  const p=parts.get(row.id),part=new T.Group();part.name=p.id;const wheel=wheels.get(p.id);
  part.userData={id:p.id,group:p.group,kind:wheel?'wheel':'part',side:p.id.endsWith('left')?'left':'right',motionGroup:p.motion_group,translation:p.translation,sourceSha256:row.source_sha256};
  const mat=new T.MeshStandardMaterial({color:p.color??new T.Color().setRGB(...row.color_rgb,T.SRGBColorSpace),roughness:row.category==='fastener'?.3:.64,metalness:['purchased','fastener'].includes(row.category)&&!['battery','pcb'].includes(p.id)?.32:.05});
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(row.positions,3));geom.setIndex(row.indices);geom.computeVertexNormals();const mesh=new T.Mesh(geom,mat);mesh.castShadow=true;mesh.receiveShadow=true;part.add(mesh);
  if(wheel){const baseline=source.wheels.find(w=>w.wheel_id===p.id).center_mm;part.position.set(wheel.center[0]-100,wheel.center[1]-100,wheel.center[2]);mesh.position.set(-baseline[0],-baseline[1],-baseline[2]);
   if(c.geometry.wheelDiameter!==40||c.geometry.wheelWidth!==10){const extension=new T.Mesh(ring(r.wheelExtension.outerRadius,r.wheelExtension.innerRadius,c.geometry.wheelWidth),mat);extension.position.x=(p.id.endsWith('left')?-1:1)*(c.geometry.wheelWidth-10)/2;extension.castShadow=true;extension.receiveShadow=true;part.add(extension);}
  }else{part.position.set(-100,-100+p.translation[1],p.translation[2]);}
  if(p.id==='chassis'&&c.geometry.length!==90){
   part.remove(mesh);geom.dispose();const ch=r.chassis,shape=roundedProfile(ch.width,ch.length,5);for(const h of ch.holes)hole(shape,h.x-100,h.y-100,h.r);
   const deckGeometry=extrude(shape,3);deckGeometry.translate(100,100,26);let brush=new Brush(deckGeometry,mat);brush.updateMatrixWorld();const evaluator=new Evaluator();evaluator.useGroups=false;evaluator.attributes=['position','normal'];
   const cut=geometry=>{const cutter=new Brush(geometry,mat);cutter.updateMatrixWorld();const next=evaluator.evaluate(brush,cutter,SUBTRACTION);brush.geometry.dispose();cutter.geometry.dispose();brush=next;brush.updateMatrixWorld();};
   for(const [x,y]of [[76,ch.frontY-4],[124,ch.frontY-4],...[68,132].flatMap(x=>[105,117].map(y=>[x,y+ch.rearDelta]))]){const hex=new T.Shape(),radius=4.2/(2*Math.cos(Math.PI/6));for(let i=0;i<6;i++){const xx=radius*Math.cos(i*Math.PI/3),yy=radius*Math.sin(i*Math.PI/3);if(i===0)hex.moveTo(xx,yy);else hex.lineTo(xx,yy);}hex.closePath();const g=extrude(hex,1.801);g.translate(x,y,25.999);cut(g);}
   for(const x of [64.8,132.8]){const g=new T.CylinderGeometry(7.3,7.3,2.4,64);g.rotateZ(Math.PI/2);g.translate(x+1.2,ch.frontY,20);cut(g);}
   const deck=new T.Mesh(brush.geometry,mat);part.add(deck);
   for(const b of ch.bosses){const boss=new T.Shape();boss.absarc(0,0,3,0,Math.PI*2,false);const lower=new T.Mesh(extrude(boss,2.3),mat);lower.position.set(b.x,b.y,29);part.add(lower);hole(boss,0,0,1.6);const upper=new T.Mesh(extrude(boss,3.2),mat);upper.position.set(b.x,b.y,31.3);part.add(upper);}
   part.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  }
  part.userData.basePosition=part.position.toArray();part.userData.explode=[p.group==='wheels'?(p.bbox_mm.min[0]<100?-22:22):0,p.group==='motor'?20:0,p.group==='display'?32:p.group==='pcb'?16:p.group==='battery'?-18:0];assembly.add(part);
 }
 return assembly;
}
export function disposeEducationAssembly(a){const materials=new Set();a.traverse(o=>{if(o.isMesh){o.geometry.dispose();materials.add(o.material);}});for(const m of materials)m.dispose();}
export function rotateWheelGroups(a,leftAngle,rightAngle){for(const p of a.children){if(!p.userData.motionGroup?.startsWith('wheel_'))continue;const w=a.userData.recipe.wheels.find(w=>w.group===p.userData.motionGroup);if(!w)continue;const angle=p.userData.motionGroup.endsWith('l')?leftAngle:rightAngle,center=new T.Vector3(w.center[0]-100,w.center[1]-100,w.center[2]);p.rotation.x=angle;p.position.fromArray(p.userData.basePosition).sub(center).applyAxisAngle(new T.Vector3(1,0,0),angle).add(center);}}
