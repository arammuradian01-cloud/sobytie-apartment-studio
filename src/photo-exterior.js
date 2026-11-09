import * as THREE from 'three';
import {calibration} from './exterior-data.js';

// E03 is an AI-assisted future reconstruction of the developer's location panorama.
// It is an angular backdrop, not surveyed geometry. Geometry in exterior.js still
// supplies solar occlusion and cast shadows independently of these image pixels.
export async function createPhotoExterior(scene) {
 const texture=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'exterior/sobytie-e03-future.webp');
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.wrapS=THREE.RepeatWrapping;
 const material=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,toneMapped:false,
  uniforms:{panorama:{value:texture},bearing:{value:THREE.MathUtils.degToRad(calibration.modelMinusZBearing)},daylight:{value:1},warmth:{value:0}},
  vertexShader:`varying vec3 direction;
   void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`
   uniform sampler2D panorama;
   uniform float bearing,daylight,warmth;
   varying vec3 direction;
   void main(){
    vec3 d=normalize(direction);
    float east=d.x*cos(bearing)-d.z*sin(bearing);
    float north=-d.x*sin(bearing)-d.z*cos(bearing);
    vec2 uv=vec2(fract(atan(east,north)/6.28318530718),asin(clamp(d.y,-1.,1.))/3.14159265359+.5);
    vec3 photo=texture2D(panorama,uv).rgb;
    // Approximate ambient brightness only; no claim to relight baked photo shadows.
    vec3 tint=mix(vec3(.38,.52,.78)*.018,vec3(1.),daylight);
    tint*=mix(vec3(1.),vec3(1.08,.94,.80),warmth);
    gl_FragColor=vec4(photo*tint,1.);
    #include <colorspace_fragment>
   }`
 });
 const backdrop=new THREE.Mesh(new THREE.SphereGeometry(1000,64,32),material);
 backdrop.name='SOBYTIE_E03_photographic_future';backdrop.visible=false;
 backdrop.frustumCulled=false;backdrop.renderOrder=-20;
 backdrop.onBeforeRender=(_renderer,_scene,camera)=>{backdrop.position.copy(camera.position);backdrop.updateMatrixWorld();};
 scene.add(backdrop);
 return {
  setVisible:value=>{backdrop.visible=value;},
  updateSun:s=>{material.uniforms.daylight.value=s.daylight;material.uniforms.warmth.value=s.altitude>0?Math.max(0,1-s.altitude/18):0;},
  diagnostics:()=>({loaded:true,width:texture.image.width,height:texture.image.height,visible:backdrop.visible,type:'photorealistic-future-reconstruction'})
 };
}
