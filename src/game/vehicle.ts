import * as THREE from 'three';
import { Physics, RAPIER } from '../core/physics';
import { loadModel } from '../core/assets';
import { GROUP, groups, PoseId } from './data';

export interface VehicleDef {
  id: string;
  name: string;
  desc: string;
  /** GLB under /assets/models/vehicles, or 'proc:trike' / 'proc:skate'. */
  model: string;
  targetLength: number;
  mass: number;
  maxSpeed: number;
  engineForce: number;
  /** Seat anchor in chassis local space (auto-raised by chassis half height). */
  seat: { x: number; y: number; z: number };
  poses: PoseId[];
  wheelScale?: number;
  /** Joke vehicles: hidden keel ballast + roll damping so they ride until hit. */
  stabilized?: boolean;
  /** 1..5 stat pips for the picker UI. */
  stats: { speed: number; weight: number; chaos: number };
  locked?: boolean;
}

export const VEHICLES: VehicleDef[] = [
  {
    id: 'van', name: 'Delivery Van', desc: 'The trusty all-rounder. Boxy, honest, expendable.',
    model: 'van.glb', targetLength: 4.6, mass: 1300, maxSpeed: 27, engineForce: 11000,
    seat: { x: 0, y: 0.02, z: 0.9 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 2, weight: 3, chaos: 2 },
  },
  {
    id: 'wedge', name: 'The Wedge', desc: 'Stupidly fast doorstop. Fragile, glorious.',
    model: 'sedan-sports.glb', targetLength: 4.4, mass: 850, maxSpeed: 44, engineForce: 16000,
    seat: { x: 0, y: 0.02, z: -0.2 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 5, weight: 1, chaos: 4 },
  },
  {
    id: 'taxi', name: 'Crown Cab', desc: 'The meter is running. So is the suspension.',
    model: 'taxi.glb', targetLength: 4.5, mass: 1100, maxSpeed: 31, engineForce: 11500,
    seat: { x: 0, y: 0.02, z: 0.1 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 3, weight: 2, chaos: 2 },
  },
  {
    id: 'maximus', name: 'Maximus', desc: 'Forty tons of unstoppable opinion.',
    model: 'truck.glb', targetLength: 6.8, mass: 4600, maxSpeed: 23, engineForce: 42000,
    seat: { x: 0, y: 0.02, z: 2.2 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 1, weight: 5, chaos: 4 },
  },
  {
    id: 'sasquatch', name: 'Sasquatch', desc: 'Monster wheels. Tiny braking distance interest.',
    model: 'suv.glb', targetLength: 4.9, mass: 2100, maxSpeed: 31, engineForce: 20000,
    seat: { x: 0, y: 0.02, z: 0.0 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    wheelScale: 1.85, stats: { speed: 3, weight: 4, chaos: 4 },
  },
  {
    id: 'trike', name: 'Pink Lightning', desc: "Timmy's tricycle. Zero protection, full commitment.",
    model: 'proc:trike', targetLength: 1.25, mass: 170, maxSpeed: 14, engineForce: 3000,
    seat: { x: 0, y: -0.02, z: -0.28 }, poses: ['seated', 'surfer'],
    stats: { speed: 1, weight: 1, chaos: 5 }, stabilized: true,
  },
  {
    id: 'skate', name: 'Street Slicer', desc: 'A plank, four wheels, no plan.',
    model: 'proc:skate', targetLength: 1.7, mass: 130, maxSpeed: 19, engineForce: 3200,
    seat: { x: 0, y: -0.0, z: 0 }, poses: ['surfer', 'seated', 'superman'],
    stats: { speed: 2, weight: 1, chaos: 5 }, stabilized: true,
  },
  {
    id: 'police', name: 'Sweet Justice', desc: 'Protect and serve... as a projectile.',
    model: 'police.glb', targetLength: 4.6, mass: 1150, maxSpeed: 37, engineForce: 14000,
    seat: { x: 0, y: 0.02, z: 0.1 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 4, weight: 2, chaos: 3 }, locked: true,
  },
  {
    id: 'squealer', name: 'Squealer', desc: 'A race car. The seatbelt is decorative.',
    model: 'race.glb', targetLength: 4.5, mass: 720, maxSpeed: 52, engineForce: 18000,
    seat: { x: 0, y: 0.02, z: -0.3 }, poses: ['seated', 'superman', 'surfer', 'clinger'],
    stats: { speed: 5, weight: 1, chaos: 5 }, locked: true,
  },
];

interface WheelInfo {
  mesh: THREE.Object3D;
  connection: THREE.Vector3;
  radius: number;
  isFront: boolean;
  popped: boolean;
}

const VEHICLE_RAY_GROUPS = groups(GROUP.VEHICLE, GROUP.GROUND | GROUP.PROP);

export class Vehicle {
  def: VehicleDef;
  body!: import('@dimforge/rapier3d-compat').RigidBody;
  collider!: import('@dimforge/rapier3d-compat').Collider;
  controller!: import('@dimforge/rapier3d-compat').DynamicRayCastVehicleController;
  chassis = new THREE.Group();
  wheels: WheelInfo[] = [];
  driving = false;
  crashed = false;
  targetSpeed = 0;
  steerInput = 0;
  private currentSteer = 0;
  /** Remaining boost delta-v, applied smoothly so straps survive the kick. */
  private boostDeltaV = 0;
  /** Half height of the chassis collider (for seat placement). */
  chassisHalfHeight = 0.5;

  private constructor(private physics: Physics, private scene: THREE.Scene, def: VehicleDef) {
    this.def = def;
  }

  static async create(
    physics: Physics,
    scene: THREE.Scene,
    def: VehicleDef,
    spawn: { position: THREE.Vector3; yaw: number }
  ): Promise<Vehicle> {
    const v = new Vehicle(physics, scene, def);
    await v.build(spawn);
    return v;
  }

  private async build(spawn: { position: THREE.Vector3; yaw: number }) {
    const { bodyNode, wheelNodes } = await this.loadParts();

    // Normalize scale so the model is def.targetLength long.
    const fullBox = new THREE.Box3().setFromObject(bodyNode);
    for (const w of wheelNodes) fullBox.expandByObject(w);
    const size = fullBox.getSize(new THREE.Vector3());
    const length = Math.max(size.x, size.z);
    const scale = this.def.targetLength / length;

    const bodyBox = new THREE.Box3().setFromObject(bodyNode);
    const bodyCenter = bodyBox.getCenter(new THREE.Vector3());
    const bodySize = bodyBox.getSize(new THREE.Vector3());

    // Chassis origin = body bbox center (scaled).
    bodyNode.position.sub(bodyCenter);
    bodyNode.scale.multiplyScalar(scale);
    bodyNode.position.multiplyScalar(scale);
    this.chassis.add(bodyNode);

    const half = bodySize.clone().multiplyScalar(scale * 0.5);
    this.chassisHalfHeight = half.y;

    const wheelScale = this.def.wheelScale ?? 1;
    for (const w of wheelNodes) {
      const wBox = new THREE.Box3().setFromObject(w);
      const wCenter = wBox.getCenter(new THREE.Vector3());
      const wSize = wBox.getSize(new THREE.Vector3());
      const radius = (Math.max(wSize.y, wSize.z) / 2) * scale * wheelScale;
      const local = wCenter.sub(bodyCenter).multiplyScalar(scale);
      if (wheelScale !== 1) local.y += radius * (wheelScale - 1) * 0.55;
      const holder = new THREE.Group();
      holder.position.copy(local);
      w.position.set(0, 0, 0);
      w.scale.multiplyScalar(scale * wheelScale);
      // Center the wheel mesh in its holder.
      const wc = new THREE.Box3().setFromObject(w).getCenter(new THREE.Vector3());
      w.position.sub(wc);
      holder.add(w);
      this.chassis.add(holder);
      this.wheels.push({
        mesh: holder,
        connection: local.clone(),
        radius,
        isFront: w.name.includes('front'),
        popped: false,
      });
    }
    // Raise chassis if monster wheels would overlap the body.
    this.scene.add(this.chassis);

    // Spawn height: every wheel must rest on the ground within suspension reach.
    const restLength = 0.18;
    const originY =
      spawn.position.y +
      Math.max(...this.wheels.map((w) => w.radius - w.connection.y)) +
      restLength * 0.3;

    const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spawn.yaw);
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(spawn.position.x, originY, spawn.position.z)
      .setRotation({ x: yawQuat.x, y: yawQuat.y, z: yawQuat.z, w: yawQuat.w })
      .setLinearDamping(0.05)
      .setAngularDamping(this.def.stabilized ? 3.5 : 0.8)
      .setCcdEnabled(true)
      .setAdditionalSolverIterations(2);
    this.body = this.physics.world.createRigidBody(bodyDesc);

    const keel = this.def.stabilized ?? false;
    const volume = 8 * half.x * half.y * half.z;
    const mainDensity = (this.def.mass * (keel ? 0.25 : 0.65)) / volume;
    const colliderDesc = RAPIER.ColliderDesc.cuboid(half.x * 0.92, half.y * 0.88, half.z * 0.96)
      .setDensity(mainDensity)
      .setFriction(0.6)
      .setRestitution(0.1)
      .setCollisionGroups(groups(GROUP.VEHICLE, GROUP.GROUND | GROUP.PROP | GROUP.NPC | GROUP.DEBRIS | GROUP.DUMMY | GROUP.VEHICLE))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(5000)
      .setContactSkin(0.02);
    this.collider = this.physics.world.createCollider(colliderDesc, this.body);
    this.physics.tagCollider(this.collider, { kind: 'vehicle', name: this.def.id, material: 'metal' });

    // Ballast: low slab keeping the center of mass down. Joke vehicles get a
    // deep keel holding most of their mass so the dummy doesn't tip them.
    const ballastShare = keel ? 0.75 : 0.35;
    const ballastY = keel ? -half.y * 1.6 : -half.y * 0.75;
    const ballastVol = 8 * half.x * 0.5 * (half.y * 0.2) * (half.z * 0.5);
    const ballast = RAPIER.ColliderDesc.cuboid(half.x * 0.5, half.y * 0.2, half.z * 0.5)
      .setTranslation(0, ballastY, 0)
      .setDensity((this.def.mass * ballastShare) / ballastVol)
      .setCollisionGroups(groups(GROUP.VEHICLE, GROUP.GROUND))
      .setFriction(0.5);
    this.physics.world.createCollider(ballast, this.body);

    this.physics.bind(this.body, this.chassis);

    // Raycast vehicle controller.
    this.controller = this.physics.world.createVehicleController(this.body);
    const suspensionRest = 0.18;
    this.wheels.forEach((w, i) => {
      this.controller.addWheel(
        { x: w.connection.x, y: w.connection.y + suspensionRest * 0.6, z: w.connection.z },
        { x: 0, y: -1, z: 0 },
        { x: -1, y: 0, z: 0 },
        suspensionRest,
        w.radius
      );
      this.controller.setWheelSuspensionStiffness(i, 38);
      this.controller.setWheelFrictionSlip(i, 90);
      this.controller.setWheelSideFrictionStiffness(i, 0.9);
      this.controller.setWheelSuspensionCompression(i, 2.2);
      this.controller.setWheelSuspensionRelaxation(i, 2.6);
      this.controller.setWheelMaxSuspensionTravel(i, 0.32);
      // High cap so loops can supply centripetal force through the wheels.
      this.controller.setWheelMaxSuspensionForce(i, this.def.mass * 130);
    });
  }

  private async loadParts(): Promise<{ bodyNode: THREE.Object3D; wheelNodes: THREE.Object3D[] }> {
    if (this.def.model === 'proc:trike') return buildTrike();
    if (this.def.model === 'proc:skate') return buildSkateboard();
    const model = await loadModel(`/assets/models/vehicles/${this.def.model}`);
    let bodyNode: THREE.Object3D | null = null;
    const wheelNodes: THREE.Object3D[] = [];
    // Direct children are 'body' and 'wheel-*' in Kenney car kit GLBs.
    for (const child of [...model.children]) {
      if (child.name.startsWith('wheel')) wheelNodes.push(child);
      else bodyNode = child;
    }
    if (!bodyNode) bodyNode = model;
    bodyNode.removeFromParent();
    wheelNodes.forEach((w) => w.removeFromParent());
    return { bodyNode, wheelNodes };
  }

  /** World transform for the dummy seat anchor. */
  seatFrame(): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
    const t = this.body.translation();
    const r = this.body.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const local = new THREE.Vector3(this.def.seat.x, this.def.seat.y + this.chassisHalfHeight, this.def.seat.z);
    return {
      position: new THREE.Vector3(t.x, t.y, t.z).add(local.applyQuaternion(q)),
      quaternion: q,
    };
  }

  launch(power: number) {
    this.driving = true;
    this.targetSpeed = this.def.maxSpeed * (0.25 + 0.75 * power);
  }

  /** Turbo pad: adds deltaV m/s spread over ~0.35s of simulated time. */
  applyBoost(deltaV: number) {
    this.boostDeltaV += deltaV;
  }

  /** Called before each world.step. */
  fixedStep(dt: number) {
    if (!this.driving || this.crashed) return;
    if (this.boostDeltaV > 0) {
      const dv = Math.min(this.boostDeltaV, (9 / 0.6) * dt);
      this.boostDeltaV -= dv;
      const rot = this.body.rotation();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(
        new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
      );
      fwd.y = 0;
      fwd.normalize().multiplyScalar(this.body.mass() * dv);
      this.body.applyImpulse({ x: fwd.x, y: 0, z: fwd.z }, true);
    }
    const speed = this.speed;
    const force = speed < this.targetSpeed ? this.def.engineForce : 0;
    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, this.steerInput * 0.55, 0.12);
    this.wheels.forEach((w, i) => {
      if (!w.isFront) this.controller.setWheelEngineForce(i, force / 2);
      else this.controller.setWheelSteering(i, this.currentSteer);
    });
    this.controller.updateVehicle(dt, undefined, VEHICLE_RAY_GROUPS);
  }

  /** Sync wheel visuals from controller state. Call after stepping. */
  syncWheels() {
    if (this.crashed) return;
    this.wheels.forEach((w, i) => {
      if (w.popped) return;
      const conn = this.controller.wheelChassisConnectionPointCs(i);
      const len = this.controller.wheelSuspensionLength(i) ?? 0.18;
      if (conn) w.mesh.position.set(conn.x, conn.y - len, conn.z);
      const steer = this.controller.wheelSteering(i) ?? 0;
      const roll = this.controller.wheelRotation(i) ?? 0;
      w.mesh.quaternion
        .setFromAxisAngle(new THREE.Vector3(0, 1, 0), steer)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(-1, 0, 0), roll));
    });
  }

  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** True when at least one wheel ray touches the ground. */
  get grounded(): boolean {
    for (let i = 0; i < this.wheels.length; i++) {
      const inContact = (
        this.controller as unknown as { wheelIsInContact?: (i: number) => boolean }
      ).wheelIsInContact?.(i);
      if (inContact) return true;
    }
    return false;
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get velocity(): THREE.Vector3 {
    const v = this.body.linvel();
    return new THREE.Vector3(v.x, v.y, v.z);
  }

  markCrashed() {
    if (this.crashed) return;
    this.crashed = true;
    this.driving = false;
  }

  /**
   * Pop a random still-attached wheel into a free dynamic body.
   * Returns true if a wheel came off.
   */
  popWheel(): boolean {
    const candidates = this.wheels.filter((w) => !w.popped);
    if (candidates.length === 0) return false;
    const w = candidates[Math.floor(Math.random() * candidates.length)];
    w.popped = true;

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    w.mesh.getWorldPosition(worldPos);
    w.mesh.getWorldQuaternion(worldQuat);
    w.mesh.removeFromParent();
    this.scene.add(w.mesh);

    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(worldPos.x, worldPos.y, worldPos.z)
      .setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w })
      .setLinearDamping(0.2)
      .setAngularDamping(1.2);
    const body = this.physics.world.createRigidBody(desc);
    const vel = this.velocity;
    body.setLinvel(
      {
        x: vel.x * 0.7 + (Math.random() - 0.5) * 6,
        y: Math.abs(vel.y) * 0.4 + 3 + Math.random() * 3,
        z: vel.z * 0.7 + (Math.random() - 0.5) * 6,
      },
      true
    );
    body.setAngvel({ x: Math.random() * 12 - 6, y: Math.random() * 4, z: Math.random() * 12 - 6 }, true);
    const col = RAPIER.ColliderDesc.cylinder(w.radius * 0.4, w.radius)
      .setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 })
      .setDensity(300)
      .setFriction(0.8)
      .setRestitution(0.3)
      .setCollisionGroups(groups(GROUP.DEBRIS, GROUP.GROUND | GROUP.PROP | GROUP.VEHICLE | GROUP.NPC | GROUP.DEBRIS));
    const collider = this.physics.world.createCollider(col, body);
    this.physics.tagCollider(collider, { kind: 'prop', name: 'wheel-debris', material: 'metal' });
    this.physics.bind(body, w.mesh);
    return true;
  }

  dispose() {
    this.physics.world.removeVehicleController(this.controller);
    this.physics.unbind(this.body);
    this.physics.world.removeRigidBody(this.body);
    this.scene.remove(this.chassis);
  }
}

