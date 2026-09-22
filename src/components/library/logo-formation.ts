import * as THREE from "three";
import { Character } from "./logo-character";
import { Ribbon } from "./logo-ribbon";
import { LogoCrossfade } from "./logo-crossfade";
import { BOARD_ORIGIN, BOARD_EXIT_START, BOARD_EXIT_END, CHARACTER_POSE_END, FLOOR_FADE_END, HANDOFF_START, HANDOFF_END, JUMP_END, JUMP_START, LEG_TUCK_END, leftArmProgress, nibPosition, phase, sparkPose, SPARK_OUTLINES, sparkGeometry, SOURCE, STORY_DURATION, STRIPS, v } from "./logo-story-math";
export { STORY_DURATION } from "./logo-story-math";

export type FrameMetrics = {
  time:number; finite:boolean; handClearance:number; maxRibbonStep:number; inFrame:boolean;
  nibError:number|null; starDrift:number; shoulderInversions:number;
  characterX:number; sourcePoseError:number|null;
  strokeTipError:number|null; gripError:number|null;
  leftArmProgress:number; leftHandHeight:number;
};

function rounded(w:number,h:number,r:number){
  const s=new THREE.Shape();s.moveTo(-w/2+r,-h/2);
  s.lineTo(w/2-r,-h/2);s.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
  s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
  s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
  s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  return s;
}
function block(w:number,h:number,r:number,depth:number){
  const g=new THREE.ExtrudeGeometry(rounded(w,h,r),{depth,bevelEnabled:true,bevelSegments:4,bevelSize:.018,bevelThickness:.018,curveSegments:20});
  g.translate(0,0,-depth/2);return g;
}
function ink(texture:THREE.Texture,opacity=1){
  // Alpha-test would discard the faint beginning of the fade, making stars
  // snap into view. Preserve that low-alpha detail without writing depth.
  return new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity,alphaTest:0,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
}

export class LogoScene {
  readonly scene=new THREE.Scene();
  readonly camera=new THREE.OrthographicCamera(-4,4,2.45,-2.45,.01,30);
  readonly renderer:THREE.WebGLRenderer;
  readonly character:Character;
  readonly ribbons:Ribbon[];
  readonly texture:THREE.Texture;
  private readonly board=new THREE.Group();
  private readonly boardMaterials:THREE.Material[]=[];
  private readonly stars:THREE.Mesh[]=[];
  private readonly crossfade:LogoCrossfade;
  private readonly floor:THREE.Mesh;
  private readonly previous:THREE.Vector3[][];
  private previousTime=-1;

