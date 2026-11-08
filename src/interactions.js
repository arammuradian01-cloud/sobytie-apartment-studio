import * as THREE from 'three';
export function interactions(model,camera,variant,onMessage){
 const rigs=[];model.traverse(node=>{if(node.userData.sobytie){const meta=JSON.parse(node.userData.sobytie);node.userData.restPosition??=node.position.clone();node.userData.restRotation??=node.quaternion.clone();const r={node,...meta,value:meta.initial||0,target:meta.initial||0,basePosition:node.userData.restPosition.clone(),baseRotation:node.userData.restRotation.clone()};rigs.push(r);node.traverse(c=>c.userData.interactionId=meta.id);}});
 let chosen=rigs[0];const select=document.querySelector('#object-select'),slider=document.querySelector('#opening'),label=document.querySelector('#opening-label');select.replaceChildren();
 rigs.forEach(r=>{const option=document.createElement('option');option.value=r.id;option.textContent=r.label;select.append(option);});
 const key='sobytie-P02-T01-'+variant;
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(Object.fromEntries(rigs.map(r=>[r.id,r.target]))));}catch{}};
 function sync(){if(!chosen)return;select.value=chosen.id;slider.value=Math.round(chosen.target*100);label.textContent=slider.value+'%';}
 function choose(id){chosen=rigs.find(r=>r.id===id)||rigs[0];sync();}
 function set(r,value){if(!r)return;r.target=THREE.MathUtils.clamp(value,0,1);persist();sync();}
 function apply(r,v){r.node.position.copy(r.basePosition);r.node.quaternion.copy(r.baseRotation);if(r.kind==='slide')r.node.position.add(new THREE.Vector3(r.travel[0],r.travel[2],-r.travel[1]).multiplyScalar(v));else r.node.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),r.angle*v));r.node.updateMatrixWorld(true);}
 function collision(r,x,z){const p=r.node.worldToLocal(new THREE.Vector3(x,1,z));const dx=Math.max(r.min[0]-p.x,0,p.x-r.max[0]),dy=Math.max(r.min[1]+p.z,0,-p.z-r.max[1]);return dx*dx+dy*dy<.16**2;}
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');for(const r of rigs){if(Number.isFinite(saved[r.id]))r.target=r.value=Math.max(0,Math.min(1,saved[r.id]));}}catch{}
 rigs.forEach(r=>apply(r,r.value));sync();
 select.onchange=()=>choose(select.value);slider.oninput=()=>set(chosen,Number(slider.value)/100);
 document.querySelector('#object-open').onclick=()=>set(chosen,1);document.querySelector('#object-close').onclick=()=>set(chosen,0);
 document.querySelector('#doors-open').onclick=()=>{rigs.filter(r=>r.id.endsWith('_door')).forEach(r=>r.target=1);persist();sync();onMessage('Проходные двери открываются');};
 const ray=new THREE.Raycaster();
 function pick(x,y,canvas){const b=canvas.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1),camera);const hit=ray.intersectObject(model,true).find(h=>h.object.visible&&h.object.isMesh&&!(h.object.material.clippingPlanes?.length&&h.point.y>1.10));if(!hit)return;const r=rigs.find(r=>r.id===hit.object.userData.interactionId);if(r){choose(r.id);set(r,r.target>.5?0:1);onMessage(r.label);}}
 function tick(dt,walk){for(const r of rigs){if(Math.abs(r.target-r.value)<.001)continue;const old=r.value,next=old+Math.sign(r.target-old)*Math.min(Math.abs(r.target-old),dt*1.5),wasInside=walk&&collision(r,camera.position.x,camera.position.z);apply(r,next);if(walk&&!wasInside&&collision(r,camera.position.x,camera.position.z)){apply(r,old);r.target=old;onMessage('Отойдите немного, чтобы освободить место створке.');sync();persist();}else r.value=next;}}
 return{tick,pick,blocked:(x,z)=>rigs.some(r=>collision(r,x,z)),chooseRoom(room){const r=rigs.find(r=>r.room===room);if(r)choose(r.id);},diagnostics:()=>rigs.map(r=>({id:r.id,value:r.value,target:r.target,position:r.node.position.toArray(),rotation:r.node.quaternion.toArray()}))};
}
