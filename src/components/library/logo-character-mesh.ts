import * as THREE from "three";

type Triangle=[number,number,number];
const area=(a:THREE.Vector2,b:THREE.Vector2,c:THREE.Vector2)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

/** A quality cap mesh, not recursively split long, thin earcut triangles.
 * Interior grid vertices and constrained edge flips retain the exact outline
 * while distributing the shoulder deformation across well-shaped faces. */
export function capTriangles(outline:THREE.Vector3[],z:number){
  const points=outline.map(p=>new THREE.Vector2(p.x,p.y));
  const oriented=(a:number,b:number,c:number):Triangle=>area(points[a],points[b],points[c])>=0?[a,b,c]:[a,c,b];
  const triangles=THREE.ShapeUtils.triangulateShape(points,[]).map(t=>oriented(t[0],t[1],t[2]));
  const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
  const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
  for(let y=minY+.035;y<maxY;y+=.045)for(let x=minX+.035;x<maxX;x+=.045){
    const q=new THREE.Vector2(x,y);
    // Avoid insertion onto an existing edge or too close to a boundary point.
    if(points.some(p=>p.distanceToSquared(q)<.00010))continue;
    const index=triangles.findIndex(([a,b,c])=>area(points[a],points[b],q)>1e-8&&area(points[b],points[c],q)>1e-8&&area(points[c],points[a],q)>1e-8);
    if(index<0)continue;
    const [a,b,c]=triangles[index],n=points.length;points.push(q);
    triangles[index]=[a,b,n];triangles.push([b,c,n],[c,a,n]);
  }
  for(let pass=0;pass<60;pass++){
    const edges=new Map<string,{triangle:number,a:number,b:number,c:number}>(),used=new Set<number>();let flips=0;
    triangles.forEach((t,index)=>{
      for(let j=0;j<3;j++){
        const a=t[j],b=t[(j+1)%3],c=t[(j+2)%3],key=a<b?`${a}:${b}`:`${b}:${a}`,other=edges.get(key);
        if(!other){edges.set(key,{triangle:index,a,b,c});continue;}
        if(used.has(index)||used.has(other.triangle))continue;
        const d=other.c,A=points[a],B=points[b],C=points[c],D=points[d];
        // Flip only convex quads; open boundary edges are never touched.
        if(area(C,D,A)*area(C,D,B)>=-1e-12)continue;
        const ax=A.x-D.x,ay=A.y-D.y,bx=B.x-D.x,by=B.y-D.y,cx=C.x-D.x,cy=C.y-D.y;
        const determinant=(ax*ax+ay*ay)*(bx*cy-by*cx)-(bx*bx+by*by)*(ax*cy-ay*cx)+(cx*cx+cy*cy)*(ax*by-ay*bx);
        if(determinant<=1e-12)continue;
        triangles[index]=oriented(c,d,a);triangles[other.triangle]=oriented(d,c,b);
        used.add(index);used.add(other.triangle);flips++;
      }
    });
    if(!flips)break;
  }
  const positions:number[]=[];
  for(const triangle of triangles)for(const i of triangle)positions.push(points[i].x,points[i].y,z);
  return positions;
}
