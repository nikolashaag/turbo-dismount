import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();

/**
 * Load a GLB once, cache the scene graph, and hand out deep clones.
 * All meshes get shadows enabled and materials are kept as-is (Kenney GLBs
 * use simple baked-palette materials that fit the flat TD look).
 */
export async function loadModel(path: string): Promise<THREE.Group> {
  let proto = modelCache.get(path);
  if (!proto) {
    const gltf = await gltfLoader.loadAsync(path);
    proto = gltf.scene;
    proto.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const mat = o.material as THREE.MeshStandardMaterial;
        if (mat && 'metalness' in mat) mat.metalness = Math.min(mat.metalness, 0.2);
      }
    });
    modelCache.set(path, proto);
  }
  return proto.clone(true);
}

export async function preloadModels(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => loadModel(p)));
}

/** Returns size of the model's bounding box (after caching). */
export function measure(object: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size;
}

const audioCache = new Map<string, AudioBuffer>();

export async function loadAudio(ctx: AudioContext, path: string): Promise<AudioBuffer> {
  const cached = audioCache.get(path);
  if (cached) return cached;
  const res = await fetch(path);
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  audioCache.set(path, buf);
  return buf;
}