// ---- Procedural vehicles ----

function buildTrike(): { bodyNode: THREE.Object3D; wheelNodes: THREE.Object3D[] } {
  const pink = new THREE.MeshStandardMaterial({ color: 0xf06fa8, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.8 });
  const bodyNode = new THREE.Group();
  bodyNode.name = 'body';

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.85), pink);
  frame.position.set(0, 0.3, 0);
  frame.rotation.x = 0.25;
  bodyNode.add(frame);
  const seatPost = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22), pink);
  seatPost.position.set(0, 0.38, -0.28);
  bodyNode.add(seatPost);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.3), dark);
  seat.position.set(0, 0.5, -0.28);
  bodyNode.add(seat);
  const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4), dark);
  bars.rotation.z = Math.PI / 2;
  bars.position.set(0, 0.55, 0.38);
  bodyNode.add(bars);
  const steer = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35), pink);
  steer.position.set(0, 0.38, 0.38);
  steer.rotation.x = -0.15;
  bodyNode.add(steer);
  bodyNode.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });

  const wheelNodes = [
    procWheel('wheel-front-center', 0, 0.24, 0.42, 0.24, pink, dark),
    procWheel('wheel-back-left', -0.24, 0.16, -0.32, 0.16, pink, dark),
    procWheel('wheel-back-right', 0.24, 0.16, -0.32, 0.16, pink, dark),
  ];
  return { bodyNode, wheelNodes };
}

