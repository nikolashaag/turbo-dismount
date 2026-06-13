import * as THREE from 'three';
import { Physics, RAPIER } from '../core/physics';
import { loadModel } from '../core/assets';
import { GROUP, groups, PropType } from './data';

export interface PropFrame {
  position: THREE.Vector3;
  yaw: number;
}

export interface PropInstance {
  type: PropType;
  objects: THREE.Object3D[];
  bodies: import('@dimforge/rapier3d-compat').RigidBody[];
  dispose(): void;
}

const DEBRIS_FILTER =
  GROUP.GROUND | GROUP.VEHICLE | GROUP.DUMMY | GROUP.PROP | GROUP.NPC | GROUP.DEBRIS;

export async function buildProp(
  type: PropType,
  physics: Physics,
  scene: THREE.Scene,
  frame: PropFrame
): Promise<PropInstance | null> {
  switch (type) {
    case 'empty':
      return null;
    case 'ramp':
      return buildRamp(physics, scene, frame);
    case 'brickwall':
      return buildBrickWall(physics, scene, frame);
    case 'megawall':
      return buildMegaWall(physics, scene, frame);
    case 'turbo':
      return buildTurbo(physics, scene, frame);
    case 'mine':
      return buildMine(physics, scene, frame);
    case 'cones':
      return buildCones(physics, scene, frame);
  }
}

function yawQuat(yaw: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

function makeInstance(
  type: PropType,
  physics: Physics,
  scene: THREE.Scene,
  objects: THREE.Object3D[],
  bodies: import('@dimforge/rapier3d-compat').RigidBody[]
): PropInstance {
  return {
    type,
    objects,
    bodies,
    dispose() {
      for (const b of bodies) {
        physics.unbind(b);
        physics.world.removeRigidBody(b);
      }
      for (const o of objects) scene.remove(o);
    },
  };
}

/**
 * Procedural launch ramp: a smooth quarter-pipe arc (0 to ~42 degrees) built
 * from thin slabs so vehicles ride it without slamming a wedge face.
 */
function buildRamp(physics: Physics, scene: THREE.Scene, frame: PropFrame): PropInstance {
  const width = 4.4;
  const radius = 17;
  const maxAngle = (33 * Math.PI) / 180;
  const segments = 11;
  const holder = new THREE.Group();
  holder.position.copy(frame.position);
  holder.rotation.y = frame.yaw;
  scene.add(holder);

  const deckMat = new THREE.MeshStandardMaterial({ color: 0xd8c9a8, roughness: 0.8 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd9952b, roughness: 0.8 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xa8543a, roughness: 0.85 });

  const q = yawQuat(frame.yaw);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(frame.position.x, frame.position.y, frame.position.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
  );

  const segLen = (maxAngle * radius) / segments + 0.25;
  for (let i = 0; i < segments; i++) {
    const ang = maxAngle * ((i + 0.5) / segments);
    // Arc center sits radius above the approach point; entry tangent is flat.
    const y = radius - radius * Math.cos(ang);
    const z = -segLen * 0.5 + radius * Math.sin(ang) - radius * Math.sin(maxAngle) * 0.5;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.35, segLen),
      i % 3 === 2 ? stripeMat : deckMat
    );
    mesh.position.set(0, y - 0.14, z);
    mesh.rotation.x = -ang; // negative pitch raises the +Z edge (right-hand rule)
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    holder.add(mesh);

    const segQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -ang);
    const col = RAPIER.ColliderDesc.cuboid(width / 2, 0.175, segLen / 2)
      .setTranslation(0, y - 0.14, z)
      .setRotation({ x: segQ.x, y: segQ.y, z: segQ.z, w: segQ.w })
      .setFriction(0.5)
      .setCollisionGroups(groups(GROUP.PROP, DEBRIS_FILTER));
    const collider = physics.world.createCollider(col, body);
    physics.tagCollider(collider, { kind: 'prop', name: 'ramp', material: 'wood' });
  }
  // Solid side cheeks for the look.
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 4.4), sideMat);
    cheek.position.set(side * (width / 2 + 0.09), 0.95, radius * Math.sin(maxAngle) * 0.5 - 2.0);
    cheek.castShadow = true;
    holder.add(cheek);
  }
  return makeInstance('ramp', physics, scene, [holder], [body]);
}

