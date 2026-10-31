import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultEducation,validateEducation,parseEducation,dimensions,buildEducationBOM} from '../src/education/project.mjs';
import {recipe} from '../src/education/recipe.mjs';

test('education configuration rejects legacy, nonfinite, missing and unsafe wheel combinations',()=>{
 const c=defaultEducation();assert.deepEqual(validateEducation(c),[]);
 for(const bad of [{...c,schemaVersion:1},{...c,geometry:{...c.geometry,length:NaN}},{...c,geometry:{...c.geometry,wheelDiameter:60}},{...c,pins:null}])assert.ok(validateEducation(bad).length);
 assert.throws(()=>parseEducation('{"schemaVersion":1}'));
 assert.equal(parseEducation(JSON.stringify(c)).geometry.length,90);
});
test('stretch moves complete front/rear groups without scaling source interfaces and raises ground by radius',()=>{
 const a=defaultEducation(),b=structuredClone(a);b.geometry.length=130;b.geometry.wheelDiameter=52;b.geometry.wheelWidth=14;
 const ra=recipe(a),rb=recipe(b);assert.equal(dimensions(b).wheelbase,92);
 assert.equal(rb.wheels[0].center[1]-ra.wheels[0].center[1],-20);
 assert.equal(rb.wheels[2].center[1]-ra.wheels[2].center[1],20);
 assert.equal(rb.wheels[0].center[2],26);
 for(const id of ['motor_left','front_axle_left','bearing_outer_left_0']){
  const p=rb.parts.find(p=>p.id===id);assert.equal(p.kind,'source');assert.equal(p.scale,undefined);
 }
 const wheel=rb.parts.find(p=>p.id==='wheel_front_left');assert.equal(wheel.outerRadius,26);assert.equal(wheel.fixedHubRadius,18.5);
 assert.equal(rb.parts.find(p=>p.id==='pcb').translation[1],0);
 assert.equal(rb.parts.find(p=>p.id==='motor_left').translation[1],20);
});
test('BOM counts whole motors and bearings once and supports class quantities without assuming free unknown items',()=>{
 const c=defaultEducation(),b=buildEducationBOM(c,3);
 assert.equal(b.rows.find(r=>r.id==='motor_left').qty,6);
 assert.equal(b.rows.find(r=>r.id==='bearing_outer_left_0').qty,12);
 assert.ok(b.rows.every(r=>r.price===null));assert.ok(b.unknownCount>0);
 assert.ok(!b.rows.some(r=>/motor_shaft|bearing_inner/.test(r.id)));
});
