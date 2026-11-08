export function inside(x,y,p){let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
export function distanceToEdge(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
export function polygonCollision(x,y,polygon,radius){return inside(x,y,polygon)||polygon.some((p,i)=>distanceToEdge(x,y,p,polygon[(i+1)%polygon.length])<radius);}
export function navigation(data,variant){
 const scale=data.scale_m_per_svg_unit,radius=.16/scale,floors=[...data.rooms.map(r=>r.polygon),...data.door_bridges];
 const bodies=data.variants[variant].objects.map(o=>({id:o.id,polygon:o.polygon}));
 const onFloor=(x,y)=>floors.some(p=>inside(x,y,p));
 function blocked(x,y){
  if(!onFloor(x,y))return true;
  for(let a=0;a<16;a++){const angle=a*Math.PI/8;if(!onFloor(x+radius*Math.cos(angle),y+radius*Math.sin(angle)))return true;}
  return bodies.some(o=>polygonCollision(x,y,o.polygon,radius));
 }
 function spawn(roomId,extra=()=>false){
  const room=data.rooms.find(r=>r.id===roomId),[x,y]=room.center;
  if(!blocked(x,y)&&!extra(x,y))return[x,y];
  for(let r=3;r<=85;r+=2)for(let a=0;a<40;a++){const xx=x+r*Math.cos(a*Math.PI/20),yy=y+r*Math.sin(a*Math.PI/20);if(inside(xx,yy,room.polygon)&&!blocked(xx,yy)&&!extra(xx,yy))return[xx,yy];}
  return null;
 }
 return{blocked,spawn,radius,onFloor,bodies};
}
