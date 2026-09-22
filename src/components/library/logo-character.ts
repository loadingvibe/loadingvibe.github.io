import * as THREE from "three";
import { HEAD_CENTER, HEAD_RADIUS } from "./logo-source-shape";
import { FULL_BODY_CONTOUR, fullBodyUV, loweredOffset, settledPoint } from "./logo-character-contour";
import { capTriangles } from "./logo-character-mesh";
import { CHARACTER_POSE_END, JUMP_START, jumpHeight, LEG_TUCK_END, leftArmProgress, mix, nibPosition, phase, pixel, smooth, sourceUV, TAU, v } from "./logo-story-math";

const SHOULDER=v(.12,-.17), ELBOW=v(.46,.35), WRIST=v(.604,.800);
const HEAD=pixel(HEAD_CENTER[0],HEAD_CENTER[1]);
const LEFT_WRIST=pixel(336,439),LEFT_HAND_OFFSET=loweredOffset(LEFT_WRIST);
const PEN_AXIS=v(.152,.064,0).normalize();
const PEN_REACH=.165;
const upperLength=SHOULDER.distanceTo(ELBOW), lowerLength=ELBOW.distanceTo(WRIST);
const upperRest=Math.atan2(ELBOW.y-SHOULDER.y,ELBOW.x-SHOULDER.x);
const lowerRest=Math.atan2(WRIST.y-ELBOW.y,WRIST.x-ELBOW.x);

/** Subdivide once for local joint deformation; never stretch one giant image triangle. */
function subdivide(input:THREE.BufferGeometry) {
  const raw=input.index?input.toNonIndexed():input, p=raw.getAttribute("position"), vertices:number[]=[];
  const split=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,depth:number)=>{
    const ab=a.distanceToSquared(b),bc=b.distanceToSquared(c),ca=c.distanceToSquared(a);
    if(Math.max(ab,bc,ca)<.0081||depth>8){vertices.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
    if(ab>=bc&&ab>=ca){const m=a.clone().lerp(b,.5);split(a,m,c,depth+1);split(m,b,c,depth+1);}
    else if(bc>=ca){const m=b.clone().lerp(c,.5);split(a,b,m,depth+1);split(a,m,c,depth+1);}
    else {const m=c.clone().lerp(a,.5);split(a,b,m,depth+1);split(m,b,c,depth+1);}
  };
  for(let i=0;i<p.count;i+=3)split(v().fromBufferAttribute(p,i),v().fromBufferAttribute(p,i+1),v().fromBufferAttribute(p,i+2),0);
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3).setUsage(THREE.DynamicDrawUsage));
  sourceUV(g);g.computeVertexNormals();if(raw!==input)raw.dispose();input.dispose();return g;
}

function bodyGeometry(){
  const shape=new THREE.Shape(FULL_BODY_CONTOUR.map(p=>new THREE.Vector2(p.x,p.y)));
  const g=new THREE.ExtrudeGeometry(shape,{depth:.145,bevelEnabled:true,bevelSize:.009,bevelThickness:.012,bevelSegments:4,steps:1});
  g.translate(0,0,-.035);
  const sides=subdivide(g),p=sides.getAttribute("position"),positions=capTriangles(FULL_BODY_CONTOUR,.122);
  const back=capTriangles(FULL_BODY_CONTOUR,-.047);
  for(let i=0;i<back.length;i+=9)positions.push(...back.slice(i,i+3),...back.slice(i+6,i+9),...back.slice(i+3,i+6));
  for(let i=0;i<p.count;i+=3){
    const zs=[p.getZ(i),p.getZ(i+1),p.getZ(i+2)];
    if(zs.every(z=>Math.abs(z-.122)<1e-6)||zs.every(z=>Math.abs(z+.047)<1e-6))continue;
    for(let j=0;j<3;j++)positions.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));
  }
  sides.dispose();const result=new THREE.BufferGeometry();result.setAttribute("position",new THREE.Float32BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));sourceUV(result);result.computeVertexNormals();return result;
}

