import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {createEducationAssembly,disposeEducationAssembly,rotateWheelGroups} from '../src/education/Assembly.mjs';import {defaultEducation,data} from '../src/education/project.mjs';
const source=JSON.parse(fs.readFileSync(new URL('../public/education/model.json',import.meta.url)));
test('default Three.js geometry is a direct copy of every actual source CAD part',()=>{
 const c=defaultEducation(),a=createEducationAssembly(c,source);
 assert.equal(a.userData.partCount,106);assert.equal(a.children.filter(o=>o.userData.kind==='wheel').length,4);
 for(const row of source.parts){const part=a.getObjectByName(row.id),mesh=part.children[0];assert.ok(part,row.id);assert.equal(mesh.geometry.attributes.position.count,row.positions.length/3);for(let i=0;i<row.positions.length;i++)assert.ok(Math.abs(mesh.geometry.attributes.position.array[i]-row.positions[i])<.0001);}
 disposeEducationAssembly(a);
});
test('source hardware stays the same size, variable wheels retain their exact source hub',()=>{
 const c=defaultEducation(),a=createEducationAssembly(c,source);c.geometry={length:130,wheelDiameter:52,wheelWidth:14};const b=createEducationAssembly(c,source);
 for(const id of ['motor_left','front_axle_left','bearing_outer_left_0']){const aa=new T.Box3().setFromObject(a.getObjectByName(id)).getSize(new T.Vector3()),bb=new T.Box3().setFromObject(b.getObjectByName(id)).getSize(new T.Vector3());assert.ok(aa.distanceTo(bb)<.001,id);}
 const wheel=b.getObjectByName('wheel_front_left');assert.equal(wheel.children[0].geometry.attributes.position.count,source.parts.find(p=>p.id==='wheel_front_left').positions.length/3);assert.ok(wheel.children.length>1);
 const bounds=new T.Box3().setFromObject(wheel);assert.ok(Math.abs(bounds.min.z)<.03);assert.ok(Math.abs(bounds.max.z-52)<.03);
 disposeEducationAssembly(a);disposeEducationAssembly(b);
});
test('wheel preview rotates shaft and outer bearing races with their assigned wheel, while inner races stay fixed',()=>{
 const a=createEducationAssembly(defaultEducation(),source);rotateWheelGroups(a,.5,-.7);
 assert.equal(a.getObjectByName('motor_shaft_left').rotation.x,.5);
 assert.equal(a.getObjectByName('bearing_outer_left_0').rotation.x,.5);
 assert.equal(a.getObjectByName('bearing_inner_left_0').rotation.x,0);
 assert.equal(a.getObjectByName('motor_left').rotation.x,0);disposeEducationAssembly(a);
});
