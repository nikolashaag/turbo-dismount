import * as THREE from 'three';
import { Physics, RAPIER } from '../core/physics';
import { GROUP, groups, PALETTE, PartId, PoseId } from './data';

interface PartDef {
  id: PartId;
  parent: PartId | null;
  /** Joint pivot in parent's local frame. */
  pivotInParent: THREE.Vector3;
  /** Joint pivot in this part's local frame. */
  pivotInSelf: THREE.Vector3;
  shape: { type: 'ball'; r: number } | { type: 'capsule'; hh: number; r: number };
  joint: 'spherical' | 'revolute';
  /** Hinge axis (local space) for revolute joints. */
  axis?: THREE.Vector3;
  limits?: [number, number];
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Canonical standing layout, origin at ground between feet, facing +Z.
 * All part local frames are axis-aligned in this pose, so joint anchors and
 * axes are trivially consistent.
 */
const PARTS: PartDef[] = [
  {
    id: 'pelvis', parent: null, pivotInParent: V(0, 0, 0), pivotInSelf: V(0, 0, 0),
    shape: { type: 'capsule', hh: 0.04, r: 0.14 }, joint: 'spherical',
  },
  {
    id: 'torso', parent: 'pelvis', pivotInParent: V(0, 0.10, 0), pivotInSelf: V(0, -0.20, 0),
    shape: { type: 'capsule', hh: 0.13, r: 0.16 }, joint: 'spherical',
  },
  {
    id: 'head', parent: 'torso', pivotInParent: V(0, 0.21, 0), pivotInSelf: V(0, -0.15, 0),
    shape: { type: 'ball', r: 0.12 }, joint: 'spherical',
  },
  {
    id: 'armUpperL', parent: 'torso', pivotInParent: V(-0.22, 0.13, 0), pivotInSelf: V(0, 0.14, 0),
    shape: { type: 'capsule', hh: 0.11, r: 0.05 }, joint: 'spherical',
  },
  {
    id: 'armUpperR', parent: 'torso', pivotInParent: V(0.22, 0.13, 0), pivotInSelf: V(0, 0.14, 0),
    shape: { type: 'capsule', hh: 0.11, r: 0.05 }, joint: 'spherical',
  },
  {
    id: 'armLowerL', parent: 'armUpperL', pivotInParent: V(0, -0.13, 0), pivotInSelf: V(0, 0.12, 0),
    shape: { type: 'capsule', hh: 0.10, r: 0.045 }, joint: 'revolute',
    axis: V(1, 0, 0), limits: [-2.5, 0.05],
  },
  {
    id: 'armLowerR', parent: 'armUpperR', pivotInParent: V(0, -0.13, 0), pivotInSelf: V(0, 0.12, 0),
    shape: { type: 'capsule', hh: 0.10, r: 0.045 }, joint: 'revolute',
    axis: V(1, 0, 0), limits: [-2.5, 0.05],
  },
  {
    id: 'thighL', parent: 'pelvis', pivotInParent: V(-0.09, -0.02, 0), pivotInSelf: V(0, 0.17, 0),
    shape: { type: 'capsule', hh: 0.15, r: 0.07 }, joint: 'spherical',
  },
  {
    id: 'thighR', parent: 'pelvis', pivotInParent: V(0.09, -0.02, 0), pivotInSelf: V(0, 0.17, 0),
    shape: { type: 'capsule', hh: 0.15, r: 0.07 }, joint: 'spherical',
  },
  {
    id: 'shinL', parent: 'thighL', pivotInParent: V(0, -0.17, 0), pivotInSelf: V(0, 0.16, 0),
    shape: { type: 'capsule', hh: 0.14, r: 0.055 }, joint: 'revolute',
    axis: V(1, 0, 0), limits: [-0.05, 2.4],
  },
  {
    id: 'shinR', parent: 'thighR', pivotInParent: V(0, -0.17, 0), pivotInSelf: V(0, 0.16, 0),
    shape: { type: 'capsule', hh: 0.14, r: 0.055 }, joint: 'revolute',
    axis: V(1, 0, 0), limits: [-0.05, 2.4],
  },
];

/** Per-pose joint rotations (XYZ euler, radians) keyed by part. */
interface PoseDef {
  /** Rotation applied to the whole dummy (around pelvis). */
  root: THREE.Euler;
  /** Pelvis offset from the seat anchor, in seat space. */
  offset: THREE.Vector3;
  rotations: Partial<Record<PartId, THREE.Euler>>;
  /** Parts strapped to the vehicle; breakForce is a deceleration threshold in g. */
  straps: Array<{ part: PartId; breakForce: number }>;
}

const E = (x: number, y: number, z: number) => new THREE.Euler(x, y, z);
const D = Math.PI / 180;

export const POSES: Record<PoseId, PoseDef> = {
  seated: {
    root: E(0, 0, 0),
    offset: V(0, 0.08, 0),
    rotations: {
      thighL: E(-88 * D, 0, -6 * D),
      thighR: E(-88 * D, 0, 6 * D),
      shinL: E(80 * D, 0, 0),
      shinR: E(80 * D, 0, 0),
      armUpperL: E(-42 * D, 0, -8 * D),
      armUpperR: E(-42 * D, 0, 8 * D),
      armLowerL: E(-50 * D, 0, 0),
      armLowerR: E(-50 * D, 0, 0),
      torso: E(-6 * D, 0, 0),
    },
    straps: [
      { part: 'pelvis', breakForce: 8 },
      { part: 'torso', breakForce: 8 },
      { part: 'armLowerL', breakForce: 3.5 },
      { part: 'armLowerR', breakForce: 3.5 },
    ],
  },
  superman: {
    root: E(-90 * D, 0, 0),
    offset: V(0, 0.18, 0),
    rotations: {
      armUpperL: E(-170 * D, 0, -12 * D),
      armUpperR: E(-170 * D, 0, 12 * D),
      head: E(20 * D, 0, 0),
    },
    straps: [
      { part: 'pelvis', breakForce: 6 },
      { part: 'torso', breakForce: 5 },
    ],
  },
  surfer: {
    root: E(0, -90 * D, 0),
    offset: V(0, 0.92, 0),
    rotations: {
      thighL: E(-16 * D, 0, -10 * D),
      thighR: E(-16 * D, 0, 10 * D),
      shinL: E(24 * D, 0, 0),
      shinR: E(24 * D, 0, 0),
      armUpperL: E(0, 0, -78 * D),
      armUpperR: E(0, 0, 78 * D),
      torso: E(8 * D, 0, 0),
    },
    straps: [
      { part: 'shinL', breakForce: 4.5 },
      { part: 'shinR', breakForce: 4.5 },
      // Hidden balance assist; breaks with the legs.
      { part: 'pelvis', breakForce: 5 },
    ],
  },
  clinger: {
    root: E(-78 * D, 180 * D, 0),
    offset: V(0, 0.25, 0.1),
    rotations: {
      armUpperL: E(-150 * D, 0, -55 * D),
      armUpperR: E(-150 * D, 0, 55 * D),
      thighL: E(-20 * D, 0, -28 * D),
      thighR: E(-20 * D, 0, 28 * D),
      head: E(25 * D, 0, 0),
    },
    straps: [
      { part: 'torso', breakForce: 5 },
      { part: 'pelvis', breakForce: 6.5 },
    ],
  },
};

interface DummyPart {
  def: PartDef;
  body: import('@dimforge/rapier3d-compat').RigidBody;
  collider: import('@dimforge/rapier3d-compat').Collider;
  mesh: THREE.Object3D;
}

export interface Strap {
  joint: import('@dimforge/rapier3d-compat').ImpulseJoint;
  part: PartId;
  breakForce: number;
}

const DUMMY_FILTER_ATTACHED = GROUP.GROUND | GROUP.PROP | GROUP.NPC | GROUP.DEBRIS;
const DUMMY_FILTER_FREE = DUMMY_FILTER_ATTACHED | GROUP.VEHICLE;

let dummyMaterial: THREE.MeshStandardMaterial | null = null;
let jointMaterial: THREE.MeshStandardMaterial | null = null;

export class Dummy {
  parts = new Map<PartId, DummyPart>();
  private skeletonJoints = new Map<PartId, import('@dimforge/rapier3d-compat').ImpulseJoint>();
  straps: Strap[] = [];
  group = new THREE.Group();
  attached = true;
  detachedParts = new Set<PartId>();
  /** Accumulated rotation (rad) of torso while flying, for somersault scoring. */
  spinAccum = 0;
  airborne = false;
  airtime = 0;

