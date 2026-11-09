import './style.css';
import {setupCatalog} from './catalog.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {navigation,inside} from './navigation.js';
import {interactions} from './interactions.js';
import {optimize} from './optimize.js';
import {createRealisticRenderer} from './realistic-renderer.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

const $=s=>document.querySelector(s),canvas=$('#scene'),stage=$('#stage'),status=$('#status');
const state={variant:'B',mode:'overview',room:'kitchen',loaded:false,light:true,brightness:1,cut:true,yaw:0,pitch:0};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch{ $('#load-message').textContent='3D недоступно. Откройте схемы через меню «Сравнить варианты и планы».';throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.localClippingEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e5df');
const camera=new THREE.PerspectiveCamera(42,1,.025,150);
RectAreaLightUniformsLib.init();
const realistic=createRealisticRenderer(renderer,scene,camera);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=4;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.48;
const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment(),environment=pmrem.fromScene(env,.04);scene.environment=environment.texture;scene.environmentIntensity=.30;env.dispose();pmrem.dispose();
const hemisphere=new THREE.HemisphereLight('#fffaf1','#a99c87',1.0);scene.add(hemisphere);
const sun=new THREE.DirectionalLight('#fff1d7',1.9);sun.position.set(-5,15,4);sun.target.position.set(7,0,-3.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:10,bottom:-10,near:.5,far:45});sun.shadow.bias=-.0001;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:'#e9e5df',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.14;ground.receiveShadow=true;scene.add(ground);
const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),1.1),keys=new Set(),touch=new Set(),cache=new Map();
let data,model,nav,interaction,meshes=[],lights=[],generation=0;
const message=text=>{status.textContent=text;};
const world=(p,z=0)=>new THREE.Vector3((p[0]-data.origin[0])*data.scale_m_per_svg_unit,z,(p[1]-data.origin[1])*data.scale_m_per_svg_unit);
const source=v=>[v.x/data.scale_m_per_svg_unit+data.origin[0],v.z/data.scale_m_per_svg_unit+data.origin[1]];
function blocked(x,y){const w=world([x,y]);return nav.blocked(x,y)||interaction?.blocked(w.x,w.z);}
function roomName(r){const v=data.variants[state.variant];return r.id===v.children_room?'Общая детская':r.id===v.parents_room?'Спальня родителей':r.name;}
function clearInput(){keys.clear();touch.clear();for(const timer of held.values())clearTimeout(timer);held.clear();}
function overview(){const center=new THREE.Vector3(7.2,0,-3.7),top=state.mode==='top',direction=(top?new THREE.Vector3(0,1,.0001):new THREE.Vector3(.28,.85,.65)).normalize();const dist=Math.max(8/(Math.tan(THREE.MathUtils.degToRad(21))*camera.aspect),4.6/Math.tan(THREE.MathUtils.degToRad(21)))*1.32;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,dist);camera.fov=42;camera.updateProjectionMatrix();camera.lookAt(center);controls.update();}
function spawn(roomId){
 const p=nav.spawn(roomId,(x,y)=>{const w=world([x,y]);return interaction?.blocked(w.x,w.z);});if(!p){message('Нет свободной точки входа. Откройте двери в панели управления.');return false;}
 camera.position.copy(world(p,1.6));const targets={kitchen:[177,334],corridor:[440,315],upper:[540,235],lower:[610,360],bath5:[404,224],bath65:[348,382]};camera.lookAt(world(targets[roomId],1.05));const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');state.yaw=e.y;state.pitch=e.x;return true;
}
function updateMap(){if(!data)return;const map=$('#minimap');map.replaceChildren();const ns='http://www.w3.org/2000/svg';const e=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 for(const r of data.rooms){const active=state.mode==='walk'&&r.id===state.room,p=e('polygon',{points:r.polygon.map(p=>p.join(',')).join(' '),fill:active?'#c8a8ab':r.id===data.variants[state.variant].children_room?'#e6d6d6':'#e5ded0',stroke:'#897a6e','stroke-width':2,'data-room':r.id,tabindex:0,role:'button','aria-label':roomName(r)});p.addEventListener('click',()=>selectRoom(r.id));p.addEventListener('keydown',ev=>{if(ev.key==='Enter')selectRoom(r.id);});map.append(p);}
 for(const o of data.variants[state.variant].objects)map.append(e('polygon',{points:o.polygon.map(p=>p.join(',')).join(' '),fill:'#897a6e',opacity:.32,'pointer-events':'none'}));
 const marker=e('g',{id:'camera-marker','pointer-events':'none'});marker.append(e('circle',{cx:0,cy:0,r:7,fill:'#562e3a',stroke:'#fff','stroke-width':2}));marker.append(e('path',{d:'M -5,-6 L 0,-20 L 5,-6',fill:'#562e3a'}));map.append(marker);updateMarker();
}
function updateMarker(){const marker=$('#camera-marker');if(!marker)return;marker.style.display=state.mode==='walk'?'':'none';const p=source(camera.position);marker.setAttribute('transform',`translate(${p[0]} ${p[1]}) rotate(${-state.yaw*180/Math.PI})`);}
function sceneMode(){
 for(const m of meshes){const k=m.userData.kind;m.visible=!(state.mode!=='walk'&&(k==='ceiling'||k==='lamp'));const clipIt=state.mode!=='walk'&&state.cut&&k==='wall';m.material.clippingPlanes=clipIt?[clip]:[];m.material.needsUpdate=true;}
 ground.visible=state.mode!=='walk';controls.enabled=state.mode!=='walk';$('#cut-control').hidden=state.mode==='walk';$('#movement').hidden=state.mode!=='walk';document.body.dataset.mode=state.mode;
}
function updateUI(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode)));
 document.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===state.variant)));
 const r=data.rooms.find(r=>r.id===state.room);$('#view-name').textContent=state.mode==='walk'?roomName(r):state.mode==='top'?'Расстановка сверху':'Квартира целиком';$('#view-caption').textContent=state.mode==='walk'?'На уровне глаз · 1,60 м':'Вариант '+state.variant+' · объём и расстановка';
 $('#hint').textContent=state.mode==='walk'?'Потяните экран, чтобы оглядеться. WASD, стрелки или кнопки — движение.':'Потяните, чтобы повернуть. Колёсико или два пальца приближают.';
 document.querySelectorAll('#rooms button').forEach(b=>b.setAttribute('aria-current',String(state.mode==='walk'&&b.dataset.room===state.room)));updateMap();
}
function setMode(mode){if(!state.loaded)return;clearInput();state.mode=mode;if(mode==='walk'){camera.fov=68;camera.updateProjectionMatrix();if(!spawn(state.room)){state.mode='overview';overview();}}else overview();sceneMode();updateUI();if(state.mode==='walk')canvas.focus({preventScroll:true});}
function selectRoom(id){if(!state.loaded)return;state.room=id;interaction.chooseRoom(id);setMode('walk');document.body.classList.remove('menu-open');}
function navigationUI(){const rooms=$('#rooms');rooms.replaceChildren();for(const id of ['kitchen','corridor','upper','lower','bath5','bath65']){const r=data.rooms.find(r=>r.id===id),b=document.createElement('button');b.textContent=roomName(r);b.dataset.room=id;b.onclick=()=>selectRoom(id);rooms.append(b);}}
async function loadVariant(key){
 const token=++generation;state.loaded=false;clearInput();$('#loading').hidden=false;$('#load-message').textContent='Загружается вариант '+key;document.querySelectorAll('[data-variant]').forEach(b=>b.disabled=true);
 try{
  if(!cache.has(key)){const gltf=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'models/SOBYTIE_'+key+'.glb?v=P04T03');cache.set(key,optimize(gltf.scene));}
  if(token!==generation)return;if(model)scene.remove(model);model=cache.get(key);scene.add(model);state.variant=key;nav=navigation(data,key);interaction=interactions(model,camera,key,message);meshes=[];model.traverse(m=>{if(m.isMesh)meshes.push(m);});
  state.loaded=true;navigationUI();setMode(state.mode);$('#loading').hidden=true;message('Вариант '+key+' · эскизная модель');
 }catch(error){console.error(error);$('#load-message').textContent='Не удалось загрузить модель. Обновите страницу или откройте схемы в боковом меню.';message('Ошибка загрузки 3D');}
 finally{document.querySelectorAll('[data-variant]').forEach(b=>b.disabled=false);}
}
function lightMode(){hemisphere.intensity=state.light?.85:.32;scene.environmentIntensity=state.light?.30:.16;sun.intensity=state.light?1.9:.7;lights.forEach(l=>l.intensity=state.light?5.8*state.brightness:0);$('#light-toggle').textContent=state.light?'Свет включён':'Вечер без света';$('#light-toggle').setAttribute('aria-pressed',String(state.light));}
$('#brightness').oninput=e=>{state.brightness=Number(e.target.value)/100;$('#brightness-value').textContent=e.target.value+'%';lightMode();};
$('#quality').onchange=e=>realistic.setEnabled(e.target.checked);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>loadVariant(b.dataset.variant));
$('#cutaway').onchange=()=>{state.cut=$('#cutaway').checked;sceneMode();};$('#light-toggle').onclick=()=>{state.light=!state.light;lightMode();};
$('#menu').onclick=()=>document.body.classList.add('menu-open');$('#collapse').onclick=()=>document.body.classList.remove('menu-open');
$('#objects-toggle').onclick=()=>{$('#objects').hidden=!$('#objects').hidden;$('#objects-toggle').setAttribute('aria-expanded',String(!$('#objects').hidden));};$('#objects-close').onclick=()=>{$('#objects').hidden=true;$('#objects-toggle').setAttribute('aria-expanded','false');};
$('#map-toggle').onclick=()=>{$('#minimap').hidden=!$('#minimap').hidden;$('#map-toggle').setAttribute('aria-expanded',String(!$('#minimap').hidden));};
for(const id of ['compare','docs','help','gallery','catalog']){$('#'+id+'-open').onclick=()=>{clearInput();if(id==='gallery')gallery();$('#'+id).showModal();};$('#'+id+' .dialog-close').onclick=()=>$('#'+id).close();$('#'+id).addEventListener('click',e=>{if(e.target===e.currentTarget){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});}
document.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{$('#compare').close();document.body.classList.remove('menu-open');loadVariant(b.dataset.choose);});
function gallery(){const grid=$('#gallery-grid');grid.replaceChildren();$('#gallery-caption').textContent='Вариант '+state.variant;for(const id of ['kitchen','upper','lower','corridor','bath5','bath65']){const room=data.rooms.find(r=>r.id===id),figure=document.createElement('figure'),img=document.createElement('img'),button=document.createElement('button');img.src=import.meta.env.BASE_URL+'views/'+state.variant+'_'+id+'.jpg';img.alt=roomName(room)+' / эскизная модель';img.loading='lazy';button.textContent=roomName(room);button.onclick=()=>{$('#gallery').close();selectRoom(id);};figure.append(img,button);grid.append(figure);}}
const inputTarget=e=>['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]');
window.addEventListener('keydown',e=>{if(state.mode!=='walk'||inputTarget(e))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);
const held=new Map();
for(const b of document.querySelectorAll('[data-move]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);step(b.dataset.move,.35);held.set(b,setTimeout(()=>touch.add(b.dataset.move),300));};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{clearTimeout(held.get(b));held.delete(b);touch.delete(b.dataset.move);};}
for(const b of document.querySelectorAll('[data-turn]'))b.onclick=()=>{state.yaw+=Number(b.dataset.turn)*Math.PI/12;camera.rotation.set(state.pitch,state.yaw,0,'YXZ');updateMarker();};
const roomOrder=['kitchen','corridor','upper','lower','bath5','bath65'];
for(const b of document.querySelectorAll('[data-room-shift]'))b.onclick=()=>selectRoom(roomOrder[(roomOrder.indexOf(state.room)+Number(b.dataset.roomShift)+roomOrder.length)%roomOrder.length]);
function step(direction,distance=.35){if(state.mode!=='walk')return;touch.add(direction);for(let i=0;i<10;i++)move(distance/1.35/10);touch.delete(direction);updateMarker();}
let pointer=null;
canvas.addEventListener('pointerdown',e=>{if(!state.loaded)return;canvas.focus({preventScroll:true});pointer={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,id:e.pointerId};if(state.mode==='walk')canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(state.mode==='walk'){state.yaw-=(e.clientX-pointer.x)*.004;state.pitch=THREE.MathUtils.clamp(state.pitch-(e.clientY-pointer.y)*.003,-1.15,1.15);camera.rotation.set(state.pitch,state.yaw,0,'YXZ');}pointer.x=e.clientX;pointer.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(pointer&&Math.hypot(e.clientX-pointer.ox,e.clientY-pointer.oy)<5)interaction?.pick(e.clientX,e.clientY,canvas);pointer=null;});canvas.addEventListener('pointercancel',()=>pointer=null);
function move(dt){
 let f=Number(keys.has('KeyW')||keys.has('ArrowUp')||touch.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||touch.has('back')),r=Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'));if(!f&&!r)return;
 const length=Math.hypot(f,r);f/=length;r/=length;const speed=1.35*dt,dx=(-Math.sin(state.yaw)*f+Math.cos(state.yaw)*r)*speed,dz=(-Math.cos(state.yaw)*f-Math.sin(state.yaw)*r)*speed;
 for(const[axis,delta]of [['x',dx],['z',dz]]){const next=camera.position.clone();next[axis]+=delta;const p=source(next);if(!blocked(...p))camera.position.copy(next);}
 const p=source(camera.position),room=data.rooms.find(r=>inside(...p,r.polygon));if(room&&room.id!==state.room){state.room=room.id;interaction.chooseRoom(room.id);updateUI();}
}
function resize(){const b=stage.getBoundingClientRect();renderer.setSize(b.width,b.height,false);realistic.resize(b.width,b.height);camera.aspect=b.width/b.height;camera.updateProjectionMatrix();if(state.loaded&&state.mode!=='walk')overview();}new ResizeObserver(resize).observe(stage);resize();
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;if(!state.loaded)return;interaction.tick(dt,state.mode==='walk');if(state.mode==='walk'&&!document.querySelector('dialog[open]')){move(dt);updateMarker();}else if(state.mode!=='walk')controls.update();realistic.render(state.mode==='walk');}requestAnimationFrame(frame);
try{data=await(await fetch(import.meta.env.BASE_URL+'project/project.json')).json();for(const room of data.rooms){const l=new THREE.PointLight('#fff0d3',5.8,7,2);l.position.copy(world(room.center,2.8));scene.add(l);lights.push(l);}await loadVariant('B');}catch(error){console.error(error);$('#load-message').textContent='Не удалось загрузить данные проекта. Обновите страницу.';}
// Read-only diagnostics and navigation commands support repeatable browser checks.
window.sobytie={state,selectRoom,setMode,loadVariant,step,setAll:value=>interaction.setAll(value),capture:()=>{realistic.render(state.mode==='walk');return canvas.toDataURL('image/jpeg',.92);},diagnostics:()=>({variant:state.variant,mode:state.mode,loaded:state.loaded,room:state.room,camera:camera.position.toArray(),source:source(camera.position),blocked:nav?blocked(...source(camera.position)):null,objects:interaction?.diagnostics(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),safePositions:()=>Object.fromEntries(data.rooms.map(r=>[r.id,nav.spawn(r.id)]))};

setupCatalog().catch(error=>{console.error(error);document.querySelector("#catalog-body").textContent="Не удалось загрузить подбор. Скачайте ведомость в разделе файлов.";});
