import './style.css';
import './studio.css';
import {createExterior} from './exterior.js';
import {solarState} from './solar.js';
import {setupCatalog} from './catalog.js';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {downloadModel} from './model-download.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {navigation,inside} from './navigation.js';
import {findWalkPath,clearSegment} from './walk-path.js';
import {interactions} from './interactions.js';
import {optimize} from './optimize.js';
import {createRealisticRenderer} from './realistic-renderer.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';

const $=s=>document.querySelector(s),canvas=$('#scene'),stage=$('#stage'),status=$('#status');
const roomOrder=['kitchen','corridor','upper','lower','bath5','bath65'];
const state={variant:'B',mode:'overview',room:'kitchen',loaded:false,light:true,brightness:1,cut:true,yaw:0,pitch:0};
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true});}catch{ $('#load-message').textContent='3D недоступно. Откройте схемы через меню «Сравнить варианты и планы».';throw new Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.88;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.localClippingEnabled=true;
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e5df');
const camera=new THREE.PerspectiveCamera(42,1,.025,2500);
RectAreaLightUniformsLib.init();
const realistic=createRealisticRenderer(renderer,scene,camera);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=4;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.48;
const pmrem=new THREE.PMREMGenerator(renderer),env=new RoomEnvironment(),environment=pmrem.fromScene(env,.04);scene.environment=environment.texture;scene.environmentIntensity=.30;env.dispose();pmrem.dispose();
const hemisphere=new THREE.HemisphereLight('#fffaf1','#a99c87',1.0);scene.add(hemisphere);
const sun=new THREE.DirectionalLight('#fff1d7',1.9);sun.position.set(-5,15,4);sun.target.position.set(7,0,-3.5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-13,right:13,top:10,bottom:-10,near:.5,far:45});sun.shadow.bias=-.0001;sun.shadow.normalBias=.025;scene.add(sun,sun.target);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(140,140),new THREE.MeshStandardMaterial({color:'#e9e5df',roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.14;ground.receiveShadow=true;scene.add(ground);
const clip=new THREE.Plane(new THREE.Vector3(0,-1,0),1.1),keys=new Set(),touch=new Set(),cache=new Map();
let data,model,nav,interaction,exterior,solar,meshes=[],lights=[],generation=0;
let sunPlaying=false,walkRoute=[];
const destination=new THREE.Mesh(new THREE.RingGeometry(.075,.11,32),new THREE.MeshBasicMaterial({color:'#8e5668',transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide}));
destination.rotation.x=-Math.PI/2;destination.visible=false;scene.add(destination);
function stopWalking(){walkRoute=[];destination.visible=false;}
function walkTo(point){
 if(state.mode!=='walk'||!state.loaded)return false;
 const route=findWalkPath(source(camera.position),point,blocked,[108,145,634,429]);
 if(!route){stopWalking();message('Нет свободного пути. Откройте дверь или выберите другую точку на полу.');return false;}
 walkRoute=route;destination.position.copy(world(point,.018));destination.visible=true;return true;
}
function followWalk(dt){
 if(!walkRoute.length)return;
 const target=world(walkRoute[0],1.6),delta=target.clone().sub(camera.position),distance=delta.length();
 if(distance<.035){walkRoute.shift();if(!walkRoute.length)stopWalking();return;}
 const next=camera.position.clone().addScaledVector(delta,Math.min(distance,dt*1.15)/distance);
 if(!clearSegment(source(camera.position),source(next),blocked)){stopWalking();message('Проход занят. Выберите новую точку.');return;}
 camera.position.copy(next);
 const yaw=Math.atan2(-delta.x,-delta.z),diff=Math.atan2(Math.sin(yaw-state.yaw),Math.cos(yaw-state.yaw));
 state.yaw+=diff*Math.min(1,dt*5);state.pitch*=Math.max(0,1-dt*4);camera.rotation.set(state.pitch,state.yaw,0,'YXZ');updateCurrentRoom();
}
function updateCurrentRoom(){const p=source(camera.position),room=data.rooms.find(r=>inside(...p,r.polygon));if(room&&room.id!==state.room){state.room=room.id;interaction.chooseRoom(room.id);updateUI();}}

let toastTimer,alternate=false;
const message=text=>{status.textContent=text;status.classList.add('has-message');clearTimeout(toastTimer);toastTimer=setTimeout(()=>status.classList.remove('has-message'),5000);};
const world=(p,z=0)=>new THREE.Vector3((p[0]-data.origin[0])*data.scale_m_per_svg_unit,z,(p[1]-data.origin[1])*data.scale_m_per_svg_unit);
const source=v=>[v.x/data.scale_m_per_svg_unit+data.origin[0],v.z/data.scale_m_per_svg_unit+data.origin[1]];
function blocked(x,y){const w=world([x,y]);return nav.blocked(x,y)||interaction?.blocked(w.x,w.z);}
function roomName(r){const v=data.variants[state.variant];if(r.id==='bath65')return state.variant==='B'?'Ванная при детской':'Ванная при спальне';return r.id===v.children_room?'Общая детская':r.id===v.parents_room?'Спальня родителей':r.name;}
function clearInput(){stopWalking();keys.clear();touch.clear();for(const timer of held.values())clearTimeout(timer);held.clear();}
function overview(){const center=new THREE.Vector3(7.2,0,-3.7),top=state.mode==='top',direction=(top?new THREE.Vector3(0,1,.0001):new THREE.Vector3(.28,.85,.65)).normalize();const dist=Math.max(8/(Math.tan(THREE.MathUtils.degToRad(21))*camera.aspect),4.6/Math.tan(THREE.MathUtils.degToRad(21)))*1.32;controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,dist);camera.fov=42;camera.updateProjectionMatrix();camera.lookAt(center);controls.update();}
function spawn(roomId){
 alternate=false;$('#alternate-view').textContent='Места для занятий';
 let p=nav.spawn(roomId,(x,y)=>{const w=world([x,y]);return interaction?.blocked(w.x,w.z);});if(!p){message('Нет свободной точки входа. Откройте двери в панели управления.');return false;}
 if(state.variant==='B'&&roomId==='lower'&&!blocked(570,369))p=[570,369];
 camera.position.copy(world(p,1.6));const targets={kitchen:[177,334],corridor:[440,315],upper:[540,235],lower:[610,360],bath5:[404,224],bath65:[348,382]};camera.lookAt(world(state.variant==='B'&&roomId==='lower'?[470,346]:targets[roomId],1.05));const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');state.yaw=e.y;state.pitch=e.x;return true;
}
function updateMap(){if(!data)return;const map=$('#minimap');map.replaceChildren();const ns='http://www.w3.org/2000/svg';const e=(tag,attrs)=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 for(const r of data.rooms){const active=state.mode==='walk'&&r.id===state.room,p=e('polygon',{points:r.polygon.map(p=>p.join(',')).join(' '),fill:active?'#c8a8ab':r.id===data.variants[state.variant].children_room?'#e6d6d6':'#e5ded0',stroke:'#897a6e','stroke-width':2,'data-room':r.id,tabindex:0,role:'button','aria-label':roomName(r)});p.addEventListener('click',()=>selectRoom(r.id));p.addEventListener('keydown',ev=>{if(ev.key==='Enter')selectRoom(r.id);});map.append(p);}
 for(const o of data.variants[state.variant].objects)map.append(e('polygon',{points:o.polygon.map(p=>p.join(',')).join(' '),fill:'#897a6e',opacity:.32,'pointer-events':'none'}));
 const marker=e('g',{id:'camera-marker','pointer-events':'none'});marker.append(e('circle',{cx:0,cy:0,r:7,fill:'#562e3a',stroke:'#fff','stroke-width':2}));marker.append(e('path',{d:'M -5,-6 L 0,-20 L 5,-6',fill:'#562e3a'}));map.append(marker);updateMarker();
}
function updateMarker(){const marker=$('#camera-marker');if(!marker)return;marker.style.display=state.mode==='walk'?'':'none';const p=source(camera.position);marker.setAttribute('transform',`translate(${p[0]} ${p[1]}) rotate(${-state.yaw*180/Math.PI})`);}
function sceneMode(){
 for(const m of meshes){const k=m.userData.kind;m.visible=!(state.mode!=='walk'&&(k==='ceiling'||k==='lamp'));const clipIt=state.mode!=='walk'&&state.cut&&k==='wall';m.material.clippingPlanes=clipIt?[clip]:[];m.material.needsUpdate=true;}
 ground.visible=state.mode!=='walk';exterior?.setVisible(state.mode==='walk');applySun();controls.enabled=state.mode==='overview'||state.mode==='top';$('#interiors').hidden=state.mode!=='gallery';canvas.hidden=state.mode==='gallery';$('#cut-control').hidden=state.mode==='walk';$('#movement').hidden=state.mode!=='walk';document.body.dataset.mode=state.mode;
}
function updateUI(){
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===state.mode||(b.dataset.mode==='overview'&&state.mode==='top'))));
 document.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.variant===state.variant)));
 const r=data.rooms.find(r=>r.id===state.room);$('#view-name').textContent=['walk','gallery'].includes(state.mode)?roomName(r):state.mode==='top'?'Расстановка сверху':'Квартира целиком';$('#view-caption').textContent=state.mode==='gallery'?'Образ интерьера V01 · вариант '+state.variant:state.mode==='walk'?'На уровне глаз · 1,60 м':'Вариант '+state.variant+' · объём и расстановка';
 $('#hint').textContent=state.mode==='walk'?'Нажмите на свободный пол, чтобы подойти. Потяните экран — оглядеться. WASD — движение.':'Потяните, чтобы повернуть. Колёсико или два пальца приближают.';
 document.querySelectorAll('#rooms button').forEach(b=>b.setAttribute('aria-current',String(['walk','gallery'].includes(state.mode)&&b.dataset.room===state.room)));updateMap();$('#room-progress').textContent=(roomOrder.indexOf(state.room)+1)+' / 6';$('#alternate-view').hidden=state.mode!=='walk'||state.variant!=='B'||state.room!=='lower';$('#window-view').hidden=state.mode!=='walk'||!['kitchen','upper','lower'].includes(state.room);$('#sun-panel').hidden=state.mode==='gallery';updateSunDescription();
}
function setMode(mode){if(!state.loaded)return;clearInput();state.mode=mode;if(mode==='walk'){camera.fov=camera.aspect<.8?82:68;camera.updateProjectionMatrix();if(!spawn(state.room)){state.mode='overview';overview();}}else if(mode!=='gallery')overview();sceneMode();updateUI();if(mode==='gallery')gallery();if(state.mode==='walk')canvas.focus({preventScroll:true});}
function selectRoom(id){if(!state.loaded)return;state.room=id;interaction.chooseRoom(id);setMode(state.mode==='gallery'?'gallery':'walk');setMenuOpen(false);}
function navigationUI(){const rooms=$('#rooms');rooms.replaceChildren();for(const id of ['kitchen','corridor','upper','lower','bath5','bath65']){const r=data.rooms.find(r=>r.id===id),b=document.createElement('button');b.textContent=roomName(r);b.dataset.room=id;b.onclick=()=>selectRoom(id);rooms.append(b);}}
async function loadVariant(key){
 const token=++generation;state.loaded=false;clearInput();$('#loading').hidden=false;$('#load-message').textContent='Загружается вариант '+key;document.querySelectorAll('[data-variant]').forEach(b=>b.disabled=true);
 try{
  if(!cache.has(key)){
   const file='models/SOBYTIE_'+key+'.glb?v=P04T06',urls=[import.meta.env.BASE_URL+file];
   if(location.hostname==='sobytie.aram-sites.duckdns.org')urls.push('https://arammuradian01-cloud.github.io/sobytie-apartment-studio/'+file);
   const hashes={"A": "a10ac2b20aca81d5a3dd11f40d4cd2ab02923ecbb2cc5edabd7d8de8c166dde4", "B": "4deda9aabc07024f18bd5e3a9cea3235ab8cc682c7d69b5e7bb083442bc98d2d"};
   const bytes=await downloadModel(urls,hashes[key]);
   const gltf=await new GLTFLoader().parseAsync(bytes,import.meta.env.BASE_URL);cache.set(key,optimize(gltf.scene));
  }
  if(token!==generation)return;if(model)scene.remove(model);model=cache.get(key);scene.add(model);state.variant=key;nav=navigation(data,key);interaction=interactions(model,camera,key,message);meshes=[];model.traverse(m=>{if(m.isMesh)meshes.push(m);});
  state.loaded=true;navigationUI();setMode(state.mode);$('#loading').hidden=true;message('Вариант '+key+' · эскизная модель');
 }catch(error){console.error(error);$('#load-message').textContent='Не удалось загрузить модель. Обновите страницу или откройте схемы в боковом меню.';message('Ошибка загрузки 3D');}
 finally{document.querySelectorAll('[data-variant]').forEach(b=>b.disabled=false);}
}
function lightMode(){lights.forEach(l=>l.intensity=state.light?5.8*state.brightness:0);$('#light-toggle').textContent=state.light?'Свет включён':'Только дневной свет';$('#light-toggle').setAttribute('aria-pressed',String(state.light));applySun();}
function updateSunDescription(){
 if(!solar)return;
 const windowSource={kitchen:[116,356],upper:[591,247],lower:[630,367]}[state.room];
 let note=solar.altitude<=0?'Солнце за горизонтом.':!windowSource?'Помещение без наружного окна.':'';
 if(windowSource&&solar.altitude>0){const p=world(windowSource,1.6).toArray(),normal=state.room==='kitchen'?-1:1;
 note=solar.direction[0]*normal<=0?'Прямое солнце с другой стороны дома.':exterior?.occlusion(p,solar.direction)?'Окно затеняет соседний объём.':'Солнце со стороны окна.';}
 $('#sun-description').textContent=`${note} Высота ${Math.round(solar.altitude)}° · азимут ${Math.round(solar.azimuth)}°. Восход ${solar.sunrise}, закат ${solar.sunset}.`;
}
function applySun(){
 solar=solarState($('#sun-date').value,Number($('#sun-time').value));if(!solar)return;
 $('#sun-time-label').textContent=solar.time;$('#sun-summary').textContent=solar.time+' МСК';
 $('#sun-time').setAttribute('aria-valuetext',solar.time+' по Москве');
 const v=new THREE.Vector3(...solar.direction),walk=state.mode==='walk';
 sun.target.position.set(7,1.2,-3.5);sun.position.copy(sun.target.position).addScaledVector(v,400);
 Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:.5,far:850});sun.shadow.camera.updateProjectionMatrix();sun.shadow.normalBias=.012;
 sun.intensity=solar.altitude>0?2.8*Math.min(1,solar.altitude/12):0;
 sun.color.set(solar.altitude<12?'#ffc88b':'#fff4e3');
 hemisphere.intensity=walk?.06+solar.daylight*.64:.95;scene.environmentIntensity=walk?.03+solar.daylight*.24:.30;
 scene.background.set(walk?(solar.altitude>-7?'#b8c8ce':'#101a2b'):'#e9e5df');
 exterior?.updateSun(solar);updateSunDescription();
}
$('#sun-time').oninput=$('#sun-date').oninput=()=>{sunPlaying=false;$('#sun-play').textContent='▶';$('#sun-play').setAttribute('aria-pressed','false');applySun();};
for(const b of document.querySelectorAll('[data-sun-date]'))b.onclick=()=>{$('#sun-date').value=$('#sun-date').value.slice(0,4)+'-'+b.dataset.sunDate;applySun();};
$('#sun-play').onclick=()=>{sunPlaying=!sunPlaying;$('#sun-play').textContent=sunPlaying?'Ⅱ':'▶';$('#sun-play').setAttribute('aria-pressed',String(sunPlaying));};
$('#exterior-phase').onchange=e=>{exterior?.setPhase(e.target.value);$('#exterior-caption').hidden=e.target.value!=='photo';updateSunDescription();};
function windowView(){
 if(!['kitchen','upper','lower'].includes(state.room))return;
 if(state.mode!=='walk')setMode('walk');
 const target={kitchen:[118,356],upper:[589,247],lower:[627,367]}[state.room];
 stopWalking();const sign=state.room==='kitchen'?1:-1;let position;
 for(const dy of [0,-15,15,-30,30]){for(const distance of [32,45,60,75,95]){const p=[target[0]+sign*distance,target[1]+dy];if(!blocked(...p)){position=p;break;}}if(position)break;}
 if(position)camera.position.copy(world(position,1.6));
 camera.lookAt(world([target[0]-sign*200,target[1]],1.6));const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');state.yaw=e.y;state.pitch=e.x;updateMarker();message('Вид из окна · фотореалистичный прогноз. Солнце — в панели времени.');
}
$('#window-view').onclick=windowView;
$('#brightness').oninput=e=>{state.brightness=Number(e.target.value)/100;$('#brightness-value').textContent=e.target.value+'%';lightMode();};
$('#quality').onchange=e=>realistic.setEnabled(e.target.checked);
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));document.querySelectorAll('[data-variant]').forEach(b=>b.onclick=()=>loadVariant(b.dataset.variant));
$('#cutaway').onchange=()=>{state.cut=$('#cutaway').checked;sceneMode();};$('#light-toggle').onclick=()=>{state.light=!state.light;lightMode();};
const mobileMenu=matchMedia('(max-width:760px)');
function setMenuOpen(open){document.body.classList.toggle('menu-open',open);$('#sidebar').inert=mobileMenu.matches&&!open;stage.inert=mobileMenu.matches&&open;$('#sidebar-mask').hidden=!mobileMenu.matches||!open;$('#menu').setAttribute('aria-expanded',String(open));}
$('#menu').onclick=()=>setMenuOpen(true);$('#collapse').onclick=$('#sidebar-mask').onclick=()=>{setMenuOpen(false);$('#menu').focus();};mobileMenu.addEventListener('change',()=>setMenuOpen(false));setMenuOpen(false);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('menu-open')){setMenuOpen(false);$('#menu').focus();}});
$('#objects-toggle').onclick=()=>{$('#objects').hidden=!$('#objects').hidden;$('#objects-toggle').setAttribute('aria-expanded',String(!$('#objects').hidden));};$('#objects-close').onclick=()=>{$('#objects').hidden=true;$('#objects-toggle').setAttribute('aria-expanded','false');};
$('#map-toggle').onclick=()=>{$('#minimap').hidden=!$('#minimap').hidden;$('#map-toggle').setAttribute('aria-expanded',String(!$('#minimap').hidden));};
for(const id of ['compare','docs','help','catalog','exterior']){$('#'+id+'-open').onclick=()=>{clearInput();$('#'+id).showModal();};$('#'+id+' .dialog-close').onclick=()=>$('#'+id).close();$('#'+id).addEventListener('click',e=>{if(e.target===e.currentTarget){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});}
document.querySelectorAll('[data-choose]').forEach(b=>b.onclick=()=>{$('#compare').close();setMenuOpen(false);loadVariant(b.dataset.choose);});
function interiorPath(id){return import.meta.env.BASE_URL+'interiors/'+(['corridor','bath5','bath65'].includes(id)?'B':state.variant)+'_'+id+'.webp?v=T06E03';}
function gallery(){
 const room=data.rooms.find(r=>r.id===state.room),img=$('#interior-image');$('#interior-study').hidden=state.variant!=='B'||state.room!=='lower';$('#interior-study').textContent='Учебные места';
 img.src=interiorPath(state.room);img.alt=roomName(room)+' — образ интерьера V01, вариант '+state.variant;
 $('#interior-count').textContent=(roomOrder.indexOf(state.room)+1)+' / '+roomOrder.length;
 const thumbs=$('#interior-thumbs');thumbs.replaceChildren();
 for(const id of roomOrder){const r=data.rooms.find(r=>r.id===id),b=document.createElement('button'),im=document.createElement('img'),label=document.createElement('span');im.src=interiorPath(id);im.alt='';im.loading='lazy';label.textContent=roomName(r);b.append(im,label);b.setAttribute('aria-label',roomName(r));b.setAttribute('aria-current',String(id===state.room));b.onclick=()=>selectRoom(id);thumbs.append(b);}
 requestAnimationFrame(()=>thumbs.querySelector('[aria-current=true]')?.scrollIntoView({block:'nearest',inline:'center'}));
}
$('#interior-study').onclick=()=>{const study=!$('#interior-image').src.includes('_study');$('#interior-image').src=import.meta.env.BASE_URL+'interiors/B_lower'+(study?'_study':'')+'.webp?v=T06E03';$('#interior-image').alt=study?'Два учебных места в общей детской — образ V01':'Общая детская — кровати и хранение, образ V01';$('#interior-study').textContent=study?'Кровати и хранение':'Учебные места';};
$('#gallery-open').onclick=()=>{setMode('gallery');setMenuOpen(false);};
$('#interior-prev').onclick=()=>selectRoom(roomOrder[(roomOrder.indexOf(state.room)+roomOrder.length-1)%roomOrder.length]);
$('#interior-next').onclick=()=>selectRoom(roomOrder[(roomOrder.indexOf(state.room)+1)%roomOrder.length]);
$('#interior-enter').onclick=()=>setMode('walk');
$('#enter-apartment').onclick=()=>{state.room='corridor';setMode('walk');};
$('#top-view').onclick=()=>setMode('top');
$('#alternate-view').onclick=()=>{alternate=!alternate;const p=alternate?[492,368]:[570,369],target=alternate?[610,365]:[470,346];if(blocked(...p)){message('Ракурс занят открытой мебелью. Закройте створки или выберите комнату заново.');return;}camera.position.copy(world(p,1.6));camera.lookAt(world(target,1.05));const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');state.yaw=e.y;state.pitch=e.x;$('#alternate-view').textContent=alternate?'Кровати и хранение':'Места для занятий';updateMarker();};
function fullscreenLabel(){const expanded=!!document.fullscreenElement||document.body.classList.contains('immersive');$('#fullscreen').setAttribute('aria-label',expanded?'Свернуть полный экран':'На весь экран');}
$('#fullscreen').onclick=async()=>{if(document.body.classList.contains('immersive')){document.body.classList.remove('immersive');fullscreenLabel();return;}try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();else throw new Error('Fullscreen unavailable');}catch{document.body.classList.add('immersive');message('Сцена развёрнута в окне браузера. Esc — свернуть.');}fullscreenLabel();};
document.addEventListener('fullscreenchange',fullscreenLabel);window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('immersive')){document.body.classList.remove('immersive');fullscreenLabel();}});
const inputTarget=e=>['INPUT','SELECT','TEXTAREA','BUTTON'].includes(e.target.tagName)||document.querySelector('dialog[open]');
window.addEventListener('keydown',e=>{if(state.mode!=='walk'||inputTarget(e))return;if(e.code==='Escape'){stopWalking();return;}if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.code)){e.preventDefault();stopWalking();keys.add(e.code);}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearInput);document.addEventListener('visibilitychange',clearInput);
const held=new Map();
for(const b of document.querySelectorAll('[data-move]')){b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);step(b.dataset.move,.35);held.set(b,setTimeout(()=>touch.add(b.dataset.move),300));};b.onpointerup=b.onpointercancel=b.onlostpointercapture=()=>{clearTimeout(held.get(b));held.delete(b);touch.delete(b.dataset.move);};}
for(const b of document.querySelectorAll('[data-turn]'))b.onclick=()=>{stopWalking();state.yaw+=Number(b.dataset.turn)*Math.PI/12;camera.rotation.set(state.pitch,state.yaw,0,'YXZ');updateMarker();};

