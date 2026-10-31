import {forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createEducationAssembly,disposeEducationAssembly,rotateWheelGroups} from './Assembly.mjs';

export default forwardRef(function Viewer({project,source,exploded=false,hidden=[],selected,onSelect,motion},ref){
 const host=useRef(null),api=useRef(null),latest=useRef({motion,onSelect});latest.current={motion,onSelect};
 useImperativeHandle(ref,()=>({view:v=>api.current?.view(v),reset:()=>api.current?.reset(),snapshot:()=>api.current?.renderer.domElement.toDataURL('image/png')}),[]);
 useEffect(()=>{
  const container=host.current;let renderer;try{renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});}catch{container.textContent='无法启用WebGL，请使用支持WebGL的浏览器。';return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#edf0f5');renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.domElement.setAttribute('aria-label','教育版真实CAD三维装配');container.append(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera(-100,100,100,-100,.1,3000);camera.up.set(0,0,1);
  scene.add(new T.HemisphereLight(0xffffff,0x7d8798,2.7));const key=new T.DirectionalLight(0xffffff,3);key.position.set(-70,-120,240);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-230,right:230,top:230,bottom:-230,near:1,far:600});key.shadow.bias=-.0003;scene.add(key);const fill=new T.DirectionalLight(0xffffff,1);fill.position.set(140,80,150);scene.add(fill);
  const ground=new T.Mesh(new T.PlaneGeometry(4000,4000),new T.ShadowMaterial({opacity:.13}));ground.position.z=-.25;ground.receiveShadow=true;scene.add(ground);
  const grid=new T.GridHelper(4000,400,0xcbd3df,0xdce1e9);grid.rotation.x=Math.PI/2;grid.position.z=-.3;scene.add(grid);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.4;controls.maxZoom=8;
  const holder=new T.Group();scene.add(holder);let a,selectedBox,dirty=true,last=0,leftAngle=0,rightAngle=0;
  const resize=()=>{const w=Math.max(1,container.clientWidth),h=Math.max(1,container.clientHeight),span=api.current?.span??100;camera.left=-span*w/h;camera.right=span*w/h;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();renderer.setSize(w,h);dirty=true;};
  const state={renderer,span:90,load:(c,s)=>{if(a){holder.remove(a);disposeEducationAssembly(a);}a=createEducationAssembly(c,s);holder.add(a);state.assembly=a;state.config=c;state.reset();},reset:()=>{holder.position.set(0,0,0);holder.rotation.z=0;state.view('iso');},view:v=>{if(!a)return;const box=new T.Box3().setFromObject(a),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());const offsets={iso:[160,-220,165],front:[0,-300,20],side:[300,0,20],top:[0,.01,300]};camera.up.set(0,v==='top'?1:0,v==='top'?0:1);camera.position.copy(center).add(new T.Vector3(...(offsets[v]??offsets.iso)));controls.target.copy(center);state.span=Math.max(size.z,size.y,size.x)*.73;camera.zoom=1;resize();controls.update();dirty=true;},select:id=>{if(selectedBox){scene.remove(selectedBox);selectedBox.geometry.dispose();selectedBox.material.dispose();selectedBox=null;}const o=a?.getObjectByName(id);if(o&&o.visible){selectedBox=new T.BoxHelper(o,0x0057ff);scene.add(selectedBox);}dirty=true;},invalidate:()=>{dirty=true;}};api.current=state;
  const ro=new ResizeObserver(resize);ro.observe(container);controls.addEventListener('change',()=>{dirty=true;});
  const ray=new T.Raycaster();let down=[0,0];const onDown=e=>{down=[e.clientX,e.clientY];},onUp=e=>{if(e.button!==0||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4)return;const rect=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);let h=ray.intersectObject(holder,true).find(h=>{let o=h.object;while(o){if(!o.visible)return false;o=o.parent;}return true;})?.object;while(h&&!h.userData.id)h=h.parent;latest.current.onSelect?.(h?.userData.id??null);};renderer.domElement.addEventListener('pointerdown',onDown);renderer.domElement.addEventListener('pointerup',onUp);
  renderer.setAnimationLoop(t=>{const dt=Math.min(.04,(t-last)/1000||0);last=t;const m=latest.current.motion;if(a&&m&&(Math.abs(m.leftRPM)+Math.abs(m.rightRPM)>0)){
    leftAngle-=m.leftRPM*Math.PI/30*dt;rightAngle-=m.rightRPM*Math.PI/30*dt;rotateWheelGroups(a,leftAngle,rightAngle);
    dirty=true;holder.rotation.z+=m.angular*dt;const yaw=holder.rotation.z,delta=new T.Vector3(Math.sin(yaw)*m.linear*1000*dt,-Math.cos(yaw)*m.linear*1000*dt,0);holder.position.add(delta);camera.position.add(delta);controls.target.add(delta);
   }controls.update();if(dirty){selectedBox?.update();renderer.render(scene,camera);dirty=false;}});
  resize();return()=>{renderer.setAnimationLoop(null);ro.disconnect();controls.dispose();renderer.domElement.removeEventListener('pointerdown',onDown);renderer.domElement.removeEventListener('pointerup',onUp);if(a)disposeEducationAssembly(a);if(selectedBox){selectedBox.geometry.dispose();selectedBox.material.dispose();}ground.geometry.dispose();ground.material.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();container.replaceChildren();api.current=null;};
 },[]);
 const key=JSON.stringify([project.geometry,project.wheelColor]);
 useEffect(()=>{if(source)api.current?.load(project,source);},[key,source]);
 useEffect(()=>{const state=api.current,a=state?.assembly;if(!a)return;for(const p of a.children){p.position.fromArray(p.userData.basePosition);if(exploded)p.position.add(new T.Vector3(...p.userData.explode));p.visible=!hidden.includes(p.userData.group)&&!hidden.includes(p.name);}state.select(selected);state.invalidate();},[key,source,exploded,hidden,selected]);
 return <div className="cad-host" ref={host} data-testid="education-viewer"/>;
});
