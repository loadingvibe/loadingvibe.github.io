import { LogoScene, STORY_DURATION, type FrameMetrics } from "./logo-formation";
import { FRAME_COUNT, FLOW_DELAY, HANDOFF_START, HANDOFF_END, JUMP_START, JUMP_END, LEG_TUCK_END } from "./logo-story-math";
const LAST_FRAME=FRAME_COUNT-1;

const canvas=document.querySelector<HTMLCanvasElement>("#review-scene")!;
const slider=document.querySelector<HTMLInputElement>("#scrub")!;
const time=document.querySelector<HTMLOutputElement>("#time")!;
const phaseLabel=document.querySelector<HTMLElement>("#phase")!;
const pause=document.querySelector<HTMLButtonElement>("#pause")!;
const rate=document.querySelector<HTMLSelectElement>("#rate")!;
const status=document.querySelector<HTMLOutputElement>("#audit-status")!;
const sheet=document.querySelector<HTMLCanvasElement>("#contact-sheet")!;
slider.max=String(LAST_FRAME);
document.querySelector("#audit")!.textContent=`检查全部 ${FRAME_COUNT} 帧`;
const controls=Array.from(document.querySelectorAll<HTMLButtonElement|HTMLInputElement|HTMLSelectElement>("button,input,select"));
controls.forEach(control=>control.disabled=true);
const scene=await LogoScene.create(canvas,true).catch(error=>{phaseLabel.textContent="动画加载失败，请刷新重试";status.value="请使用支持 WebGL 的浏览器，或返回欢迎页查看静态 Logo。";throw error;});
controls.forEach(control=>control.disabled=false);
let current=0,playing=false,last=0,raf=0,atSheet=0;
const thumbnails:HTMLCanvasElement[]=[];
let metrics:FrameMetrics[]=[];
let gaps:number[]=[];
let slowFrames:{time:number;gap:number}[]=[];
function draw(){scene.render(current);slider.value=String(Math.round(current*60));time.value=`${current.toFixed(2)}s / ${STORY_DURATION.toFixed(2)}s · ${Math.round(current*60)}/${LAST_FRAME}`;phaseLabel.textContent=current<1.65?"01 · 完成原图最后一笔":current<2.02+FLOW_DELAY?"02 · 星光由下而上":current<JUMP_START?"03 · 独立笔触，直接归位":current<JUMP_END?"04 · 原地轻跳，遮挡收腿":current<HANDOFF_START?"05 · 原图轮廓与纹理对齐":"06 · 回到原 Logo";}
function stop(){playing=false;pause.textContent="播放";cancelAnimationFrame(raf);}
function tick(now:number){if(!playing)return;const dt=(now-last)/1000;last=now;gaps.push(dt*1000);if(dt>.05)slowFrames.push({time:current,gap:dt*1000});current=Math.min(STORY_DURATION,current+dt*Number(rate.value));draw();if(current>=STORY_DURATION){stop();reportPlayback();}else raf=requestAnimationFrame(tick);}
function play(){if(current>=STORY_DURATION)current=0;playing=true;last=performance.now();pause.textContent="暂停";raf=requestAnimationFrame(tick);}
function seek(t:number){stop();current=Math.max(0,Math.min(STORY_DURATION,t));draw();}
function reportPlayback(){if(!gaps.length)return;const sorted=gaps.slice(2).sort((a,b)=>a-b);const result={frames:sorted.length,median:sorted[Math.floor(sorted.length*.5)]||0,p95:sorted[Math.floor(sorted.length*.95)]||0,over50:sorted.filter(n=>n>50).length,slowFrames};status.dataset.playback=JSON.stringify(result);status.value=`本次播放 ${result.frames} 帧 · 帧间隔中位数 ${result.median.toFixed(1)}ms · P95 ${result.p95.toFixed(1)}ms · >50ms ${result.over50} 帧`;}
document.querySelector("#replay")!.addEventListener("click",()=>{stop();current=0;gaps=[];slowFrames=[];play();});
pause.addEventListener("click",()=>playing?stop():play());
document.querySelector("#prev")!.addEventListener("click",()=>seek(current-1/60));
document.querySelector("#next")!.addEventListener("click",()=>seek(current+1/60));
slider.addEventListener("input",()=>seek(Number(slider.value)/60));
document.querySelectorAll<HTMLButtonElement>("[data-seek]").forEach(b=>b.addEventListener("click",()=>seek(Number(b.dataset.seek))));
new ResizeObserver(()=>{scene.resize(canvas.clientWidth,canvas.clientHeight);draw();}).observe(canvas);
function showSheet(){
  sheet.hidden=false;const ctx=sheet.getContext("2d")!;ctx.fillStyle="#e9e9e5";ctx.fillRect(0,0,1440,900);
  const offset=atSheet*24;
  for(let j=0;j<24;j++){
    const frame=offset+j;if(!thumbnails[frame])break;const x=(j%6)*240,y=Math.floor(j/6)*225;
    ctx.fillStyle="#f5f5f3";ctx.fillRect(x+3,y+3,234,217);ctx.drawImage(thumbnails[frame],x+3,y+5,234,180);
    ctx.fillStyle="#333";ctx.font="12px monospace";ctx.fillText(`F${String(frame).padStart(3,"0")} · ${(frame/60).toFixed(3)}s`,x+14,y+206);
  }
  document.querySelector("#sheet-label")!.textContent=`第 ${atSheet+1} / ${Math.ceil(thumbnails.length/24)} 组 · 帧 ${offset}–${Math.min(offset+23,LAST_FRAME)}`;
}
// Compare actual canvas pixels either side of the two handoff boundaries.
// This is a continuity check, not a claim of likeness between the live model and original art.
function checkHandoff(){
  const probe=document.createElement("canvas");probe.width=canvas.width;probe.height=canvas.height;
  const ctx=probe.getContext("2d",{willReadFrequently:true})!;
  const pixels=(t:number)=>{scene.render(t);ctx.clearRect(0,0,probe.width,probe.height);ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,probe.width,probe.height).data;};
  const compare=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>{
    let sum=0,max=0,changed=0,minX=probe.width,minY=probe.height,maxX=-1,maxY=-1;
    for(let i=0;i<a.length;i+=4){let delta=0;
      // Compare premultiplied colour; fully transparent RGB is not visible.
      for(let c=0;c<3;c++)delta=Math.max(delta,Math.abs(a[i+c]*a[i+3]/255-b[i+c]*b[i+3]/255));
      delta=Math.max(delta,Math.abs(a[i+3]-b[i+3]));sum+=delta;max=Math.max(max,delta);if(delta>2){changed++;const x=i/4%probe.width,y=Math.floor(i/4/probe.width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
    }
    return {mean:sum/(a.length/4),max,changedPixelsOver2:changed,pixels:a.length/4,bounds:changed?{minX,minY,maxX,maxY}:null};
  };
  return {entry:compare(pixels(HANDOFF_START-.00001),pixels(HANDOFF_START+.00001)),exit:compare(pixels(HANDOFF_END-.00001),pixels(HANDOFF_END+.00001)),held:compare(pixels(HANDOFF_END),pixels(STORY_DURATION)),retractEnd:compare(pixels(LEG_TUCK_END-.00001),pixels(LEG_TUCK_END+.00001))};
}
document.querySelector("#audit")!.addEventListener("click",async()=>{
  stop();controls.forEach(control=>control.disabled=true);thumbnails.length=0;metrics=[];
  try{
  for(let frame=0;frame<=LAST_FRAME;frame++){
    const m=scene.render(frame/60)!;metrics.push(m);
    const thumb=document.createElement("canvas");thumb.width=312;thumb.height=240;const ctx=thumb.getContext("2d")!;
    ctx.fillStyle="#f5f5f3";ctx.fillRect(0,0,312,240);
    const height=312*canvas.height/canvas.width;ctx.drawImage(canvas,0,(240-height)/2,312,height);thumbnails.push(thumb);
    if(frame%24===0){status.value=`检查中 ${frame}/${LAST_FRAME}`;await new Promise<void>(r=>requestAnimationFrame(()=>r()));}
  }
  const finite=metrics.every(m=>m.finite),clearance=Math.min(...metrics.map(m=>m.handClearance)),step=Math.max(...metrics.map(m=>m.maxRibbonStep));
  const starDrift=Math.max(...metrics.map(m=>m.starDrift));
  const outside=metrics.filter(m=>!m.inFrame).length,nibError=Math.max(...metrics.map(m=>m.nibError??0));
  const strokeTipError=Math.max(...metrics.map(m=>m.strokeTipError??0)),gripError=Math.max(...metrics.map(m=>m.gripError??0));
  const shoulderInversions=Math.max(...metrics.map(m=>m.shoulderInversions));
  const leftArm={startHeight:metrics[0].leftHandHeight,endHeight:metrics.at(-1)!.leftHandHeight,monotonic:metrics.every((m,i)=>!i||m.leftHandHeight>=metrics[i-1].leftHandHeight-.000001)};
  const characterX=Math.max(...metrics.map(m=>Math.abs(m.characterX))),sourcePoseError=Math.max(...metrics.map(m=>m.sourcePoseError??0));
  const handoff=checkHandoff();
  status.value=`${FRAME_COUNT}/${FRAME_COUNT} 帧完成 · 非有限坐标 ${finite?0:metrics.filter(m=>!m.finite).length} · 越界 ${outside} 帧 · 人物横移 ${characterX.toFixed(6)} · 归位网格误差 ${sourcePoseError.toFixed(6)} · 星光落定后位移 ${starDrift.toFixed(6)} · 肩部三角面翻转 ${shoulderInversions} · 左手连续抬升 ${leftArm.monotonic?"是":"需检查"} · 最小手头间距 ${clearance.toFixed(3)} · 笔尖/笔迹误差 ${strokeTipError.toFixed(6)} · 最大笔触帧位移 ${step.toFixed(3)} · 收腿边界像素差 ${handoff.retractEnd.mean.toFixed(3)} · 交接边界平均像素差 ${handoff.entry.mean.toFixed(3)} / ${handoff.exit.mean.toFixed(3)} · ${Math.ceil(FRAME_COUNT/24)} 组全帧缩略图`;
  status.dataset.result=JSON.stringify({frames:FRAME_COUNT,finite,characterX,sourcePoseError,handClearance:clearance,maxRibbonStep:step,outside,nibError,strokeTipError,gripError,starDrift,shoulderInversions,leftArm,handoff});
  status.dataset.frames=JSON.stringify(metrics);
  document.querySelector<HTMLElement>("#sheet-controls")!.hidden=false;atSheet=0;showSheet();seek(current);
  }catch(error){status.value="检查未完成，请重试；本次结果不能作为完整检查结论。";console.error(error);}
  finally{controls.forEach(control=>control.disabled=false);}
});
document.querySelector("#sheet-prev")!.addEventListener("click",()=>{atSheet=Math.max(0,atSheet-1);showSheet();});
document.querySelector("#sheet-next")!.addEventListener("click",()=>{atSheet=Math.min(Math.ceil(thumbnails.length/24)-1,atSheet+1);showSheet();});
document.querySelector("#sheet-focus")!.addEventListener("click",()=>{document.body.classList.toggle("sheet-mode");document.querySelector("#sheet-focus")!.textContent=document.body.classList.contains("sheet-mode")?"返回播放器":"专注查看全帧";window.scrollTo(0,0);});
document.querySelector("#download")!.addEventListener("click",()=>{const blob=new Blob([JSON.stringify({version:7,fps:60,duration:STORY_DURATION,summary:JSON.parse(status.dataset.result||"null"),frames:metrics,playbackFrameGaps:gaps},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="loadingvibe-motion-audit.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
draw();