function headGeometry(){
  const rings=22,sides=72,positions:number[]=[],indices:number[]=[];
  for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){
    const r=i/rings,a=j/sides*TAU;
    positions.push(HEAD.x+HEAD_RADIUS[0]/250*r*Math.cos(a),HEAD.y+HEAD_RADIUS[1]/250*r*Math.sin(a),.075+.125*Math.sqrt(1-r*r));
    if(i<rings&&j<sides){const k=i*(sides+1)+j,n=k+sides+1;indices.push(k,n,k+1,k+1,n,n+1);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);sourceUV(g);g.computeVertexNormals();return g;
}

export class Character {
  readonly group=new THREE.Group();
  readonly body:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  readonly head:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  readonly pen=new THREE.Group();
  readonly leftHand=LEFT_WRIST.clone();
  readonly rightHand=WRIST.clone();
  private readonly surface:THREE.MeshBasicMaterial;
  private readonly rest:Float32Array;
  private readonly settled:Float32Array;
  private readonly fullUV:Float32Array;
  private readonly settledUV:Float32Array;
  private readonly weights:Float32Array;
  private readonly leftOffsets:Float32Array;
  private lastPoseTime=-1;
  private readonly penMaterials:THREE.MeshStandardMaterial[]=[];

  constructor(texture:THREE.Texture){
    this.surface=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.035,side:THREE.DoubleSide,toneMapped:false});
    this.body=new THREE.Mesh(bodyGeometry(),this.surface);this.body.frustumCulled=false;
    this.rest=new Float32Array(this.body.geometry.getAttribute("position").array);
    this.settled=new Float32Array(this.rest.length);
    this.fullUV=new Float32Array(this.rest.length/3*2);
    this.settledUV=new Float32Array(this.fullUV.length);
    this.weights=new Float32Array(this.rest.length/3*2);
    this.leftOffsets=new Float32Array(this.rest.length/3*2);
    for(let i=0;i<this.rest.length/3;i++){
      const x=this.rest[i*3],y=this.rest[i*3+1];
      this.weights[i*2]=smooth((x-.055)/.22)*smooth((y+.16)/.37);
      this.weights[i*2+1]=smooth((y-.22)/.40);
      const p=v(x,y,this.rest[i*3+2]),offset=loweredOffset(p),settled=settledPoint(p),uv=fullBodyUV(p);
      this.leftOffsets.set([offset.x,offset.y],i*2);
      this.settled.set(settled.toArray(),i*3);
      this.fullUV.set([uv.x,uv.y],i*2);
      this.settledUV.set([(settled.x*250+512)/1024,1-(550-settled.y*250)/1024],i*2);
    }
    this.head=new THREE.Mesh(headGeometry(),this.surface);
    this.group.add(this.body,this.head,this.pen);
    const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.014,.014,.25,16),new THREE.MeshStandardMaterial({color:0xf8f5eb,roughness:.4}));
    barrel.rotation.z=-Math.PI/2;this.pen.add(barrel);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.014,.04,16),new THREE.MeshStandardMaterial({color:0x303639,roughness:.6}));
    tip.rotation.z=-Math.PI/2;tip.position.x=.145;this.pen.add(tip);
    this.penMaterials.push(barrel.material,tip.material);
    this.penMaterials.forEach(m=>{m.transparent=true;});
    this.update(0);
  }

  update(t:number){
    // This root NEVER has an x-translation, including anticipation and landing.
    this.group.position.set(0,jumpHeight(t),0);
    this.group.updateMatrixWorld(true);
    const poseTime=Math.min(t,Math.max(CHARACTER_POSE_END,LEG_TUCK_END)),release=phase(t,1.63,2.43);
    const leftDown=1-leftArmProgress(t),tuck=phase(t,JUMP_START,LEG_TUCK_END);
    const nib=this.group.worldToLocal(nibPosition(Math.min(t,1.60)));
    const lift=phase(t,1.62,1.86);
    const goal=nib.clone().add(v(-.055,.060,.055).multiplyScalar(lift)).addScaledVector(PEN_AXIS,-PEN_REACH);
    const delta=goal.clone().sub(SHOULDER),distance=Math.min(upperLength+lowerLength-.00001,Math.max(Math.abs(upperLength-lowerLength)+.00001,Math.hypot(delta.x,delta.y)));
    const direction=Math.atan2(delta.y,delta.x);
    const a=direction-Math.acos(THREE.MathUtils.clamp((upperLength*upperLength+distance*distance-lowerLength*lowerLength)/(2*upperLength*distance),-1,1));
    const elbow=SHOULDER.clone().add(v(Math.cos(a)*upperLength,Math.sin(a)*upperLength));
    const b=Math.atan2(goal.y-elbow.y,goal.x-elbow.x);
    const upper=(a-upperRest)*(1-release),lower=(b-lowerRest)*(1-release);
    const movedElbow=SHOULDER.clone().add(v(Math.cos(upperRest+upper)*upperLength,Math.sin(upperRest+upper)*upperLength));
    const rotate=(p:THREE.Vector3,origin:THREE.Vector3,angle:number,base:THREE.Vector3)=>{
      const x=p.x-origin.x,y=p.y-origin.y;
      return v(base.x+x*Math.cos(angle)-y*Math.sin(angle),base.y+x*Math.sin(angle)+y*Math.cos(angle),p.z);
    };
    this.rightHand.copy(rotate(WRIST,ELBOW,lower,movedElbow));this.rightHand.z=mix(goal.z,.12,release);
    this.leftHand.copy(LEFT_WRIST).addScaledVector(LEFT_HAND_OFFSET,leftDown);
    if(poseTime!==this.lastPoseTime){
      const p=this.body.geometry.getAttribute("position") as THREE.BufferAttribute;
      const uv=this.body.geometry.getAttribute("uv") as THREE.BufferAttribute;
      for(let i=0;i<p.count;i++){
        const source=v(this.rest[i*3],this.rest[i*3+1],this.rest[i*3+2]);
        let q=source.clone().lerp(v(this.settled[i*3],this.settled[i*3+1],this.settled[i*3+2]),tuck);
        if(release!==1){
          const upperPoint=rotate(source,SHOULDER,upper,SHOULDER);
          const lowerPoint=rotate(source,ELBOW,lower,movedElbow);
          q.lerp(upperPoint.lerp(lowerPoint,this.weights[i*2+1]),this.weights[i*2]);
        }
        q.x+=this.leftOffsets[i*2]*leftDown;q.y+=this.leftOffsets[i*2+1]*leftDown;
        p.setXYZ(i,q.x,q.y,q.z);
        uv.setXY(i,mix(this.fullUV[i*2],this.settledUV[i*2],tuck),mix(this.fullUV[i*2+1],this.settledUV[i*2+1],tuck));
      }
      p.needsUpdate=true;uv.needsUpdate=true;this.body.geometry.computeBoundingSphere();this.lastPoseTime=poseTime;
    }
    this.penMaterials.forEach(m=>{m.opacity=1-phase(t,1.76,2.04);});
    this.pen.visible=t<2.04;
    this.pen.quaternion.setFromUnitVectors(v(1,0,0),PEN_AXIS);
    this.pen.position.copy(this.rightHand);
  }

  opacity(n:number){this.surface.opacity=n;}
  separation(){return Math.min(this.leftHand.distanceTo(HEAD),this.rightHand.distanceTo(HEAD))-.36;}
  poseError(){
    const p=this.body.geometry.getAttribute("position");let max=0;
    for(let i=0;i<p.count;i++)max=Math.max(max,Math.hypot(p.getX(i)-this.settled[i*3],p.getY(i)-this.settled[i*3+1]));
    return max;
  }
  shoulderInversions(){
    const p=this.body.geometry.getAttribute("position");let count=0;
    for(let i=0;i<p.count;i+=3){
      const k=i*3,x=this.rest[k],y=this.rest[k+1],z=this.rest[k+2];
      if(x<-.7||x>.02||y<-.45||y>.20||z<.10)continue;
      const restArea=(this.rest[k+3]-x)*(this.rest[k+7]-y)-(this.rest[k+4]-y)*(this.rest[k+6]-x);
      const area=(p.getX(i+1)-p.getX(i))*(p.getY(i+2)-p.getY(i))-(p.getY(i+1)-p.getY(i))*(p.getX(i+2)-p.getX(i));
      if(Math.abs(restArea)>1e-7&&area*restArea< -1e-10)count++;
    }
    return count;
  }
  valid(){return this.body.geometry.getAttribute("position").array.every(Number.isFinite);}
}
