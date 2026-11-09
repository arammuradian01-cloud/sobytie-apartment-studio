import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WebGLRenderTarget, HalfFloatType } from 'three';

// Glass and voile must not act as opaque walls in the depth/normal pass.
class InteriorAO extends SSAOPass {
  _overrideVisibility() {
    super._overrideVisibility();
    this.scene.traverse(object => {
      if (!object.isMesh || !object.visible) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.some(material => material.transparent || material.depthWrite === false)) {
        object.visible = false;
        this._visibilityCache.push(object);
      }
    });
  }
}

export function createRealisticRenderer(renderer, scene, camera) {
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new InteriorAO(scene, camera, 512, 512, 16);
  ao.kernelRadius = .19;
  ao.minDistance = .00015;
  ao.maxDistance = .012;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  let enabled = true;
  return {
    resize(width, height) {
      composer.setSize(width, height);
      // Keep the contact-shadow buffer bounded on high-DPI mobile displays.
      const scale = Math.min(1, 950 / Math.max(width, height));
      ao.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    },
    render(walk) {
      ao.enabled = walk && enabled;
      composer.render();
    },
    setEnabled(value) { enabled = value; },
    get enabled() { return enabled; }
  };
}