  static async create(canvas:HTMLCanvasElement,audit=false){
    const img=new Image();img.src=SOURCE;await img.decode();return new LogoScene(canvas,img,audit);
  }
  private constructor(canvas:HTMLCanvasElement,private readonly sourceImage:HTMLImageElement,private readonly audit:boolean){
    this.texture=new THREE.Texture(sourceImage);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.needsUpdate=true;
    this.renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"default",preserveDrawingBuffer:audit});
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NeutralToneMapping;
    this.renderer.setClearColor(0xffffff,0);this.renderer.shadowMap.enabled=false;
    this.camera.position.set(0,.152,8);this.camera.lookAt(0,.152,0);
    this.scene.add(new THREE.HemisphereLight(0xffffff,0x8a95a2,1.35));
    const key=new THREE.DirectionalLight(0xfff7e7,2.6);key.position.set(-3,5,6);this.scene.add(key);
    const fill=new THREE.DirectionalLight(0xbdefff,1.1);fill.position.set(4,1,-2);this.scene.add(fill);
    this.character=new Character(this.texture);this.scene.add(this.character.group);

    const frame=new THREE.MeshPhysicalMaterial({color:0xe9e6df,roughness:.42,metalness:.22,clearcoat:.2,transparent:true});
    const face=new THREE.MeshStandardMaterial({color:0x11161b,roughness:.78,metalness:.02,transparent:true});
    const rim=new THREE.MeshStandardMaterial({color:0x343a40,roughness:.5,metalness:.25,transparent:true});
    this.boardMaterials.push(frame,face,rim);
    const backing=new THREE.Mesh(block(2.04,1.94,.10,.10),rim);
    const border=new THREE.Mesh(block(2.00,1.90,.085,.055),frame);border.position.z=.06;
    const panel=new THREE.Mesh(block(1.86,1.76,.06,.018),face);panel.position.z=.097;
    this.board.add(backing,border,panel);this.board.position.set(BOARD_ORIGIN.x,BOARD_ORIGIN.y+.0608,-.10);this.scene.add(this.board);
    this.ribbons=STRIPS.map((d,i)=>new Ribbon(d,this.texture,i));this.ribbons.forEach(r=>this.scene.add(r.mesh));
    this.previous=this.ribbons.map(r=>r.center.map(p=>p.clone()));

    SPARK_OUTLINES.forEach(outline=>{
      const g=sparkGeometry(outline);g.computeBoundingBox();const center=g.boundingBox!.getCenter(v());
      g.translate(-center.x,-center.y,0);
      const star=new THREE.Mesh(g,ink(this.texture,0));star.position.copy(center).setZ(.30);
      star.userData.fixed=star.position.clone();this.stars.push(star);this.scene.add(star);
    });

    const shadow=document.createElement("canvas");shadow.width=128;shadow.height=64;
    const ctx=shadow.getContext("2d")!,gradient=ctx.createRadialGradient(64,32,0,64,32,58);
    gradient.addColorStop(0,"rgba(26,31,38,.19)");gradient.addColorStop(1,"rgba(26,31,38,0)");
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,64);
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(2.0,.34),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadow),transparent:true,depthWrite:false}));
    this.floor.position.set(0,-1.57,-.8);this.scene.add(this.floor);
    this.crossfade=new LogoCrossfade(this.renderer,this.texture);
    this.resize(canvas.clientWidth||720,canvas.clientHeight||480);this.render(0);
  }

  resize(width:number,height:number,dpr=Math.min(devicePixelRatio||1,1.5)){
    this.renderer.setPixelRatio(dpr);this.renderer.setSize(width,height,false);
    this.crossfade.resize(this.renderer.domElement.width,this.renderer.domElement.height);
    this.camera.left=-2.45*width/height;this.camera.right=2.45*width/height;this.camera.updateProjectionMatrix();
  }

  render(t:number):FrameMetrics|null{
    t=Math.max(0,Math.min(STORY_DURATION,t));
    this.character.update(t);this.ribbons.forEach(r=>r.update(t));
    const boardExit=phase(t,BOARD_EXIT_START,BOARD_EXIT_END);
    this.boardMaterials.forEach(m=>{m.opacity=1-boardExit;});this.board.visible=boardExit<1;
    const final=phase(t,HANDOFF_START,HANDOFF_END);
    this.character.opacity(1);
    this.ribbons.forEach(r=>{r.mesh.material.opacity=1;});
    this.stars.forEach((s,i)=>{
      const pop=sparkPose(t,i);
      s.position.copy(s.userData.fixed);s.position.y+=pop.y;s.scale.setScalar(pop.scale);
      (s.material as THREE.Material).opacity=pop.opacity;
    });
    (this.floor.material as THREE.Material).opacity=1-phase(t,JUMP_START,FLOOR_FADE_END);
    this.floor.scale.setScalar(1-.2*Math.sin(phase(t,JUMP_START,JUMP_END)*Math.PI));
    this.crossfade.render(this.scene,this.camera,final);
    if(!this.audit)return null;

    let maxRibbonStep=0;
    const consecutive=t>this.previousTime&&t-this.previousTime<.04;
    this.ribbons.forEach((r,k)=>r.center.forEach((p,i)=>{
      if(consecutive)maxRibbonStep=Math.max(maxRibbonStep,p.distanceTo(this.previous[k][i]));
      this.previous[k][i].copy(p);
    }));this.previousTime=t;
    const projected=v(),inFrame=this.ribbons.every(r=>r.center.every(p=>{
      projected.copy(p).project(this.camera);return Math.abs(projected.x)<.97&&Math.abs(projected.y)<.97;
    }));
    const nibError=t<=1.60?this.character.pen.localToWorld(v(.165)).distanceTo(nibPosition(t)):null;
    const strokeTipError=t<=1.60?this.character.pen.localToWorld(v(.165)).distanceTo(this.ribbons.find(r=>r.definition.drawn)!.writtenTip):null;
    const gripError=t<=1.60?this.character.pen.position.distanceTo(this.character.rightHand):null;
    const starDrift=Math.max(...this.stars.map((s,i)=>sparkPose(t,i).settled?s.position.distanceTo(s.userData.fixed):0));
    return {time:t,finite:this.character.valid()&&this.ribbons.every(r=>r.valid()),handClearance:this.character.separation(),
      maxRibbonStep,inFrame,nibError,starDrift,shoulderInversions:this.character.shoulderInversions(),
      characterX:this.character.group.position.x,sourcePoseError:t>=Math.max(CHARACTER_POSE_END,LEG_TUCK_END)?this.character.poseError():null,strokeTipError,gripError,
      leftArmProgress:leftArmProgress(t),leftHandHeight:this.character.leftHand.y};
  }
  getSource(){return this.sourceImage;}
  dispose(){
    const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>([this.texture]);
    this.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return;geometry.add(o.geometry);
      for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);if(m.map)textures.add(m.map);}
    });
    this.crossfade.dispose();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());this.renderer.dispose();
  }
}

