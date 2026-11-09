import * as SunCalc from 'suncalc';
import {calibration} from './exterior-data.js';
export function solarState(dateString,minutes){
 const n=Math.max(0,Math.min(1439,Number(minutes)));
 const date=new Date(`${dateString}T${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}:00+03:00`);
 if(!Number.isFinite(+date))return null;
 const {altitude,azimuth}=SunCalc.getPosition(date,calibration.latitude,calibration.longitude);
 const a=(azimuth-calibration.modelMinusZBearing)*Math.PI/180,h=altitude*Math.PI/180;
 const direction=[Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];
 const times=SunCalc.getTimes(date,calibration.latitude,calibration.longitude);
 const fmt=d=>d?new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(d):'—';
 return {date:dateString,minutes:n,time:fmt(date),altitude,azimuth,direction,sunrise:fmt(times.sunrise),sunset:fmt(times.sunset),daylight:Math.max(0,Math.min(1,(altitude+7)/20))};
}
