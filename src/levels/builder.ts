import * as THREE from 'three';
import { Physics, RAPIER } from '../core/physics';
import { loadModel } from '../core/assets';
import { GROUP, groups, PALETTE, ALL } from '../game/data';

/**
 * Helpers for building level geometry: every call registers its visuals and
 * static bodies for disposal when the level unloads.
 */
export class LevelContext {
  objects: THREE.Object3D[] = [];
  bodies: import('@dimforge/rapier3d-compat').RigidBody[] = [];
  private treeCanopyMat = new THREE.MeshStandardMaterial({ color: PALETTE.treeCanopy, roughness: 0.9 });
  private treeTrunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.treeTrunk, roughness: 0.9 });
  private roadMat = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.95 });
  private dashMat = new THREE.MeshStandardMaterial({ color: 0xc8b595, roughness: 0.8 });

  constructor(public physics: Physics, public scene: THREE.Scene) {}

  track<T extends THREE.Object3D>(o: T): T {
    this.objects.push(o);
    this.scene.add(o);
    return o;
  }

  addGround(extent = 500) {
    const mat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(extent, extent), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    this.track(mesh);
    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0, -1, 0)
    );
    const col = RAPIER.ColliderDesc.cuboid(extent / 2, 1, extent / 2)
      .setFriction(0.85)
      .setRestitution(0.05)
      .setCollisionGroups(groups(GROUP.GROUND, ALL));
    const collider = this.physics.world.createCollider(col, body);
    this.physics.tagCollider(collider, { kind: 'ground', name: 'ground', material: 'concrete' });
    this.bodies.push(body);
  }

  /** Visual road strip (the ground slab handles collision). */
  addRoad(from: THREE.Vector3, to: THREE.Vector3, width = 7) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const yaw = Math.atan2(dir.x, dir.z);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, len), this.roadMat);
    mesh.position.set(mid.x, 0.025, mid.z);
    mesh.rotation.y = yaw;
    mesh.receiveShadow = true;
    this.track(mesh);
    // Center dashes.
    const dashCount = Math.floor(len / 4);
    for (let i = 0; i < dashCount; i++) {
      const t = (i + 0.5) / dashCount;
      const p = from.clone().lerp(to, t);
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 1.6), this.dashMat);
      dash.position.set(p.x, 0.03, p.z);
      dash.rotation.y = yaw;
      this.track(dash);
    }
  }

  addBox(opts: {
    size: [number, number, number];
    position: THREE.Vector3;
    yaw?: number;
    pitch?: number;
    color?: number;
    collider?: boolean;
    material?: 'metal' | 'wood' | 'concrete';
    name?: string;
    castShadow?: boolean;
    visible?: boolean;
    mat?: THREE.Material;
  }): THREE.Mesh {
    const mat =
      opts.mat ??
      new THREE.MeshStandardMaterial({ color: opts.color ?? 0x9c8f7a, roughness: 0.85 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...opts.size), mat);
    mesh.position.copy(opts.position);
    if (opts.yaw) mesh.rotation.y = opts.yaw;
    if (opts.pitch) mesh.rotation.x = opts.pitch;
    mesh.castShadow = opts.castShadow ?? true;
    mesh.receiveShadow = true;
    if (opts.visible === false) mesh.visible = false;
    this.track(mesh);
    if (opts.collider !== false) {
      const q = new THREE.Quaternion().setFromEuler(mesh.rotation);
      const body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(opts.position.x, opts.position.y, opts.position.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      );
      const col = RAPIER.ColliderDesc.cuboid(opts.size[0] / 2, opts.size[1] / 2, opts.size[2] / 2)
        .setFriction(0.8)
        .setCollisionGroups(groups(GROUP.GROUND, ALL));
      const collider = this.physics.world.createCollider(col, body);
      this.physics.tagCollider(collider, {
        kind: 'ground',
        name: opts.name ?? 'structure',
        material: opts.material ?? 'concrete',
      });
      this.bodies.push(body);
    }
    return mesh;
  }

  async addModelStatic(opts: {
    path: string;
    position: THREE.Vector3;
    yaw?: number;
    targetLength?: number;
    targetHeight?: number;
    collider?: 'box' | 'none';
    name?: string;
    material?: 'metal' | 'wood' | 'concrete';
  }): Promise<THREE.Object3D> {
    const model = await loadModel(opts.path);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    let scale = 1;
    if (opts.targetLength) scale = opts.targetLength / Math.max(size.x, size.z);
    else if (opts.targetHeight) scale = opts.targetHeight / size.y;
    model.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
    const holder = new THREE.Group();
    model.position.set(-center.x, -box.min.y * scale, -center.z);
    holder.add(model);
    holder.position.copy(opts.position);
    if (opts.yaw) holder.rotation.y = opts.yaw;
    this.track(holder);

    if (opts.collider === 'box') {
      const q = new THREE.Quaternion().setFromEuler(holder.rotation);
      const half = size.clone().multiplyScalar(scale / 2);
      const body = this.physics.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed()
          .setTranslation(opts.position.x, opts.position.y + half.y, opts.position.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      );
      const col = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
        .setFriction(0.7)
        .setCollisionGroups(groups(GROUP.GROUND, ALL));
      const collider = this.physics.world.createCollider(col, body);
      this.physics.tagCollider(collider, {
        kind: 'ground',
        name: opts.name ?? 'structure',
        material: opts.material ?? 'concrete',
      });
      this.bodies.push(body);
    }
    return holder;
  }

  addTree(x: number, z: number, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.24 * scale, 1.6 * scale, 7), this.treeTrunkMat);
    trunk.position.y = 0.8 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.7 * scale, 1.7 * scale, 1.7 * scale), this.treeCanopyMat);
    canopy.position.y = 2.3 * scale;
    canopy.rotation.y = Math.random() * 1.5;
    canopy.castShadow = true;
    g.add(canopy);
    g.position.set(x, 0, z);
    this.track(g);
    const body = this.physics.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(x, 1.4 * scale, z)
    );
    const col = RAPIER.ColliderDesc.cuboid(0.2 * scale, 1.4 * scale, 0.2 * scale)
      .setFriction(0.7)
      .setCollisionGroups(groups(GROUP.GROUND, ALL));
    const collider = this.physics.world.createCollider(col, body);
    this.physics.tagCollider(collider, { kind: 'ground', name: 'tree', material: 'wood' });
    this.bodies.push(body);
  }

  async addBillboard(position: THREE.Vector3, yaw: number) {
    await this.addModelStatic({
      path: '/assets/models/props/billboard.glb',
      position,
      yaw,
      targetHeight: 6,
      collider: 'box',
      name: 'billboard',
      material: 'wood',
    });
  }

  /** Ring of flat orange skyscraper silhouettes for the sepia horizon. */
  addSkyline() {
    const near = new THREE.MeshBasicMaterial({ color: PALETTE.skyline, fog: true });
    const far = new THREE.MeshBasicMaterial({ color: PALETTE.skylineFar, fog: true });
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let ring = 0; ring < 2; ring++) {
      const radius = 200 + ring * 60;
      const count = 26 + ring * 8;
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + ring * 0.12;
        const w = 14 + rand() * 22;
        const h = 18 + rand() * 55;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), ring === 0 ? near : far);
        mesh.position.set(Math.cos(ang) * radius, h / 2 - 2, Math.sin(ang) * radius);
        mesh.rotation.y = rand() * 1.2;
        this.track(mesh);
      }
    }
  }

  /**
   * A circular arc of track segments in the Y/Z plane (loops, mega ramps).
   * angleFrom/angleTo in radians: 0 = bottom of circle, PI = top.
   */
  addArcTrack(opts: {
    x: number;
    zStart: number;
    radius: number;
    width: number;
    angleFrom: number;
    angleTo: number;
    segments: number;
    color?: number;
    rails?: boolean;
  }) {
    const { x, zStart, radius, width } = opts;
    const centerY = radius;
    const centerZ = zStart;
    const matA = new THREE.MeshStandardMaterial({ color: opts.color ?? 0x4a4239, roughness: 0.9 });
    const matB = new THREE.MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.85 });
    const segLen = (Math.abs(opts.angleTo - opts.angleFrom) * radius) / opts.segments + 0.35;
    for (let i = 0; i < opts.segments; i++) {
      const t = (i + 0.5) / opts.segments;
      const ang = opts.angleFrom + (opts.angleTo - opts.angleFrom) * t;
      const y = centerY - radius * Math.cos(ang);
      const z = centerZ + radius * Math.sin(ang);
      const mesh = this.addBox({
        size: [width, 0.4, segLen],
        position: new THREE.Vector3(x, y, z),
        pitch: -ang, // negative pitch raises the +Z edge
        mat: i % 4 === 3 ? matB : matA,
        name: 'track',
      });
      void mesh;
      if (opts.rails) {
        for (const side of [-1, 1]) {
          // Side rails keep the vehicle on the loop.
          const railMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 1.1, segLen),
            matA
          );
          void railMesh;
          this.addBox({
            size: [0.3, 1.2, segLen],
            position: new THREE.Vector3(
              x + side * (width / 2 + 0.15),
              y + 0.0,
              z
            ),
            pitch: -ang,
            color: 0x4a4239,
            name: 'rail',
          });
        }
      }
    }
  }

  dispose() {
    for (const b of this.bodies) this.physics.world.removeRigidBody(b);
    for (const o of this.objects) this.scene.remove(o);
    this.bodies = [];
    this.objects = [];
  }
}
