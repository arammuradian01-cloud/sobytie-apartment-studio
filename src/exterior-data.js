// Digitised from the developer's Sobytie 6 site plan, page 12 / Pano2VR FloorPlan01.
// Map north is 270.67°. Apartment end position is inferred from the highlighted floor-10 plan.
export const calibration = {
 revision:'E02', latitude:55.69598927, longitude:37.47562426,
 modelMinusZBearing:162.6, orientationUncertaintyDegrees:10,
 apartmentFloorHeight:33.4, mapOrigin:[906,335], mapScale:.2114, mapRotation:72.6,
};
export const sections = [
 {id:'2.1',floors:28,own:true,p:[[899,321],[1071,236],[1095,309],[925,411]]},
 {id:'2.2',floors:10,p:[[1071,236],[1179,207],[1201,283],[1095,309]]},
 {id:'2.3',floors:10,p:[[1179,207],[1291,177],[1312,254],[1201,283]]},
 {id:'2.4',floors:10,p:[[1291,177],[1393,145],[1424,273],[1356,291],[1336,220],[1312,254]]},
 {id:'2.5',floors:38,p:[[1356,291],[1450,267],[1480,480],[1400,495]]},
 {id:'1.1',floors:51,later:true,p:[[344,448],[539,391],[573,469],[343,524]]},
 {id:'1.2',floors:10,later:true,p:[[539,391],[690,348],[712,426],[573,469]]},
 {id:'1.3',floors:10,later:true,p:[[690,348],[763,327],[835,490],[765,525],[712,426]]},
 {id:'2.podium',floors:2,p:[[930,417],[1012,374],[1054,517],[1118,521],[1103,628],[967,622]]},
 {id:'2.podium-east',floors:1,p:[[1363,508],[1457,493],[1447,649],[1360,643]]},
];
export function mapToWorld([x,y]) {
 const a=calibration.mapRotation*Math.PI/180,dx=(x-calibration.mapOrigin[0])*calibration.mapScale,dy=(y-calibration.mapOrigin[1])*calibration.mapScale;
 return [dx*Math.cos(a)+dy*Math.sin(a),-dx*Math.sin(a)+dy*Math.cos(a)];
}
export function geoToWorld(lat,lon){
 const east=(lon-calibration.longitude)*62748,north=(lat-calibration.latitude)*111320;
 const a=calibration.modelMinusZBearing*Math.PI/180;
 return [east*Math.cos(a)-north*Math.sin(a),-east*Math.sin(a)-north*Math.cos(a)];
}