export async function mountLogoFormations(){
  for(const root of document.querySelectorAll<HTMLElement>("[data-logo-formation]")){
    if(root.dataset.bound==="true")continue;root.dataset.bound="true";
    const experience=root.closest<HTMLElement>("[data-library-experience]");
    const canvas=root.querySelector<HTMLCanvasElement>("canvas");
    if(!canvas)continue;
    const media=matchMedia("(prefers-reduced-motion: reduce)");
    const fallback=()=>{root.dataset.phase="fallback";if(experience)experience.dataset.logoStory="static";};
    if(media.matches || experience?.dataset.state!=="welcome"){fallback();continue;}
    try{
      const scene=await LogoScene.create(canvas);
      if(root.dataset.phase==="fallback" || experience?.dataset.state!=="welcome"){scene.dispose();fallback();continue;}
      root.dataset.phase="playing";if(experience)experience.dataset.logoStory="playing";
      let frame=0,start=performance.now(),pausedAt=0,disposed=false;
      const resize=new ResizeObserver(()=>{const r=root.getBoundingClientRect();scene.resize(r.width,r.height);});resize.observe(root);
      const cleanup=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(frame);resize.disconnect();scene.dispose();document.removeEventListener("visibilitychange",visibility);media.removeEventListener("change",finish);experience?.removeEventListener("logoformation:finish",finish);window.removeEventListener("pagehide",cleanup);};
      const finish=()=>{if(disposed)return;cancelAnimationFrame(frame);scene.render(STORY_DURATION);root.dataset.phase="static";if(experience)experience.dataset.logoStory="complete";setTimeout(cleanup,200);};
      const visibility=()=>{if(document.hidden){pausedAt=performance.now();cancelAnimationFrame(frame);}else{if(pausedAt)start+=performance.now()-pausedAt;pausedAt=0;frame=requestAnimationFrame(tick);}};
      const tick=(now:number)=>{if(disposed)return;const t=(now-start)/1000;scene.render(t);if(t>=STORY_DURATION)finish();else frame=requestAnimationFrame(tick);};
      experience?.addEventListener("logoformation:finish",finish,{once:true});media.addEventListener("change",finish);document.addEventListener("visibilitychange",visibility);window.addEventListener("pagehide",cleanup,{once:true});
      canvas.addEventListener("webglcontextlost",()=>{fallback();cleanup();},{once:true});
      frame=requestAnimationFrame(tick);
    }catch(error){console.warn("Logo animation: static fallback",error);fallback();}
  }
}
