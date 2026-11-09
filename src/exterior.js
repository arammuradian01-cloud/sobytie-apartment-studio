import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Sky} from 'three/addons/objects/Sky.js';
import {calibration,sections,mapToWorld,geoToWorld} from './exterior-data.js';

export async function createExterior(scene){
 const root=new THREE.Group();root.name='SOBYTIE_E02_projected_surroundings';scene.add(root);
 const sky=new Sky();sky.scale.setScalar(1100);sky.material.depthWrite=false;sky.renderOrder=-10;root.add(sky);
 const su=sky.material.uniforms;su.turbidity.value=3;su.rayleigh.value=1.7;su.mieCoefficient.value=.004;su.mieDirectionalG.value=.8;
 const groundY=-calibration.apartmentFloorHeight,blockers=[],later=[];
 const plaster=new THREE.MeshStandardMaterial({color:'#b8b0a3',roughness:.8});
 const roofs=new THREE.MeshStandardMaterial({color:'#aaa79c',roughness:.95});
 const glassCanvas=document.createElement('canvas');glassCanvas.width=96;glassCanvas.height=128;
 const ctx=glassCanvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,60,128);gradient.addColorStop(0,'#9caeb4');gradient.addColorStop(.45,'#566b77');gradient.addColorStop(1,'#273d4c');ctx.fillStyle=gradient;ctx.fillRect(0,0,96,128);ctx.strokeStyle='#d4d1c8';ctx.lineWidth=6;ctx.strokeRect(1,1,94,126);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(48,0);ctx.lineTo(48,128);ctx.stroke();
 const glassTexture=new THREE.CanvasTexture(glassCanvas);glassTexture.colorSpace=THREE.SRGBColorSpace;
 const dark=new THREE.MeshStandardMaterial({map:glassTexture,roughness:.45,metalness:.1,side:THREE.DoubleSide});
 const construction=new THREE.MeshStandardMaterial({color:'#a3a09a',roughness:1});
 const pavement=new THREE.MeshStandardMaterial({color:'#c7c2b3',roughness:1});
 const lawn=new THREE.MeshStandardMaterial({color:'#667d4f',roughness:1});
 const bark=new THREE.MeshStandardMaterial({color:'#6b5847',roughness:1});
 const foliage=new THREE.MeshStandardMaterial({color:'#58724d',roughness:1});
 function poly(points,y,height,mat,parent=root){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,steps:1});geometry.rotateX(-Math.PI/2);
  const mesh=new THREE.Mesh(geometry,mat);mesh.position.y=y;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 }
 function patch(p,y,mat){return poly(p.map(mapToWorld),y,.12,mat);}
 const terrain=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),new THREE.MeshStandardMaterial({color:'#b1b5a2',roughness:1}));terrain.rotation.x=-Math.PI/2;terrain.position.y=groundY-.25;terrain.receiveShadow=true;root.add(terrain);
 patch([[80,550],[1500,700],[1490,30],[1250,10],[900,280],[40,400]],groundY,pavement);
 patch([[38,408],[1478,37],[1488,70],[50,441]],groundY+.15,new THREE.MeshStandardMaterial({color:'#6c6d69',roughness:1}));
 patch([[1110,332],[1351,272],[1390,602],[1120,620]],groundY+.3,lawn);
 patch([[380,530],[720,441],[812,530],[864,621],[400,584]],groundY+.3,lawn);
 let details=[];
 function bar(a,b,y,height,thickness,material){const length=Math.hypot(b[0]-a[0],b[1]-a[1]),m=new THREE.Mesh(new THREE.BoxGeometry(length,height,thickness),material);m.position.set((a[0]+b[0])/2,y+height/2,(a[1]+b[1])/2);m.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;}
 const facadeGroups=[];
 for(const section of sections){
  details=[];
  const points=section.p.map(mapToWorld),height=section.floors*3.45+2.1;
  const bodies=[];
  if(section.own){bodies.push(poly(points,groundY,calibration.apartmentFloorHeight-.12,plaster));// Retain the rest of the tower behind the apartment. The apartment ceiling itself
   // casts the local shadow; an approximate footprint must not create a false canopy.
   const clipped=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if(a[1]<-9)clipped.push(a);if((a[1]<-9)!==(b[1]<-9)){const t=(-9-a[1])/(b[1]-a[1]);clipped.push([a[0]+t*(b[0]-a[0]),-9]);}}
   if(clipped.length>2)bodies.push(poly(clipped,3.24,height-calibration.apartmentFloorHeight-3.24,plaster));}
  else{const mesh=poly(points,groundY,height,plaster);bodies.push(mesh);blockers.push(mesh);}
  bodies.forEach(m=>m.name='section_'+section.id);
  const edges=new THREE.Group();root.add(edges);facadeGroups.push(edges);
  // Opaque facade bodies cast shadows; window panels are thin and do not add phantom openings.
  if(!section.own)for(let i=0;i<points.length;i++){
   const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
   const count=Math.max(1,Math.round(length/1.65));
   for(let c=0;c<count;c++)for(let f=0;f<section.floors;f++){
    const t=(c+.5)/count;
    const g=new THREE.PlaneGeometry(length/count*.63,2.45);
    const m=new THREE.Mesh(g,dark);m.position.set(a[0]+dx*t+nx*.025,groundY+2.1+f*3.45,a[1]+dz*t+nz*.025);m.rotation.y=Math.atan2(nx,nz);m.updateMatrix();g.applyMatrix4(m.matrix);details.push(g);
   }
  }
  // Project podium and roof terraces, with honest approximate dimensions.
  if(!section.own)poly(points,groundY+height,.28,roofs);
  if(details.length){const m=new THREE.Mesh(mergeGeometries(details),dark);m.material.side=THREE.DoubleSide;m.receiveShadow=true;edges.add(m);details.forEach(g=>g.dispose());}
  if(section.later)later.push({bodies,edges,id:section.id});
 }
 const neighbors=await(await fetch(import.meta.env.BASE_URL+'exterior/neighbors.json')).json();
 for(const b of neighbors.buildings){
  const points=b.polygon.map(([lat,lon])=>geoToWorld(lat,lon));
  const material=new THREE.MeshStandardMaterial({color:b.heightAssumed?'#b4b1a9':b.color,roughness:.8});
  const m=poly(points,groundY,b.height,material);m.name='OSM_'+b.id;blockers.push(m);
  const geos=[];
  if(b.height>15&&!b.heightAssumed)for(let i=0;i<points.length;i++){
   const a=points[i],c=points[(i+1)%points.length],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);if(length<2)continue;
   const nx=dz/length,nz=-dx/length,count=Math.max(1,Math.round(length/2.9));
   for(let col=0;col<count;col++)for(let floor=0;floor<Math.min(60,b.levels);floor++){
    const t=(col+.5)/count,g=new THREE.PlaneGeometry(Math.min(1.6,length/count*.6),1.8),m=new THREE.Mesh(g,dark);
    m.position.set(a[0]+dx*t+nx*.04,groundY+2.3+floor*(b.height/b.levels),a[1]+dz*t+nz*.04);m.rotation.y=Math.atan2(nx,nz);m.updateMatrix();g.applyMatrix4(m.matrix);geos.push(g);
   }
  }
  if(geos.length){const windows=new THREE.Mesh(mergeGeometries(geos),dark);root.add(windows);geos.forEach(g=>g.dispose());}
 }
 const treePositions=[];
 for(let i=0;i<20;i++)treePositions.push([110+i*65,380-i*16.2]);
 for(const x of [1135,1210,1285,1350])for(const y of [365,455,555])treePositions.push([x,y]);
 for(const [i,p]of treePositions.entries()){
  const [x,z]=mapToWorld(p),h=4+(i%3)*.7;
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.10,.18,h,5),bark);trunk.position.set(x,groundY+h/2,z);root.add(trunk);
  const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.9+(i%3)*.25,1),foliage);crown.scale.set(1,1.25,1);crown.position.set(x,groundY+h,z);crown.castShadow=true;root.add(crown);
 }
 // Benches, courtyard paving and pergolas follow the site plan zones, not surveyed coordinates.
 for(const p of [[1172,406],[1267,405],[1173,505],[1282,542]]){
  const [x,z]=mapToWorld(p);const slab=new THREE.Mesh(new THREE.BoxGeometry(7,.12,4),pavement);slab.position.set(x,groundY+.45,z);root.add(slab);
  bar([x-2,z],[x+2,z],groundY+.5,.3,.65,bark);
 }
 // Mapped surrounding streets, footways and vegetation; geometry is dated, not a future survey.
 const landscape=await(await fetch(import.meta.env.BASE_URL+'exterior/landscape.json')).json();
 const roadGeos=[],footGeos=[],trunkGeos=[],leafGeos=[];
 function ribbon(a,b,width,into){const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.1)return;
  const m=new THREE.Mesh(new THREE.BoxGeometry(length,.08,width));m.position.set((a[0]+b[0])/2,groundY+.22,(a[1]+b[1])/2);m.rotation.y=-Math.atan2(dz,dx);m.updateMatrix();m.geometry.applyMatrix4(m.matrix);into.push(m.geometry);
 }
 for(const feature of landscape.features){
  const t=feature.tags,points=feature.points.map(([lat,lon])=>geoToWorld(lat,lon));
  if(t.highway){const foot=['footway','path','steps','cycleway'].includes(t.highway);const width=Number(t.width)|| (foot?1.6:t.highway==='service'?4.5:8);
   for(let i=1;i<points.length;i++)ribbon(points[i-1],points[i],width,foot?footGeos:roadGeos);
  }else if((t.landuse==='grass'||t.landuse==='recreation_ground'||t.leisure==='playground'||t.leisure==='pitch')&&points.length>3){poly(points,groundY+.07,.1,t.leisure==='playground'?new THREE.MeshStandardMaterial({color:'#a88e78',roughness:1}):lawn);}
 }
 function addTree(x,z,i){const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,4.3,5));trunk.position.set(x,groundY+2.15,z);trunk.updateMatrix();trunk.geometry.applyMatrix4(trunk.matrix);trunkGeos.push(trunk.geometry);const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,1));leaf.position.set(x,groundY+5+(i%3)*.3,z);leaf.scale.set(1,1.25,1);leaf.updateMatrix();leaf.geometry.applyMatrix4(leaf.matrix);leafGeos.push(leaf.geometry);}
 landscape.trees.forEach((t,i)=>{const [x,z]=geoToWorld(t.lat,t.lon);addTree(x,z,i);});
 // Tree rows supply real mapped alignments; exact spacing and crown size remain illustrative.
 for(const f of landscape.features.filter(f=>f.tags.natural==='tree_row'))for(let i=1;i<f.points.length;i++){const a=geoToWorld(...f.points[i-1]),b=geoToWorld(...f.points[i]),n=Math.floor(Math.hypot(b[0]-a[0],b[1]-a[1])/7);for(let j=0;j<=n;j++){const t=j/Math.max(1,n);addTree(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,j);}}
 for(const [geos,mat]of [[roadGeos,new THREE.MeshStandardMaterial({color:'#777b7a',roughness:1})],[footGeos,pavement],[trunkGeos,bark],[leafGeos,foliage]])if(geos.length){const m=new THREE.Mesh(mergeGeometries(geos),mat);m.receiveShadow=true;m.castShadow=geos===leafGeos;root.add(m);geos.forEach(g=>g.dispose());}
 let visible=false,phase='handover';
 function setVisible(value){visible=value;root.visible=value;scene.fog=value?new THREE.Fog('#b6c5ce',170,700):null;}
 function setPhase(value){phase=value;for(const item of later){item.edges.visible=value==='complete';for(const m of item.bodies)m.material=value==='handover'?construction:plaster;}}
 function updateSun(s){
  const v=new THREE.Vector3(...s.direction);su.sunPosition.value.copy(v);sky.material.uniformsNeedUpdate=true;
  foliage.color.set(new Date(s.date+'T12:00:00Z').getUTCMonth()<3||new Date(s.date+'T12:00:00Z').getUTCMonth()>10?'#898675':'#58724d');
  const daylight=s.daylight;if(scene.fog)scene.fog.color.set(s.altitude>0?'#b6c5ce':s.altitude>-7?'#887b85':'#101a2b');sky.material.uniforms.rayleigh.value=1.7;
  // At night use a neutral dark sky. Daylight mode retains physical sky scattering.
  sky.visible=s.altitude>-7;
 }
 function occlusion(point,direction){root.updateMatrixWorld(true);const ray=new THREE.Raycaster(new THREE.Vector3(...point),new THREE.Vector3(...direction),.1,800);return ray.intersectObjects(blockers,false).length>0;}
 setVisible(false);setPhase('handover');
 return {setVisible,setPhase,updateSun,occlusion,diagnostics:()=>({revision:'E02',visible,phase,sectionCount:sections.length,neighborCount:neighbors.buildings.length,source:'developer-site-plan',orientationApproximate:true})};
}
