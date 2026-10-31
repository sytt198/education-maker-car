import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const mime={'.html':'text/html;charset=utf-8','.js':'text/javascript;charset=utf-8','.css':'text/css;charset=utf-8','.json':'application/json;charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.md':'text/plain;charset=utf-8','.py':'text/plain;charset=utf-8','.manifest':'application/json;charset=utf-8'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://127.0.0.1'),relative=decodeURIComponent(url.pathname),target=path.resolve(root,'.'+relative);if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}let file=target;try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{if(!path.extname(file))file=path.join(root,'index.html');}const data=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Cache-Control':'no-cache'});res.end(data);}catch{res.writeHead(404).end('Not found');}}).listen(5180,'127.0.0.1',()=>console.log('Maker Car: http://127.0.0.1:5180'));