for(const b of document.querySelectorAll('[data-room-shift]'))b.onclick=()=>selectRoom(roomOrder[(roomOrder.indexOf(state.room)+Number(b.dataset.roomShift)+roomOrder.length)%roomOrder.length]);
function step(direction,distance=.35){if(state.mode!=='walk')return;stopWalking();touch.add(direction);for(let i=0;i<10;i++)move(distance/1.35/10);touch.delete(direction);updateMarker();}
let pointer=null;
canvas.addEventListener('pointerdown',e=>{if(!state.loaded)return;canvas.focus({preventScroll:true});stopWalking();pointer={x:e.clientX,y:e.clientY,ox:e.clientX,oy:e.clientY,id:e.pointerId};if(state.mode==='walk')canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!pointer||pointer.id!==e.pointerId)return;if(state.mode==='walk'){state.yaw-=(e.clientX-pointer.x)*.004;state.pitch=THREE.MathUtils.clamp(state.pitch-(e.clientY-pointer.y)*.003,-1.15,1.15);camera.rotation.set(state.pitch,state.yaw,0,'YXZ');}pointer.x=e.clientX;pointer.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{if(pointer&&pointer.id===e.pointerId&&Math.hypot(e.clientX-pointer.ox,e.clientY-pointer.oy)<5){const result=interaction?.pick(e.clientX,e.clientY,canvas);if(state.mode==='walk'&&!result?.handled&&result?.hit?.object.userData.kind==='floor')walkTo(source(result.hit.point));}pointer=null;});canvas.addEventListener('pointercancel',()=>pointer=null);
function move(dt){
 let f=Number(keys.has('KeyW')||keys.has('ArrowUp')||touch.has('forward'))-Number(keys.has('KeyS')||keys.has('ArrowDown')||touch.has('back')),r=Number(keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left'));if(!f&&!r)return;
 const length=Math.hypot(f,r);f/=length;r/=length;const speed=1.35*dt,dx=(-Math.sin(state.yaw)*f+Math.cos(state.yaw)*r)*speed,dz=(-Math.cos(state.yaw)*f-Math.sin(state.yaw)*r)*speed;
 for(const[axis,delta]of [['x',dx],['z',dz]]){const next=camera.position.clone();next[axis]+=delta;const p=source(next);if(!blocked(...p))camera.position.copy(next);}
 updateCurrentRoom();
}
function resize(){const b=stage.getBoundingClientRect();renderer.setSize(b.width,b.height,false);realistic.resize(b.width,b.height);camera.aspect=b.width/b.height;if(state.mode==='walk')camera.fov=camera.aspect<.8?82:68;camera.updateProjectionMatrix();if(state.loaded&&state.mode!=='walk')overview();}new ResizeObserver(resize).observe(stage);resize();
let sunAccumulator=0,last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;if(!state.loaded||state.mode==='gallery')return;if(sunPlaying){if(dt>0){sunAccumulator+=dt;if(sunAccumulator>.12){$('#sun-time').value=String((Number($('#sun-time').value)+5)%1440);applySun();sunAccumulator=0;}}}interaction.tick(dt,state.mode==='walk');if(state.mode==='walk'&&!document.querySelector('dialog[open]')){move(dt);followWalk(dt);updateMarker();}else if(state.mode!=='walk')controls.update();realistic.render(state.mode==='walk');}requestAnimationFrame(frame);
try{data=await(await fetch(import.meta.env.BASE_URL+'project/project.json?v=T06E03')).json();for(const room of data.rooms){const l=new THREE.PointLight('#fff0d3',5.8,7,2);l.position.copy(world(room.center,2.8));scene.add(l);lights.push(l);}exterior=await createExterior(scene);await loadVariant('B');lightMode();}catch(error){console.error(error);$('#load-message').textContent='Не удалось загрузить данные проекта. Обновите страницу.';}
// Read-only diagnostics and navigation commands support repeatable browser checks.
window.sobytie={walkTo,stopWalking,state,selectRoom,setMode,loadVariant,step,windowView,setSun:(date,minutes)=>{$('#sun-date').value=date;$('#sun-time').value=String(minutes);applySun();},setAll:value=>interaction.setAll(value),capture:()=>{realistic.render(state.mode==='walk');return canvas.toDataURL('image/jpeg',.92);},diagnostics:()=>({walk:{active:walkRoute.length>0,remaining:walkRoute.length,target:destination.visible?source(destination.position):null},solar,exterior:exterior?.diagnostics(),variant:state.variant,mode:state.mode,loaded:state.loaded,room:state.room,camera:camera.position.toArray(),source:source(camera.position),blocked:nav?blocked(...source(camera.position)):null,objects:interaction?.diagnostics(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}),safePositions:()=>Object.fromEntries(data.rooms.map(r=>[r.id,nav.spawn(r.id)]))};

setupCatalog().catch(error=>{console.error(error);document.querySelector("#catalog-body").textContent="Не удалось загрузить подбор. Скачайте ведомость в разделе файлов.";});