let brickGeo: THREE.BoxGeometry | null = null;
let brickMats: THREE.MeshStandardMaterial[] = [];
let brickCounter = 0;

function buildBrickWall(physics: Physics, scene: THREE.Scene, frame: PropFrame): PropInstance {
  if (!brickGeo) {
    brickGeo = new THREE.BoxGeometry(0.46, 0.22, 0.24);
    brickMats = [0xb3502e, 0xa8492c, 0xbf5a35, 0xaa4f30].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 })
    );
  }
  const objects: THREE.Object3D[] = [];
  const bodies: import('@dimforge/rapier3d-compat').RigidBody[] = [];
  const q = yawQuat(frame.yaw);
  const rows = 8;
  const cols = 9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offsetX = (c - (cols - 1) / 2) * 0.48 + (r % 2 === 0 ? 0 : 0.24);
      const local = new THREE.Vector3(offsetX, 0.12 + r * 0.23, 0);
      const world = local.clone().applyQuaternion(q).add(frame.position);
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(world.x, world.y, world.z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(0.1)
        .setAngularDamping(0.6)
        .setCanSleep(true);
      const body = physics.world.createRigidBody(desc);
      body.sleep();
      const col = RAPIER.ColliderDesc.cuboid(0.23, 0.11, 0.12)
        .setDensity(900)
        .setFriction(0.75)
        .setRestitution(0.05)
        .setCollisionGroups(groups(GROUP.PROP, DEBRIS_FILTER))
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
        .setContactForceEventThreshold(2500);
      const collider = physics.world.createCollider(col, body);
      physics.tagCollider(collider, { kind: 'prop', name: 'brick', material: 'wood', ownerId: brickCounter++ });
      const mesh = new THREE.Mesh(brickGeo, brickMats[(r * cols + c) % brickMats.length]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      physics.bind(body, mesh);
      objects.push(mesh);
      bodies.push(body);
    }
  }
  physics.snapVisuals();
  return makeInstance('brickwall', physics, scene, objects, bodies);
}

function buildMegaWall(physics: Physics, scene: THREE.Scene, frame: PropFrame): PropInstance {
  const w = 5.2;
  const h = 3.4;
  const d = 0.7;
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d8576, roughness: 0.9 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.copy(frame.position).add(new THREE.Vector3(0, h / 2, 0));
  mesh.rotation.y = frame.yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Hazard stripes panel.
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd9b13b, roughness: 0.8 });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d + 0.02), stripeMat);
  stripe.position.y = -h / 2 + 0.45;
  mesh.add(stripe);
  scene.add(mesh);

  const q = yawQuat(frame.yaw);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(frame.position.x, frame.position.y + h / 2, frame.position.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
  );
  const col = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
    .setFriction(0.6)
    .setCollisionGroups(groups(GROUP.PROP, DEBRIS_FILTER));
  const collider = physics.world.createCollider(col, body);
  physics.tagCollider(collider, { kind: 'prop', name: 'megawall', material: 'metal' });
  return makeInstance('megawall', physics, scene, [mesh], [body]);
}

