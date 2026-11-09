import fs from 'node:fs';
import assert from 'node:assert/strict';
import {navigation} from '../src/navigation.js';
const d=JSON.parse(fs.readFileSync(new URL('../public/project/project.json',import.meta.url)));
assert.equal(d.version,'P04-T06');
assert.equal(d.initial_geometry_findings.length,0);
assert(d.doors.some(x=>x.id==='entry_door'));
for(const variant of ['A','B']){
 const v=d.variants[variant],k=v.objects.find(x=>x.id==='K1'),f=v.objects.find(x=>x.id==='K2');
 assert.equal(k.w+f.w,3.55);assert.equal(k.angle,f.angle);
 assert(Math.abs(Math.hypot(f.x-k.x,f.y-k.y)*d.scale_m_per_svg_unit-k.w)<1e-8);
 const nav=navigation(d,variant);
 assert(!nav.blocked(280,300),'Removed niche must be walkable');
 assert(nav.blocked(308,370),'Bathroom wall must remain solid');
 const bytes=fs.readFileSync(new URL(`../public/models/SOBYTIE_${variant}.glb`,import.meta.url));
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));
 assert(gltf.nodes.some(n=>n.name==='Door_leaf_entry_door'));
 assert(!gltf.nodes.some(n=>['Wall_7','Wall_26'].includes(n.name)));
 assert(!gltf.nodes.some(n=>n.name?.startsWith('H2_')));
}
console.log('T06: fridge alignment, open connection, solid wall, entrance door and GLB regressions passed in A/B.');
