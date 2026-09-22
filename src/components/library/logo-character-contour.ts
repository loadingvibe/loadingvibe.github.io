import * as THREE from "three";
import { BODY_CONTOUR } from "./logo-source-shape";
import { phase, pixel, smooth, v } from "./logo-story-math";

// One outline from shoulder through torso, pelvis, thighs and feet. There is
// no torso hem or pair of separate capsules underneath it.
const LOWER = [
  [604,754],[601,789],[594,826],[586,870],[584,907],[582,920],
  [574,928],[562,929],[551,924],[547,914],[546,892],[544,865],
  [541,837],[537,808],[530,790],[521,784],[512,791],[506,813],
  [502,844],[497,884],[493,913],[489,924],[477,931],[465,929],
  [456,920],[451,906],[450,875],[448,837],[444,800],[441,768],
];
const raised=[...BODY_CONTOUR.slice(0,-4),...LOWER];

const raisedCurve=new THREE.CatmullRomCurve3(raised.map(p=>pixel(p[0],p[1])),true,"centripetal");
export const FULL_BODY_CONTOUR=raisedCurve.getPoints(280).slice(0,-1);
// Bend the arm along a continuous centerline. Integrating the tangent avoids
// the pinched hinge created by rotating neighboring vertices different amounts.
const base=v(-.15,-.42),axis=pixel(336,439).sub(base).normalize(),normal=v(-axis.y,axis.x);
const arcStep=.004,arc=[base.clone()];
const tangentAt=(s:number)=>{
  const angle=2.1*phase(s,0,.9),c=Math.cos(angle),sn=Math.sin(angle);
  return v(axis.x*c-axis.y*sn,axis.x*sn+axis.y*c);
};
for(let i=1;i<=500;i++)arc.push(arc[i-1].clone().addScaledVector(tangentAt((i-.5)*arcStep),arcStep));
export function loweredOffset(p:THREE.Vector3){
  const delta=p.clone().sub(base),s=delta.dot(axis),r=delta.dot(normal);
  if(s<=0||p.x>=.07)return v();
  const station=Math.min(499,s/arcStep),i=Math.floor(station),tangent=tangentAt(s);
  const center=arc[i].clone().lerp(arc[i+1],station-i);
  const target=center.addScaledVector(v(-tangent.y,tangent.x),r);target.z=p.z;
  return target.sub(p).multiplyScalar(smooth((.07-p.x)/.23));
}

// Original curved lower silhouette, used only after the legs retract behind
// the arriving brushstrokes. The head and raised-arm outline stay unchanged.
const hem=new THREE.CatmullRomCurve3([[444,739],[474,752],[513,758],[553,752],[582,742],[604,728]].map(p=>pixel(p[0],p[1])),false,"centripetal").getPoints(160);
export function settledPoint(p:THREE.Vector3){
  if(p.y>-.68)return p.clone();
  const x=THREE.MathUtils.clamp(p.x,hem[0].x,hem.at(-1)!.x);
  let y=hem.at(-1)!.y;
  for(let i=1;i<hem.length;i++)if(x<=hem[i].x){
    const a=hem[i-1],b=hem[i];y=THREE.MathUtils.lerp(a.y,b.y,(x-a.x)/(b.x-a.x));break;
  }
  return p.y<y?v(x,y,p.z):p.clone();
}

/** Continue the torso's paint through the pelvis. A C1 texture mapping slows
 * below the waist, avoiding the dark original bottom edge at the old hem. */
export function fullBodyUV(p:THREE.Vector3){
  const sx=p.x*250+512,sy=550-p.y*250;
  const paintY=sy<=650?sy:650+80*(1-Math.exp(-(sy-650)/80));
  // Lower-leg silhouette remains within the original torso's paint swatch.
  return new THREE.Vector2(sx/1024,1-paintY/1024);
}
