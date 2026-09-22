import * as THREE from "three";
import { BOARD_SCALE, FLOW_DELAY, curve, mix, onBoard, phase, pixel, TAU, v, writingProgress, type StripDefinition } from "./logo-story-math";

/** One original brushstroke, one mesh, one direct route. No orbit or shared river. */
export class Ribbon {
  readonly mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
  readonly center:THREE.Vector3[];
  readonly target:THREE.Vector3[];
  readonly writtenTip=v();
  private readonly targetCurve:THREE.CatmullRomCurve3;
  private readonly initial:THREE.Vector3[];
  private readonly targetSides:THREE.Vector3[];
  private readonly halfWidths:number[];
  private readonly positions:THREE.BufferAttribute;
  private readonly uv:THREE.BufferAttribute;
  private readonly fullUV:Float32Array;
  private readonly slices=88;
  private readonly cross=12;
  private lastTime=-1;

  constructor(readonly definition:StripDefinition,texture:THREE.Texture,readonly index:number){
    const targetCurve=this.targetCurve=curve(definition.points.map(p=>pixel(p[0],p[1],.19)));
    this.target=Array.from({length:this.slices+1},(_,i)=>targetCurve.getPointAt(i/this.slices));
    this.halfWidths=this.target.map((_,i)=>{
      const station=targetCurve.getUtoTmapping(i/this.slices,0)*(definition.widths.length-1),k=Math.min(definition.widths.length-2,Math.floor(station));
      return mix(definition.widths[k],definition.widths[k+1],station-k)/500;
    });
    this.initial=this.target.map(onBoard);this.center=this.target.map(p=>p.clone());
    this.targetSides=this.target.map((_,i)=>{
      const tangent=this.target[Math.min(this.slices,i+1)].clone().sub(this.target[Math.max(0,i-1)]).normalize();
      return v(-tangent.y,tangent.x);
    });
    const count=(this.slices+1)*(this.cross+1),uv=new Float32Array(count*2),colors=new Float32Array(count*3),indices:number[]=[];
    this.positions=new THREE.BufferAttribute(new Float32Array(count*3),3).setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<=this.slices;i++)for(let j=0;j<=this.cross;j++){
      const a=j/this.cross*TAU,k=i*(this.cross+1)+j;
      const source=this.target[i].clone().addScaledVector(this.targetSides[i],Math.cos(a)*this.halfWidths[i]);
      uv[k*2]=(source.x*250+512)/1024;uv[k*2+1]=1-(550-source.y*250)/1024;
      const shade=.85+.15*Math.max(0,Math.sin(a));colors.set([shade,shade,shade],k*3);
      if(i<this.slices&&j<this.cross){const n=k+this.cross+1;indices.push(k,n,k+1,k+1,n,n+1);}
    }
    const geometry=new THREE.BufferGeometry();
    this.fullUV=uv.slice();this.uv=new THREE.BufferAttribute(uv,2).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("position",this.positions);geometry.setAttribute("uv",this.uv);geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
    const material=new THREE.MeshBasicMaterial({map:texture,vertexColors:true,transparent:true,alphaTest:.07,side:THREE.DoubleSide,toneMapped:false});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.frustumCulled=false;this.update(0);
  }
  update(t:number){
    if(t===this.lastTime)return;this.lastTime=t;
    const p=v(),tangent=v(),side=v(),normal=v();
    for(let i=0;i<=this.slices;i++){
      const u=i/this.slices,progress=phase(t,this.definition.start+FLOW_DELAY+u*.10,this.definition.start+FLOW_DELAY+1.35+u*.10);
      this.center[i].copy(this.initial[i]).lerp(this.target[i],progress);
      const bow=Math.sin(Math.PI*progress);
      this.center[i].y+=bow*(this.index>2?.08:-.14)*Math.sin(u*Math.PI);
      // Shallow rear lane stays in front of the board yet behind the figure.
      // A deep negative arc would send its paint through the opaque board.
      this.center[i].z+=bow*(this.index>2?-.070:.25)+.010*bow*Math.sin(u*TAU+this.index);
    }
    for(let i=0;i<=this.slices;i++){
      const u=i/this.slices,progress=phase(t,this.definition.start+FLOW_DELAY+u*.10,this.definition.start+FLOW_DELAY+1.35+u*.10);
      tangent.copy(this.center[Math.min(this.slices,i+1)]).sub(this.center[Math.max(0,i-1)]).normalize();
      normal.set(0,0,1).addScaledVector(tangent,-tangent.z).normalize();
      if(normal.lengthSq()<.01)normal.set(0,1,0).addScaledVector(tangent,-tangent.y).normalize();
      side.crossVectors(tangent,normal).normalize().negate();
      side.lerp(this.targetSides[i],progress).normalize();
      const scale=mix(BOARD_SCALE,1,progress),halfWidth=this.halfWidths[i];
      for(let j=0;j<=this.cross;j++){
        const a=j/this.cross*TAU,k=i*(this.cross+1)+j;
        p.copy(this.center[i]).addScaledVector(side,Math.cos(a)*halfWidth*scale).addScaledVector(normal,Math.sin(a)*.030*scale);
        this.positions.setXYZ(k,p.x,p.y,p.z);
      }
    }
    const visible=this.definition.drawn&&t<1.60?writingProgress(t):1;
    this.writtenTip.copy(this.center[this.slices]);
    if(this.definition.drawn){
      (this.uv.array as Float32Array).set(this.fullUV);
      if(visible<1){
        // A fractional end ring follows the pen continuously, not one whole
        // segment at a time. The preceding complete rings remain unchanged.
        const ring=Math.ceil(this.slices*visible),source=this.targetCurve.getPointAt(visible);
        const tangent=this.targetCurve.getTangentAt(visible),edge=v(-tangent.y,tangent.x).normalize();
        const station=this.targetCurve.getUtoTmapping(visible,0)*(this.definition.widths.length-1);
        const k=Math.min(this.definition.widths.length-2,Math.floor(station));
        const halfWidth=mix(this.definition.widths[k],this.definition.widths[k+1],station-k)/500;
        this.writtenTip.copy(onBoard(source));
        for(let j=0;j<=this.cross;j++){
          const a=j/this.cross*TAU,index=ring*(this.cross+1)+j;
          const sample=source.clone().addScaledVector(edge,Math.cos(a)*halfWidth);
          this.uv.setXY(index,(sample.x*250+512)/1024,1-(550-sample.y*250)/1024);
          p.copy(onBoard(sample));p.z+=Math.sin(a)*.030*BOARD_SCALE;
          this.positions.setXYZ(index,p.x,p.y,p.z);
        }
      }
      this.uv.needsUpdate=true;
    }
    this.positions.needsUpdate=true;
    // Transparent draw sorting uses the geometry center even with culling
    // disabled. Refresh it before rendering, not as a side effect of audit.
    this.mesh.geometry.computeBoundingSphere();
    this.mesh.geometry.setDrawRange(0,Math.ceil(this.slices*visible)*this.cross*6);
  }
  valid(){return this.positions.array.every(Number.isFinite);}
}
