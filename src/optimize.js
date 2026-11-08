import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
export function optimize(model){
 model.updateMatrixWorld(true);const groups=new Map(),meshes=[];
 model.traverse(m=>{if(m.isMesh&&!Array.isArray(m.material))meshes.push(m);});
 for(const m of meshes){
  let parent=m.parent;while(parent&&parent!==model&&!parent.userData.sobytie)parent=parent.parent;parent||=model;
  const kind=/^Ceiling_/.test(m.name)?'ceiling':/^Lamp/.test(m.name)?'lamp':/^(Wall_|Window_|Door_)/.test(m.name)?'wall':'furniture';
  const key=[parent.uuid,m.material.uuid,kind].join('|');if(!groups.has(key))groups.set(key,{parent,mat:m.material,kind,meshes:[]});groups.get(key).meshes.push(m);
 }
 for(const g of groups.values()){
  const inv=g.parent.matrixWorld.clone().invert(),geos=[];
  for(const m of g.meshes){let geo=m.geometry.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld));if(geo.index)geo=geo.toNonIndexed();for(const name of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(name))geo.deleteAttribute(name);if(!geo.attributes.normal)geo.computeVertexNormals();if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));geos.push(geo);}
  const merged=mergeGeometries(geos);if(!merged)throw new Error('Geometry merge failed');
  const m=new THREE.Mesh(merged,g.mat.clone());m.name=g.kind+'_merged';m.userData.kind=g.kind;m.castShadow=g.kind!=='ceiling'&&!g.mat.transparent;m.receiveShadow=true;g.parent.add(m);g.meshes.forEach(x=>x.removeFromParent());geos.forEach(x=>x.dispose());
 }
 return model;
}
