// Grid search in plan coordinates. Every segment is sampled, including diagonals
// and the final smoothed route, so a camera cannot cut a corner through furniture.
export function clearSegment(a,b,blocked,spacing=2){
 const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/spacing));
 for(let i=0;i<=n;i++)if(blocked(a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n))return false;
 return true;
}
export function findWalkPath(start,end,blocked,bounds,step=4){
 if(blocked(...start)||blocked(...end))return null;
 if(clearSegment(start,end,blocked))return [end];
 const key=(x,y)=>x+','+y,points=new Map(),safe=new Map(),parents=new Map();
 const allowed=(x,y)=>{const k=key(x,y);if(!safe.has(k))safe.set(k,x>=bounds[0]&&x<=bounds[2]&&y>=bounds[1]&&y<=bounds[3]&&!blocked(x,y));return safe.get(k);};
 // Start is exact, and the local lattice stays aligned to it.
 const first=key(...start),queue=[first];points.set(first,start);parents.set(first,null);
 let found=null;
 for(let i=0;i<queue.length&&i<25000;i++){
  const k=queue[i],p=points.get(k);
  if(Math.hypot(p[0]-end[0],p[1]-end[1])<step*2&&clearSegment(p,end,blocked)){found=k;break;}
  for(const [dx,dy] of [[step,0],[-step,0],[0,step],[0,-step],[step,step],[-step,step],[step,-step],[-step,-step]]){
   const x=p[0]+dx,y=p[1]+dy,n=key(x,y);if(parents.has(n)||!allowed(x,y)||!clearSegment(p,[x,y],blocked))continue;
   points.set(n,[x,y]);parents.set(n,k);queue.push(n);
  }
 }
 if(!found)return null;
 const raw=[end];for(let k=found;k!==null;k=parents.get(k))raw.push(points.get(k));raw.reverse();
 const route=[];let i=0;
 while(i<raw.length-1){let j=raw.length-1;while(j>i+1&&!clearSegment(raw[i],raw[j],blocked))j--;route.push(raw[j]);i=j;}
 return route;
}