  constructor(
    private physics: Physics,
    scene: THREE.Scene,
    pose: PoseId,
    seatFrame: { position: THREE.Vector3; quaternion: THREE.Quaternion },
    private vehicleBody: import('@dimforge/rapier3d-compat').RigidBody | null
  ) {
    scene.add(this.group);
    if (!dummyMaterial) {
      dummyMaterial = new THREE.MeshStandardMaterial({
        color: PALETTE.dummy,
        roughness: 0.55,
        metalness: 0.05,
      });
      jointMaterial = new THREE.MeshStandardMaterial({
        color: PALETTE.dummyJoint,
        roughness: 0.7,
      });
    }

    const poseDef = POSES[pose];
    const transforms = this.computePoseTransforms(poseDef, seatFrame);

    for (const def of PARTS) {
      const t = transforms.get(def.id)!;
      this.createPart(def, t.position, t.quaternion);
    }
    this.createSkeletonJoints();
    if (vehicleBody) this.createStraps(poseDef, transforms);
    else this.attached = false;
  }

  /** Forward kinematics: canonical layout + pose rotations -> world transforms. */
  private computePoseTransforms(
    poseDef: PoseDef,
    seatFrame: { position: THREE.Vector3; quaternion: THREE.Quaternion }
  ): Map<PartId, { position: THREE.Vector3; quaternion: THREE.Quaternion }> {
    // Canonical part centers (origin at pelvis center).
    const canonical = new Map<PartId, THREE.Vector3>();
    const place = (def: PartDef): THREE.Vector3 => {
      if (canonical.has(def.id)) return canonical.get(def.id)!;
      if (!def.parent) {
        canonical.set(def.id, V(0, 0, 0));
        return canonical.get(def.id)!;
      }
      const parentDef = PARTS.find((p) => p.id === def.parent)!;
      const parentPos = place(parentDef);
      const pos = parentPos.clone().add(def.pivotInParent).sub(def.pivotInSelf);
      canonical.set(def.id, pos);
      return pos;
    };
    PARTS.forEach(place);

    const rootMat = new THREE.Matrix4().compose(
      seatFrame.position
        .clone()
        .add(poseDef.offset.clone().applyQuaternion(seatFrame.quaternion)),
      seatFrame.quaternion
        .clone()
        .multiply(new THREE.Quaternion().setFromEuler(poseDef.root)),
      V(1, 1, 1)
    );

    const result = new Map<PartId, { position: THREE.Vector3; quaternion: THREE.Quaternion }>();
    const worldMats = new Map<PartId, THREE.Matrix4>();

    const solve = (def: PartDef): THREE.Matrix4 => {
      if (worldMats.has(def.id)) return worldMats.get(def.id)!;
      const rot = poseDef.rotations[def.id];
      const localRot = new THREE.Quaternion();
      if (rot) localRot.setFromEuler(rot);

      let mat: THREE.Matrix4;
      if (!def.parent) {
        mat = rootMat.clone().multiply(
          new THREE.Matrix4().makeRotationFromQuaternion(localRot)
        );
      } else {
        const parentDef = PARTS.find((p) => p.id === def.parent)!;
        const parentMat = solve(parentDef);
        const parentCenter = canonical.get(def.parent)!;
        const selfCenter = canonical.get(def.id)!;
        void parentCenter;
        void selfCenter;
        // pivot position in parent local = pivotInParent; rotate child about it.
        const m = new THREE.Matrix4()
          .makeTranslation(def.pivotInParent.x, def.pivotInParent.y, def.pivotInParent.z)
          .multiply(new THREE.Matrix4().makeRotationFromQuaternion(localRot))
          .multiply(
            new THREE.Matrix4().makeTranslation(
              -def.pivotInSelf.x,
              -def.pivotInSelf.y,
              -def.pivotInSelf.z
            )
          );
        mat = parentMat.clone().multiply(m);
      }
      worldMats.set(def.id, mat);
      const p = new THREE.Vector3();
      const q = new THREE.Quaternion();
      const s = new THREE.Vector3();
      mat.decompose(p, q, s);
      result.set(def.id, { position: p, quaternion: q });
      return mat;
    };
    PARTS.forEach(solve);
    return result;
  }

