import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const data=JSON.parse(await readFile('public/education/model.json','utf8'));
assert.equal(data.parts.length,106);assert.equal(data.wheels.length,4);
for(const part of data.parts){const file=await readFile('public/education/step/'+part.id+'.step');assert.equal(createHash('sha256').update(file).digest('hex'),part.source_sha256,part.id);assert.equal(part.positions.length%3,0);assert.equal(part.indices.length%3,0);assert.ok(part.positions.every(Number.isFinite));assert.ok(part.indices.every(i=>Number.isInteger(i)&&i>=0&&i<part.positions.length/3));}
for(const name of ['fusion/EducationCar.py','fusion/EducationCar.manifest','fusion/README.md','brand/symbol.svg','source-reference.png','SophiMotion-educational-V5-baseline.f3d'])assert.ok((await readFile('public/education/'+name)).length>100,name);
console.log('106 exact source STEP hashes, mesh topology indices and required educational export assets verified.');
