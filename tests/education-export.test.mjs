import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import JSZip from 'jszip';
import {defaultEducation} from '../src/education/project.mjs';import {generateControl} from '../src/education/codegen.mjs';import {exportFusion} from '../src/education/exports.mjs';
test('Fusion package includes current parameter recipe/color and exact hardware source solids',async()=>{
 const c=defaultEducation();c.geometry={length:130,wheelDiameter:52,wheelWidth:14};c.wheelColor='#0057ff';
 const get=async path=>new Uint8Array(await fs.readFile(new URL('../public/education/'+path,import.meta.url)));
 const zip=await JSZip.loadAsync(await exportFusion(c,get,'uint8array'));
 const recipe=JSON.parse(await zip.file('EducationCar/recipe.json').async('string'));
 assert.equal(recipe.dimensions.wheelbase,92);assert.equal(recipe.wheelExtension.color,'#0057ff');assert.equal(recipe.parts.length,106);
 assert.equal(await zip.file('EducationCar/step/motor_left.step').async('string'),await fs.readFile(new URL('../public/education/step/motor_left.step',import.meta.url),'utf8'));
 assert.ok(zip.file('EducationCar/EducationCar.py'));assert.ok(zip.file('EducationCar/project.json'));assert.ok(zip.file('EducationCar/EducationCar.manifest'));
 await assert.rejects(()=>exportFusion({...c,schemaVersion:1},get,'uint8array'));
});
test('TB6612 template has separate PWM direction enable roles and geometry constants; unknown pins block compilation',()=>{
 const c=defaultEducation(),a=generateControl(c);assert.match(a['car_config.h'],/#error/);assert.match(a['car_config.h'],/WHEEL_DIAMETER_MM 40/);assert.match(a['car.c'],/LEDC_LOW_SPEED_MODE/);assert.match(a['car.c'],/PIN_STBY/);
 for(const [i,key]of ['PWMA','AIN1','AIN2','PWMB','BIN1','BIN2','STBY'].entries())c.pins[key]=i+1;
 c.geometry.wheelDiameter=46;const b=generateControl(c);assert.doesNotMatch(b['car_config.h'],/#error/);assert.match(b['car_config.h'],/WHEEL_DIAMETER_MM 46/);
 assert.match(b['car.c'],/xQueueOverwrite/);assert.match(b['car.c'],/WATCHDOG_MS/);assert.match(b['car.c'],/last_sign/);
});
