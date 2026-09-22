import * as THREE from "three";

/** Blend completed frames, not overlapping transparent objects. This removes
 * old silhouette fringes without the dark dip of two inverse-opacity layers. */
export class LogoCrossfade {
  private readonly stillScene=new THREE.Scene();
  private readonly mixScene=new THREE.Scene();
  private readonly screenCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  private readonly liveTarget:THREE.WebGLRenderTarget;
  private readonly stillTarget:THREE.WebGLRenderTarget;
  private readonly still:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  private readonly composite:THREE.Mesh<THREE.PlaneGeometry,THREE.ShaderMaterial>;

  constructor(private readonly renderer:THREE.WebGLRenderer,texture:THREE.Texture){
    // Linear 8-bit targets lose dark paint detail at the handoff. Half-float
    // retains the source values through the colour-space round trip.
    const type=renderer.extensions.has("EXT_color_buffer_float")?THREE.HalfFloatType:THREE.UnsignedByteType;
    this.liveTarget=new THREE.WebGLRenderTarget(1,1,{samples:4,type});
    this.stillTarget=new THREE.WebGLRenderTarget(1,1,{samples:4,type});
    this.still=new THREE.Mesh(new THREE.PlaneGeometry(4.096,4.096),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false,depthTest:false,depthWrite:false}));
    this.still.position.set(0,.152,1.8);this.stillScene.add(this.still);
    const material=new THREE.ShaderMaterial({
      uniforms:{live:{value:this.liveTarget.texture},still:{value:this.stillTarget.texture},amount:{value:0}},
      vertexShader:`varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
      fragmentShader:`
        uniform sampler2D live; uniform sampler2D still; uniform float amount;
        varying vec2 screenUV;
        void main(){
          // Render targets contain premultiplied linear colour. Interpolate
          // once, convert straight colour to output space, then premultiply.
          vec4 c=mix(texture2D(live,screenUV),texture2D(still,screenUV),amount);
          gl_FragColor=vec4(c.a>0.00001?c.rgb/c.a:vec3(0.0),c.a);
          #include <colorspace_fragment>
          gl_FragColor.rgb*=gl_FragColor.a;
        }`,
      depthTest:false,depthWrite:false,toneMapped:false,
    });
    this.composite=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);this.mixScene.add(this.composite);
    renderer.compile(this.mixScene,this.screenCamera);
  }

  resize(width:number,height:number){
    this.liveTarget.setSize(width,height);this.stillTarget.setSize(width,height);
  }

  render(scene:THREE.Scene,camera:THREE.Camera,amount:number){
    if(amount<=0){this.renderer.render(scene,camera);return;}
    if(amount>=1){this.renderer.render(this.stillScene,camera);return;}
    this.renderer.setRenderTarget(this.liveTarget);this.renderer.render(scene,camera);
    this.renderer.setRenderTarget(this.stillTarget);this.renderer.render(this.stillScene,camera);
    this.renderer.setRenderTarget(null);
    this.composite.material.uniforms.amount.value=amount;
    this.renderer.render(this.mixScene,this.screenCamera);
  }

  dispose(){
    this.liveTarget.dispose();this.stillTarget.dispose();
    for(const mesh of [this.still,this.composite]){mesh.geometry.dispose();mesh.material.dispose();}
  }
}