function buildSkateboard(): { bodyNode: THREE.Object3D; wheelNodes: THREE.Object3D[] } {
  // Oversized longboard: big enough for the raycast vehicle to behave.
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xc98e4a, roughness: 0.6 });
  const light = new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.5 });
  const bodyNode = new THREE.Group();
  bodyNode.name = 'body';
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 1.5), deckMat);
  deck.position.y = 0.21;
  deck.castShadow = true;
  bodyNode.add(deck);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.065, 1.5), light);
  stripe.position.y = 0.212;
  bodyNode.add(stripe);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.22), deckMat);
  nose.position.set(0, 0.245, 0.82);
  nose.rotation.x = -0.4;
  bodyNode.add(nose);
  const tail = nose.clone();
  tail.position.z = -0.82;
  tail.rotation.x = 0.4;
  bodyNode.add(tail);
  for (const z of [0.5, -0.5]) {
    const truck = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.1), light);
    truck.position.set(0, 0.14, z);
    bodyNode.add(truck);
  }

  const wheelNodes = [
    procWheel('wheel-front-left', -0.22, 0.1, 0.5, 0.1, light, light),
    procWheel('wheel-front-right', 0.22, 0.1, 0.5, 0.1, light, light),
    procWheel('wheel-back-left', -0.22, 0.1, -0.5, 0.1, light, light),
    procWheel('wheel-back-right', 0.22, 0.1, -0.5, 0.1, light, light),
  ];
  return { bodyNode, wheelNodes };
}

function procWheel(
  name: string,
  x: number,
  y: number,
  z: number,
  r: number,
  _mat: THREE.Material,
  tireMat: THREE.Material
): THREE.Object3D {
  const g = new THREE.Group();
  g.name = name;
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.55, 18), tireMat);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  g.position.set(x, y, z);
  return g;
}
