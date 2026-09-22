import * as THREE from "three";

// Give the inspiration beat its own breathing room, then move every later
// action together so the pen, occlusion, jump and still handoff stay in sync.
export const FLOW_DELAY = .6;
export const STORY_DURATION = 5.6 + FLOW_DELAY;
export const HANDOFF_START = 4.82 + FLOW_DELAY;
export const HANDOFF_END = 5.38 + FLOW_DELAY;
export const BOARD_EXIT_START = 2.72 + FLOW_DELAY;
export const BOARD_EXIT_END = 3.36 + FLOW_DELAY;
export const FRAME_COUNT = Math.round(STORY_DURATION * 60) + 1;
export const SOURCE = "/assets/brand/optimized/mark-768.avif";
export const TAU = Math.PI * 2;
export const clamp = (n: number) => Math.min(1, Math.max(0, n));
// Quintic easing: zero velocity AND acceleration at every settled endpoint.
export const smooth = (n: number) => { const t = clamp(n); return t*t*t*(t*(t*6-15)+10); };
export const phase = (t: number, a: number, b: number) => smooth((t - a) / (b - a));
export const mix = THREE.MathUtils.lerp;
export const v = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const pixel = (x: number, y: number, z = 0) => v((x - 512) / 250, (550 - y) / 250, z);
export const curve = (p: THREE.Vector3[]) => new THREE.CatmullRomCurve3(p, false, "centripetal");
export const BOARD_ORIGIN = v(1.19, .55, .04);
export const BOARD_SCALE = .40;
export const onBoard = (p: THREE.Vector3) => p.clone().multiplyScalar(BOARD_SCALE).add(BOARD_ORIGIN);
export const JUMP_START = 3.00 + FLOW_DELAY;
export const JUMP_END = 3.92 + FLOW_DELAY;
export const LEG_TUCK_END = 3.38 + FLOW_DELAY;
export const FLOOR_FADE_END = 3.55 + FLOW_DELAY;
export const LEFT_ARM_START = 2.02 + FLOW_DELAY;
export const LEFT_ARM_END = 3.15 + FLOW_DELAY;
export const CHARACTER_POSE_END = Math.max(2.43,LEFT_ARM_END);
export const leftArmProgress = (t:number) => phase(t,LEFT_ARM_START,LEFT_ARM_END);
export const jumpHeight = (t: number) => -.045 * Math.sin(phase(t, 2.79 + FLOW_DELAY, JUMP_START) * Math.PI)
  + .18 * Math.sin(phase(t, JUMP_START, JUMP_END) * Math.PI);

export type StripDefinition = { name: string; points: number[][]; width: number; widths:number[]; start: number; lane: number; drawn?: boolean };
export const STRIPS: StripDefinition[] = [
  { name: "橙金外弧", points: [[167,650],[221,772],[350,862],[482,885],[632,839],[743,723],[774,555],[750,456],[726,393]], widths:[2,59,83,73,85,92,78,61,2], width: 92, start: 2.02, lane: 0 },
  { name: "青蓝外弧", points: [[523,930],[635,906],[780,816],[861,685],[858,522],[800,385],[704,292],[684,284],[674,289]], widths:[2,43,80,79,73,70,58,26,2], width: 80, start: 2.16, lane: 1 },
  { name: "金黄内弧", points: [[177,642],[224,714],[312,777],[444,801],[576,769],[666,686],[704,561],[702,535]], widths:[2,72,79,81,79,62,46,2], width: 81, start: 2.30, lane: -1 },
  { name: "暖白长弧", points: [[511,222],[483,221],[322,267],[203,398],[161,552],[193,673],[277,755]], widths:[2,57,67,66,65,68,2], width: 68, start: 2.44, lane: 2 },
  { name: "石墨弧 · 最后一笔", points: [[520,290],[485,290],[366,329],[279,421],[237,510],[226,550]], widths:[2,55,91,92,57,2], width: 92, start: 2.58, lane: -2, drawn: true },
  { name: "暖白内弧", points: [[297,536],[300,558],[315,650],[386,720],[486,754],[572,739]], widths:[2,48,65,56,42,2], width: 65, start: 2.72, lane: .5 },
];

const writtenCurve = curve(STRIPS.find(s => s.drawn)!.points.map(p => pixel(p[0], p[1], .19)));
export const writingProgress = (t: number) => mix(.63, 1, phase(t, .30, 1.60));
export const nibPosition = (t: number) => onBoard(writtenCurve.getPointAt(writingProgress(t)));

export const sparkPose = (t:number,index:number) => {
  // Lower rays lead; the high star/dot follow. Rise into the original anchors
  // once, then stay still. This is shorter than the previous unfolding beat.
  const delays=[.12,.16,.04,.20,.10,.09,.02,0,.06];
  const start=1.67+delays[index],rise=phase(t,start,start+.68);
  return {scale:mix(.52,1,rise), y:-.16*(1-rise), opacity:phase(t,start,start+.42), settled:t>=start+.68};
};

export function sourceUV(g: THREE.BufferGeometry) {
  const positions = g.getAttribute("position");
  const uv = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uv[i * 2] = (positions.getX(i) * 250 + 512) / 1024;
    uv[i * 2 + 1] = 1 - (550 - positions.getY(i) * 250) / 1024;
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** Source silhouettes; fade in around their original, fixed coordinates. */
export const SPARK_OUTLINES: number[][][] = [
  [[498,116],[570,116],[570,196],[498,196]],
  [[727,80],[746,111],[777,130],[747,149],[731,181],[707,150],[676,132],[704,108]],
  [[783,214],[798,242],[821,254],[798,267],[783,291],[769,267],[746,254],[769,241]],
  [[594,94],[629,94],[629,128],[594,128]],
  [[773,162],[807,162],[807,198],[773,198]],
  [[588,138],[634,138],[634,223],[588,223]],
  [[540,197],[564,196],[577,226],[587,284],[576,291],[557,248]],
  [[600,328],[613,266],[638,217],[668,165],[690,158],[702,178],[680,214],[642,274],[617,324]],
  [[657,255],[681,224],[713,201],[738,197],[744,214],[726,236],[684,261],[663,268]],
];

export function sparkGeometry(points: number[][]) {
  const shape = new THREE.Shape(points.map(p => { const q = pixel(p[0], p[1]); return new THREE.Vector2(q.x, q.y); }));
  const geometry = new THREE.ShapeGeometry(shape);
  sourceUV(geometry);
  return geometry;
}
