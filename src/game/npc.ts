import * as THREE from 'three';
import { Physics, RAPIER } from '../core/physics';
import { loadModel } from '../core/assets';
import { GROUP, groups } from './data';

export interface NpcRouteDef {
  model: string;
  from: THREE.Vector3;
  to: THREE.Vector3;
  speed: number;
  /** Offset (0..1) along the route at spawn. */
  phase: number;
  targetLength?: number;
}

const GHOST_FILTER = GROUP.GROUND | GROUP.VEHICLE | GROUP.DUMMY | GROUP.DEBRIS;
const AWAKE_FILTER =
  GROUP.GROUND | GROUP.VEHICLE | GROUP.DUMMY | GROUP.DEBRIS | GROUP.PROP | GROUP.NPC;

let npcCounter = 0;

/**
 * Ghost traffic: kinematic cars that loop a straight route and pass through
 * each other, until something real touches them - then they become dynamic
 * and join the pileup (and can wake other ghosts in turn, like TD1).
 */
export class NpcCar {
  body!: import('@dimforge/rapier3d-compat').RigidBody;
  group = new THREE.Group();
  awakened = false;
  id: number;
  private routeLen: number;
  private dir: THREE.Vector3;
  private progress: number;
  private wheels: THREE.Object3D[] = [];
  private wheelSpin = 0;
  private halfHeight = 0.5;

  private constructor(private physics: Physics, private scene: THREE.Scene, private def: NpcRouteDef) {
    this.id = npcCounter++;
    this.dir = def.to.clone().sub(def.from).normalize();
    this.routeLen = def.to.distanceTo(def.from);
    this.progress = def.phase * this.routeLen;
  }

  static async create(physics: Physics, scene: THREE.Scene, def: NpcRouteDef): Promise<NpcCar> {
    const npc = new NpcCar(physics, scene, def);
    await npc.build();
    return npc;
  }

  private async build() {
    const model = await loadModel(`/assets/models/vehicles/${this.def.model}`);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = (this.def.targetLength ?? 4.4) / Math.max(size.x, size.z);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    this.group.add(model);
    model.traverse((o) => {
      if (o.name.startsWith('wheel')) this.wheels.push(o);
    });
    this.scene.add(this.group);

    const half = size.clone().multiplyScalar(scale * 0.5);
    this.halfHeight = half.y;
    const pos = this.positionAt(this.progress);
    const yaw = Math.atan2(this.dir.x, this.dir.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
      .setCcdEnabled(true);
    this.body = this.physics.world.createRigidBody(desc);
    const col = RAPIER.ColliderDesc.cuboid(half.x * 0.9, half.y * 0.85, half.z * 0.95)
      .setDensity((1100 * 0.5) / (8 * half.x * half.y * half.z))
      .setFriction(0.5)
      .setRestitution(0.15)
      .setCollisionGroups(groups(GROUP.NPC, GHOST_FILTER))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(800)
      .setContactSkin(0.02);
    const collider = this.physics.world.createCollider(col, this.body);
    this.physics.tagCollider(collider, { kind: 'npc', name: `npc-${this.id}`, material: 'metal', ownerId: this.id });
    this.physics.bind(this.body, this.group);
  }

  private positionAt(progress: number): THREE.Vector3 {
    return this.def.from
      .clone()
      .addScaledVector(this.dir, progress)
      .add(new THREE.Vector3(0, this.halfHeight + 0.05, 0));
  }

  fixedStep(dt: number) {
    if (this.awakened) return;
    this.progress += this.def.speed * dt;
    if (this.progress > this.routeLen) this.progress -= this.routeLen;
    const p = this.positionAt(this.progress);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
    this.wheelSpin += (this.def.speed / 0.35) * dt;
    for (const w of this.wheels) w.rotation.x = this.wheelSpin;
  }

  /** Convert to a real dynamic body that crashes. */
  awaken() {
    if (this.awakened) return;
    this.awakened = true;
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const v = this.dir.clone().multiplyScalar(this.def.speed);
    this.body.setLinvel({ x: v.x, y: v.y, z: v.z }, true);
    const collider = this.body.collider(0);
    if (collider) collider.setCollisionGroups(groups(GROUP.NPC, AWAKE_FILTER));
  }

  dispose() {
    this.physics.unbind(this.body);
    this.physics.world.removeRigidBody(this.body);
    this.scene.remove(this.group);
  }
}
