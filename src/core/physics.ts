import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export interface ContactInfo {
  /** Game-object tag of the collider that got hit. */
  tag: ColliderTag;
  otherTag: ColliderTag | null;
  force: number;
  point: THREE.Vector3;
}

export interface ColliderTag {
  kind: 'dummy' | 'vehicle' | 'prop' | 'ground' | 'sensor' | 'npc';
  /** e.g. body part name ('head', 'torso') or prop type ('ramp', 'wall'). */
  name: string;
  /** Sound material for impact audio. */
  material?: 'metal' | 'glass' | 'wood' | 'soft' | 'concrete';
  ownerId?: number;
}

/** A dynamic body whose visual is interpolated between physics steps. */
export interface Binding {
  body: RAPIER.RigidBody;
  object: THREE.Object3D;
  prevPos: THREE.Vector3;
  prevRot: THREE.Quaternion;
  currPos: THREE.Vector3;
  currRot: THREE.Quaternion;
}

let rapierReady: Promise<void> | null = null;
export function initRapier(): Promise<void> {
  if (!rapierReady) rapierReady = RAPIER.init();
  return rapierReady;
}

export class Physics {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  private tags = new Map<number, ColliderTag>();
  private bindings: Binding[] = [];

  /** Filled each step with contact-force events above threshold. */
  contacts: ContactInfo[] = [];
  /** Sensor intersections started this step (e.g. turbo pads, mines). */
  sensorHits: Array<{ sensor: ColliderTag; other: ColliderTag | null }> = [];

  constructor(gravityY = -19) {
    // Slightly heavier-than-earth gravity reads as "arcade snappy" like TD.
    this.world = new RAPIER.World({ x: 0, y: gravityY, z: 0 });
    this.world.integrationParameters.numSolverIterations = 8;
    this.eventQueue = new RAPIER.EventQueue(true);
  }

  tagCollider(collider: RAPIER.Collider, tag: ColliderTag) {
    this.tags.set(collider.handle, tag);
  }

  getTag(handle: number): ColliderTag | null {
    return this.tags.get(handle) ?? null;
  }

  /** Register a rigid body <-> visual pair for interpolated syncing. */
  bind(body: RAPIER.RigidBody, object: THREE.Object3D): Binding {
    const t = body.translation();
    const r = body.rotation();
    const binding: Binding = {
      body,
      object,
      prevPos: new THREE.Vector3(t.x, t.y, t.z),
      prevRot: new THREE.Quaternion(r.x, r.y, r.z, r.w),
      currPos: new THREE.Vector3(t.x, t.y, t.z),
      currRot: new THREE.Quaternion(r.x, r.y, r.z, r.w),
    };
    this.bindings.push(binding);
    return binding;
  }

  unbind(body: RAPIER.RigidBody) {
    this.bindings = this.bindings.filter((b) => b.body !== body);
  }

  allBindings(): Binding[] {
    return this.bindings;
  }

  step(dt: number) {
    this.world.integrationParameters.dt = dt;
    for (const b of this.bindings) {
      b.prevPos.copy(b.currPos);
      b.prevRot.copy(b.currRot);
    }
    this.world.step(this.eventQueue);
    for (const b of this.bindings) {
      const t = b.body.translation();
      const r = b.body.rotation();
      b.currPos.set(t.x, t.y, t.z);
      b.currRot.set(r.x, r.y, r.z, r.w);
    }

    this.contacts.length = 0;
    this.eventQueue.drainContactForceEvents((ev) => {
      const c1 = this.world.getCollider(ev.collider1());
      const c2 = this.world.getCollider(ev.collider2());
      if (!c1 || !c2) return;
      const tag1 = this.getTag(ev.collider1());
      const tag2 = this.getTag(ev.collider2());
      const force = ev.totalForceMagnitude();
      const mid = midpoint(c1, c2);
      if (tag1) this.contacts.push({ tag: tag1, otherTag: tag2, force, point: mid });
      if (tag2) this.contacts.push({ tag: tag2, otherTag: tag1, force, point: mid.clone() });
    });
    this.sensorHits.length = 0;
    this.eventQueue.drainCollisionEvents((h1, h2, started) => {
      if (!started) return;
      const c1 = this.world.getCollider(h1);
      const c2 = this.world.getCollider(h2);
      if (!c1 || !c2) return;
      const tag1 = this.getTag(h1);
      const tag2 = this.getTag(h2);
      if (c1.isSensor() && tag1) this.sensorHits.push({ sensor: tag1, other: tag2 });
      if (c2.isSensor() && tag2) this.sensorHits.push({ sensor: tag2, other: tag1 });
    });
  }

  /** Write interpolated transforms into the bound visuals. */
  syncVisuals(alpha: number) {
    for (const b of this.bindings) {
      b.object.position.lerpVectors(b.prevPos, b.currPos, alpha);
      b.object.quaternion.slerpQuaternions(b.prevRot, b.currRot, alpha);
    }
  }

  /** Snap visuals to current physics state (used right after spawning). */
  snapVisuals() {
    for (const b of this.bindings) {
      b.prevPos.copy(b.currPos);
      b.prevRot.copy(b.currRot);
      b.object.position.copy(b.currPos);
      b.object.quaternion.copy(b.currRot);
    }
  }

  /** Full reset: frees the world including all bodies and colliders. */
  dispose() {
    this.world.free();
    this.eventQueue.free();
    this.tags.clear();
    this.bindings = [];
  }
}

function midpoint(c1: RAPIER.Collider, c2: RAPIER.Collider): THREE.Vector3 {
  const a = c1.translation();
  const b = c2.translation();
  return new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
}

export { RAPIER };