  private createPart(def: PartDef, position: THREE.Vector3, quaternion: THREE.Quaternion) {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y, position.z)
      .setRotation({ x: quaternion.x, y: quaternion.y, z: quaternion.z, w: quaternion.w })
      .setLinearDamping(0.1)
      .setAngularDamping(1.0)
      .setCcdEnabled(true);
    if (def.id === 'pelvis') bodyDesc.setAdditionalSolverIterations(4);
    const body = this.physics.world.createRigidBody(bodyDesc);

    const colliderDesc =
      def.shape.type === 'ball'
        ? RAPIER.ColliderDesc.ball(def.shape.r)
        : RAPIER.ColliderDesc.capsule(def.shape.hh, def.shape.r);
    colliderDesc
      .setDensity(1000)
      .setFriction(0.7)
      .setRestitution(0.15)
      .setCollisionGroups(groups(GROUP.DUMMY, DUMMY_FILTER_ATTACHED))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1500)
      .setContactSkin(0.015);
    const collider = this.physics.world.createCollider(colliderDesc, body);
    this.physics.tagCollider(collider, { kind: 'dummy', name: def.id, material: 'soft' });

    const mesh = this.buildPartMesh(def);
    this.group.add(mesh);
    this.physics.bind(body, mesh);
    this.parts.set(def.id, { def, body, collider, mesh });
  }

  private buildPartMesh(def: PartDef): THREE.Object3D {
    const g = new THREE.Group();
    let geo: THREE.BufferGeometry;
    if (def.shape.type === 'ball') {
      geo = new THREE.SphereGeometry(def.shape.r, 20, 16);
    } else {
      geo = new THREE.CapsuleGeometry(def.shape.r, def.shape.hh * 2, 6, 14);
    }
    const mesh = new THREE.Mesh(geo, dummyMaterial!);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    // Visible ball joint at the pivot (artist-mannequin look).
    if (def.parent) {
      const r = def.shape.type === 'ball' ? def.shape.r * 0.55 : def.shape.r * 0.95;
      const joint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 12, 10), jointMaterial!);
      joint.position.copy(def.pivotInSelf);
      joint.castShadow = true;
      g.add(joint);
    }
    return g;
  }

  private createSkeletonJoints() {
    for (const def of PARTS) {
      if (!def.parent) continue;
      const parent = this.parts.get(def.parent)!;
      const child = this.parts.get(def.id)!;
      const a1 = def.pivotInParent;
      const a2 = def.pivotInSelf;
      let data: import('@dimforge/rapier3d-compat').JointData;
      if (def.joint === 'revolute' && def.axis) {
        data = RAPIER.JointData.revolute(
          { x: a1.x, y: a1.y, z: a1.z },
          { x: a2.x, y: a2.y, z: a2.z },
          { x: def.axis.x, y: def.axis.y, z: def.axis.z }
        );
        data.limitsEnabled = true;
        data.limits = def.limits!;
      } else {
        data = RAPIER.JointData.spherical(
          { x: a1.x, y: a1.y, z: a1.z },
          { x: a2.x, y: a2.y, z: a2.z }
        );
      }
      const joint = this.physics.world.createImpulseJoint(data, parent.body, child.body, true);
      this.skeletonJoints.set(def.id, joint);
    }
  }

  private createStraps(
    poseDef: PoseDef,
    transforms: Map<PartId, { position: THREE.Vector3; quaternion: THREE.Quaternion }>
  ) {
    if (!this.vehicleBody) return;
    const vt = this.vehicleBody.translation();
    const vr = this.vehicleBody.rotation();
    const vehiclePos = new THREE.Vector3(vt.x, vt.y, vt.z);
    const vehicleQuat = new THREE.Quaternion(vr.x, vr.y, vr.z, vr.w);
    const invVehicle = new THREE.Matrix4()
      .compose(vehiclePos, vehicleQuat, V(1, 1, 1))
      .invert();

    for (const strap of poseDef.straps) {
      const part = this.parts.get(strap.part)!;
      const t = transforms.get(strap.part)!;
      // Anchor on the vehicle = the part's current world position in vehicle space.
      const anchorInVehicle = t.position.clone().applyMatrix4(invVehicle);
      const frameInVehicle = vehicleQuat.clone().invert().multiply(t.quaternion);
      const data = RAPIER.JointData.fixed(
        { x: anchorInVehicle.x, y: anchorInVehicle.y, z: anchorInVehicle.z },
        { x: frameInVehicle.x, y: frameInVehicle.y, z: frameInVehicle.z, w: frameInVehicle.w },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0, w: 1 }
      );
      const joint = this.physics.world.createImpulseJoint(data, this.vehicleBody, part.body, true);
      this.straps.push({ joint, part: strap.part, breakForce: strap.breakForce });
    }
  }

  /** Release one strap (e.g. hands first), or all of them. */
  release(strapsToBreak?: Strap[]) {
    const list = strapsToBreak ?? [...this.straps];
    for (const s of list) {
      this.physics.world.removeImpulseJoint(s.joint, true);
      this.straps = this.straps.filter((x) => x !== s);
    }
    if (this.straps.length === 0 && this.attached) {
      this.attached = false;
      // Now the dummy can collide with the vehicle.
      for (const part of this.parts.values()) {
        part.collider.setCollisionGroups(groups(GROUP.DUMMY, DUMMY_FILTER_FREE));
      }
    }
  }

  /** Detach a limb at its skeleton joint (amputation scoring event). */
  detachPart(id: PartId): boolean {
    if (id === 'torso' || id === 'pelvis') return false;
    if (this.detachedParts.has(id)) return false;
    const joint = this.skeletonJoints.get(id);
    if (!joint) return false;
    this.physics.world.removeImpulseJoint(joint, true);
    this.skeletonJoints.delete(id);
    this.detachedParts.add(id);
    return true;
  }

  get torsoBody() {
    return this.parts.get('torso')!.body;
  }
  get pelvisPosition(): THREE.Vector3 {
    const t = this.parts.get('pelvis')!.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }
  get speed(): number {
    const v = this.torsoBody.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** Track airtime + somersault accumulation. Call once per fixed step. */
  updateFlight(dt: number, grounded: boolean) {
    if (this.attached) return;
    if (!grounded) {
      this.airborne = true;
      this.airtime += dt;
      const av = this.torsoBody.angvel();
      // Spin about horizontal axes only (somersaults, not pirouettes).
      this.spinAccum += Math.hypot(av.x, av.z) * dt;
    } else {
      this.airborne = false;
    }
  }

  /** Highest part altitude (for Space Program style levels). */
  get maxPartAltitude(): number {
    let best = 0;
    for (const p of this.parts.values()) best = Math.max(best, p.body.translation().y);
    return best;
  }

  isResting(): boolean {
    for (const p of this.parts.values()) {
      const v = p.body.linvel();
      if (Math.hypot(v.x, v.y, v.z) > 0.6) return false;
    }
    return true;
  }

  dispose(scene: THREE.Scene) {
    for (const p of this.parts.values()) {
      this.physics.unbind(p.body);
      this.physics.world.removeRigidBody(p.body);
    }
    scene.remove(this.group);
    this.parts.clear();
  }
}
