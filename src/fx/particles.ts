import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  grow: number;
  gravity: number;
  active: boolean;
}

const POOL_SIZE = 320;

/**
 * Pooled particle system for dust puffs, sparks, smoke and turbo flames.
 * TD sells impacts with physics + audio; particles stay simple and chunky.
 */
export class Particles {
  private pool: Particle[] = [];
  private dustMat: THREE.MeshBasicMaterial;
  private sparkMat: THREE.MeshBasicMaterial;
  private smokeMat: THREE.MeshBasicMaterial;
  private flameMat: THREE.MeshBasicMaterial;
  private fireMat: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xd9c4a3, transparent: true, opacity: 0.32 });
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xffae42, transparent: true, opacity: 0.95 });
    this.smokeMat = new THREE.MeshBasicMaterial({ color: 0x6b6259, transparent: true, opacity: 0.5 });
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9 });
    this.fireMat = new THREE.MeshBasicMaterial({ color: 0xff7427, transparent: true, opacity: 0.9 });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(geo, this.dustMat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.pool.push({
        mesh,
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        grow: 0,
        gravity: 0,
        active: false,
      });
    }
  }

  private emit(
    pos: THREE.Vector3,
    mat: THREE.Material,
    opts: {
      count: number;
      speed: number;
      size: number;
      life: number;
      grow?: number;
      gravity?: number;
      up?: number;
    }
  ) {
    let emitted = 0;
    for (const p of this.pool) {
      if (p.active) continue;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.material = mat;
      p.mesh.position.copy(pos);
      p.mesh.position.x += (Math.random() - 0.5) * 0.5;
      p.mesh.position.y += (Math.random() - 0.5) * 0.5;
      p.mesh.position.z += (Math.random() - 0.5) * 0.5;
      const s = opts.size * (0.6 + Math.random() * 0.8);
      p.mesh.scale.setScalar(s);
      p.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      p.vel.set(
        (Math.random() - 0.5) * opts.speed,
        (opts.up ?? 0.5) * opts.speed * Math.random(),
        (Math.random() - 0.5) * opts.speed
      );
      p.life = 0;
      p.maxLife = opts.life * (0.7 + Math.random() * 0.6);
      p.grow = opts.grow ?? 0;
      p.gravity = opts.gravity ?? 0;
      if (++emitted >= opts.count) break;
    }
  }

  dust(pos: THREE.Vector3, intensity: number) {
    this.emit(pos, this.dustMat, {
      count: Math.round(3 + intensity * 5),
      speed: 2 + intensity * 2.5,
      size: 0.18 + intensity * 0.2,
      life: 0.6,
      grow: 1.1,
    });
  }

  sparks(pos: THREE.Vector3, intensity: number) {
    this.emit(pos, this.sparkMat, {
      count: Math.round(5 + intensity * 10),
      speed: 6 + intensity * 8,
      size: 0.09,
      life: 0.45,
      gravity: -14,
    });
  }

  explosion(pos: THREE.Vector3) {
    this.emit(pos, this.fireMat, { count: 22, speed: 12, size: 0.6, life: 0.55, grow: 2.5, up: 1.2 });
    this.emit(pos, this.flameMat, { count: 16, speed: 9, size: 0.45, life: 0.4, grow: 2, up: 1.4 });
    this.emit(pos, this.smokeMat, { count: 18, speed: 5, size: 0.7, life: 1.4, grow: 2.2, up: 1.0 });
  }

  turboFlame(pos: THREE.Vector3, dir: THREE.Vector3) {
    for (const p of this.pool) {
      if (p.active) continue;
      p.active = true;
      p.mesh.visible = true;
      p.mesh.material = Math.random() > 0.5 ? this.flameMat : this.fireMat;
      p.mesh.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.2, (Math.random() - 0.5) * 0.8));
      p.mesh.scale.setScalar(0.3 + Math.random() * 0.3);
      p.vel.copy(dir).multiplyScalar(-6).add(new THREE.Vector3(0, 2 + Math.random() * 2, 0));
      p.life = 0;
      p.maxLife = 0.35;
      p.grow = 0.5;
      p.gravity = 0;
      break;
    }
  }

  smoke(pos: THREE.Vector3) {
    this.emit(pos, this.smokeMat, { count: 2, speed: 1.2, size: 0.5, life: 1.2, grow: 1.8, up: 2 });
  }

  update(dt: number) {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.grow) {
        const s = p.mesh.scale.x * (1 + p.grow * dt);
        p.mesh.scale.setScalar(s);
      }
      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      void mat;
    }
  }
}