function buildTurbo(physics: Physics, scene: THREE.Scene, frame: PropFrame): PropInstance {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.07, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.6 })
  );
  base.receiveShadow = true;
  g.add(base);
  const chevMat = new THREE.MeshStandardMaterial({
    color: 0xffd23e,
    emissive: 0xff9a00,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  for (let i = 0; i < 3; i++) {
    const chev = new THREE.Mesh(new THREE.BoxGeometry(1.6 - i * 0.0, 0.05, 0.32), chevMat);
    chev.position.set(0, 0.05, -0.6 + i * 0.6);
    chev.rotation.y = 0;
    g.add(chev);
  }
  g.position.copy(frame.position).add(new THREE.Vector3(0, 0.05, 0));
  g.rotation.y = frame.yaw;
  scene.add(g);

  const q = yawQuat(frame.yaw);
  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed()
      .setTranslation(frame.position.x, frame.position.y + 0.3, frame.position.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
  );
  const col = RAPIER.ColliderDesc.cuboid(1.7, 0.4, 1.2)
    .setSensor(true)
    .setCollisionGroups(groups(GROUP.PROP, GROUP.VEHICLE | GROUP.DUMMY))
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = physics.world.createCollider(col, body);
  physics.tagCollider(collider, { kind: 'sensor', name: 'turbo', material: 'metal' });
  return makeInstance('turbo', physics, scene, [g], [body]);
}

function buildMine(physics: Physics, scene: THREE.Scene, frame: PropFrame): PropInstance {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.65, 0.16, 20),
    new THREE.MeshStandardMaterial({ color: 0x3c4034, roughness: 0.5, metalness: 0.4 })
  );
  disc.position.y = 0.08;
  disc.castShadow = true;
  g.add(disc);
  const light = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 1.6 })
  );
  light.position.y = 0.2;
  g.add(light);
  g.position.copy(frame.position);
  scene.add(g);

  const body = physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(frame.position.x, frame.position.y + 0.25, frame.position.z)
  );
  const col = RAPIER.ColliderDesc.cylinder(0.25, 0.8)
    .setSensor(true)
    .setCollisionGroups(groups(GROUP.PROP, GROUP.VEHICLE | GROUP.DUMMY | GROUP.NPC | GROUP.DEBRIS))
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const collider = physics.world.createCollider(col, body);
  physics.tagCollider(collider, { kind: 'sensor', name: 'mine', material: 'metal' });
  return makeInstance('mine', physics, scene, [g], [body]);
}

async function buildCones(physics: Physics, scene: THREE.Scene, frame: PropFrame): Promise<PropInstance> {
  const proto = await loadModel('/assets/models/vehicles/cone.glb');
  const box = new THREE.Box3().setFromObject(proto);
  const size = box.getSize(new THREE.Vector3());
  const scale = 0.55 / size.y;

  const objects: THREE.Object3D[] = [];
  const bodies: import('@dimforge/rapier3d-compat').RigidBody[] = [];
  const q = yawQuat(frame.yaw);
  const layout = [
    [-1.2, 0], [0, 0], [1.2, 0],
    [-0.6, 1.0], [0.6, 1.0],
    [0, 2.0],
  ];
  for (const [x, z] of layout) {
    const world = new THREE.Vector3(x, 0, z).applyQuaternion(q).add(frame.position);
    const mesh = proto.clone(true);
    mesh.scale.setScalar(scale);
    const c = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    mesh.position.sub(c);
    mesh.position.y += size.y * scale * 0.0;
    holder.add(mesh);
    scene.add(holder);
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(world.x, 0.3, world.z)
      .setLinearDamping(0.2)
      .setAngularDamping(0.8);
    const body = physics.world.createRigidBody(desc);
    body.sleep();
    const col = RAPIER.ColliderDesc.cuboid(0.18, 0.27, 0.18)
      .setDensity(120)
      .setFriction(0.7)
      .setRestitution(0.2)
      .setCollisionGroups(groups(GROUP.PROP, DEBRIS_FILTER))
      .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1200);
    const collider = physics.world.createCollider(col, body);
    physics.tagCollider(collider, { kind: 'prop', name: 'cone', material: 'soft' });
    physics.bind(body, holder);
    objects.push(holder);
    bodies.push(body);
  }
  physics.snapVisuals();
  return makeInstance('cones', physics, scene, objects, bodies);
}
