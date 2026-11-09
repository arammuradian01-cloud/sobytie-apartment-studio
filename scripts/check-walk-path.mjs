import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findWalkPath,clearSegment} from '../src/walk-path.js';
import {navigation} from '../src/navigation.js';
const blocked=(x,y)=>x<0||y<0||x>100||y>100||(x>40&&x<60&&y<80);
const route=findWalkPath([20,20],[80,20],blocked,[0,0,100,100]);
assert.ok(route?.length>1,'must go around a wall');
let prev=[20,20];for(const p of route){assert.ok(clearSegment(prev,p,blocked));prev=p;}
assert.equal(findWalkPath([20,20],[80,20],(x,y)=>x>=40&&x<=60,[0,0,100,100]),null,'cannot cross a sealed wall');
assert.equal(findWalkPath([20,20],[50,20],blocked,[0,0,100,100]),null,'cannot target furniture');
const data=JSON.parse(fs.readFileSync(new URL('../public/project/project.json',import.meta.url)));
for(const variant of ['A','B']){
 const nav=navigation(data,variant),start=nav.spawn('corridor');
 for(const room of data.rooms){
  const end=nav.spawn(room.id),path=findWalkPath(start,end,nav.blocked,[108,145,634,429]);
  assert.ok(path,variant+' route to '+room.id);let p=start;
  for(const q of path){assert.ok(clearSegment(p,q,nav.blocked));p=q;}
 }
}
console.log('Click routes: obstacle detour, sealed wall, blocked target, all 12 apartment room routes passed.');
