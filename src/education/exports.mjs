import JSZip from 'jszip';
import {recipe} from './recipe.mjs';
import {bomCSV} from './project.mjs';
import {generateControl} from './codegen.mjs';
export function download(name,data,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
export async function exportFusion(c,get,type='blob'){
 const r=recipe(c),zip=new JSZip();
 const fetchFile=get??(async path=>{const response=await fetch(import.meta.env.BASE_URL+'education/'+path);if(!response.ok)throw Error('缺少文件 '+path);return new Uint8Array(await response.arrayBuffer());});
 const dir=zip.folder('EducationCar');dir.file('project.json',JSON.stringify(c,null,2));dir.file('recipe.json',JSON.stringify(r,null,2));dir.file('BOM.csv',bomCSV(c));
 const paths=['fusion/EducationCar.py','fusion/EducationCar.manifest','fusion/README.md',...r.parts.map(p=>'step/'+p.id+'.step')];
 // Bounded concurrency avoids issuing a hundred parallel fetches on static hosts.
 for(let i=0;i<paths.length;i+=8)await Promise.all(paths.slice(i,i+8).map(async path=>dir.file(path.startsWith('fusion/')?path.slice(7):path,await fetchFile(path))));
 for(const [name,text]of Object.entries(generateControl(c)))dir.file('control/'+name,text);
 return zip.generateAsync({type,compression:'DEFLATE'});
}
