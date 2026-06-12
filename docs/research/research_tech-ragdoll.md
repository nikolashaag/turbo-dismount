# Building a Turbo Dismount-style 3D ragdoll crash game in the browser: research findings

## 1. Physics engine choice: Rapier (@dimforge/rapier3d-compat) is the right call for 2026

**Recommendation: Rapier.** Reasoning, verified against current sources:

| Engine | Status 2026 | Notes |
|---|---|---|
| **Rapier** (`@dimforge/rapier3d` / `-compat`) | Actively maintained, ~2M weekly npm downloads, first-class TypeScript | Rust compiled to WASM. Has joints, contact force events, CCD, soft-CCD, AND a built-in raycast vehicle controller in the JS bindings since v0.12.0 (Jan 2024). Cross-platform deterministic. |
| **jolt-physics** (JoltPhysics.js) | Maintained, ~1k weekly downloads | C++/emscripten. Technically excellent (Horizon Forbidden West engine), has dedicated `RagdollSettings`/`Ragdoll` classes and `WheeledVehicleController`, plus a three.js addon (`three/addons/physics/JoltPhysics.js`). BUT: emscripten-style API means manual memory management (`Jolt.destroy()` on everything created with `new Jolt.XXX()`), weak TypeScript ergonomics, much smaller JS community. |
| **cannon-es** | Effectively unmaintained (last real updates ~2022) | Pure JS, slow vs WASM (community benchmarks show Rapier 3x+ faster on 1000 bodies). No vehicle raycast controller as robust as Rapier's, joint stability is its weak point. Avoid for ragdolls. |
| **ammo.js** | Legacy, no npm package | Bullet port via emscripten, painful API, basically superseded. |

**Determinism:** Rapier's docs explicitly state the WASM/JS build is "fully cross-platform deterministic" given same version, same init order, same parameters. Caveat from the docs: `Math.sin`/`Math.cos` and other JS transcendental functions are NOT cross-platform deterministic, so any values you feed into the simulation must avoid them (or use a deterministic math lib). Verify with `world.takeSnapshot()`/`createSnapshot()` and hash comparison. Note: determinism requires a fixed `world.timestep`; a variable timestep breaks it.

**Package/Vite specifics:**
- `@dimforge/rapier3d` keeps the .wasm file separate and needs bundler WASM support; with Vite this requires `vite-plugin-wasm` + `vite-plugin-top-level-await` (or dynamic `import('@dimforge/rapier3d')`).
- `@dimforge/rapier3d-compat` embeds the WASM base64-encoded in the JS, works with zero Vite config, requires `await RAPIER.init()` before use. For a game jam / single-game project the compat package is the pragmatic choice; the cost is a bigger bundle (~2-3 MB) and slightly slower startup.

```ts
import RAPIER from '@dimforge/rapier3d-compat';
await RAPIER.init();
const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
world.timestep = 1 / 60; // fixed
```

There is also `@dimforge/rapier3d-simd-compat` for SIMD-enabled builds if you want extra throughput.

## 2. Ragdoll construction in Rapier

**Critical limitation found (verified, still open):** `RAPIER.JointData.spherical(anchor1, anchor2)` in the JS bindings has NO cone/twist limits. Spherical motors/limits were removed in rapier.js v0.8.0-alpha and never restored; GitHub issue dimforge/rapier.js#290 ("ragdoll joints rotate infinitely in the twist direction") is still open. `limitsEnabled`/`limits: [min,max]` on `JointData` only work for `revolute` and `prismatic`.

**Practical ragdoll recipe that works in rapier.js today:**
- **Hinge-like joints (knees, elbows): `JointData.revolute(anchor1, anchor2, axis)` with limits.** This is fully supported:
```ts
const params = RAPIER.JointData.revolute(
  { x: 0, y: -0.22, z: 0 },  // anchor in thigh local space (knee point)
  { x: 0, y: 0.22, z: 0 },   // anchor in shin local space
  { x: 1, y: 0, z: 0 });      // hinge axis (sideways)
params.limitsEnabled = true;
params.limits = [0.0, 2.4];   // knee: 0 to ~140 degrees flexion
const knee = world.createImpulseJoint(params, thighBody, shinBody, true);
```
Typical limit values (radians): knee `[0, 2.4]`, elbow `[0, 2.6]`, neck pitch if modeled as revolute `[-0.7, 0.7]`.
- **Ball joints (shoulders, hips, neck, spine): `JointData.spherical` WITHOUT limits, tamed by high angular damping** on the connected bodies (this is what working rapier.js ragdolls like mattvb91/rapierjs-ragdoll do). Alternatively `JointData.generic(anchor1, anchor2, axis, axesMask)` (3D only, added v0.12.0) lets you hard-lock individual axes, e.g. lock twist entirely and leave swing free:
```ts
// Lock all translation + twist (AngY along the bone), free swing (AngX, AngZ)
const mask = RAPIER.JointAxesMask.LinX | RAPIER.JointAxesMask.LinY |
             RAPIER.JointAxesMask.LinZ | RAPIER.JointAxesMask.AngY;
const shoulderParams = RAPIER.JointData.generic(a1, a2, boneAxis, mask);
```
JointAxesMask values: `LinX=1, LinY=2, LinZ=4, AngX=8, AngY=16, AngZ=32`. Note: generic joints fully LOCK axes (no soft limits), so the common compromise is spherical + damping, or generic with locked twist.

**Body part shapes:** capsules everywhere (`RAPIER.ColliderDesc.capsule(halfHeight, radius)`), except optionally a box for the pelvis/torso and a ball (`ColliderDesc.ball(r)`) for the head. Capsules give the most stable contacts. Approximate human (1.8 m figure): head ball r=0.11; torso capsule halfHeight 0.25 r 0.15; upper arm capsule 0.12/0.05; forearm 0.12/0.04; thigh 0.2/0.07; shin 0.2/0.05.

**Mass distribution:** use `collider.setDensity()` (or `ColliderDesc.setDensity`) and let Rapier compute mass from shape, with density tweaked so totals approximate human segment masses: total ~70-80 kg; pelvis+torso ~50% of mass, each thigh ~10%, shin ~5%, upper arm ~3%, forearm ~2%, head ~8%. Heavier center, lighter extremities is the single most important stability factor; large mass ratios between directly-jointed bodies (>10:1) cause solver trouble, so do not make hands/feet absurdly light. Rapier gotcha from the official "common mistakes" page: a body with no collider, or a collider with zero density and no explicit mass, has zero mass and will behave insanely.

**Anti-jitter / anti-explosion checklist (all verified API names):**
- `world.numSolverIterations = 8` (default 4; setter doc: "increases rigidity and realism", more expensive). Unity's ragdoll guidance similarly says raise iterations to 10-20 if joints jitter.
- `world.numInternalPgsIterations` (default 1): cheaper stability knob than numSolverIterations.
- Per-body alternative so you only pay for the ragdoll: `RigidBodyDesc.setAdditionalSolverIterations(iters)` runs extra iterations "for this rigid-body and everything that interacts with it directly or indirectly through contacts or joints". Put 4 extra on the pelvis.
- Angular damping on every ragdoll part: `RigidBodyDesc.setAngularDamping(2.0)` to `4.0` (default 0). Linear damping 0.05-0.2. This kills the spinning-limbs look and most jitter.
- CCD on all ragdoll parts and the vehicle chassis since this is a high-speed crash game: `RigidBodyDesc.setCcdEnabled(true)`; raise `IntegrationParameters.maxCcdSubsteps` (default 1) if fast objects still tunnel. Newer/cheaper option: `RigidBodyDesc.setSoftCcdPrediction(distance)` (soft CCD, present in current JS API); a prediction distance of a few times the body size works.
- `collider.setContactSkin(thickness)` (e.g. 0.01-0.02 m) adds a small collision margin that noticeably reduces contact jitter.
- Disable collisions between directly-jointed neighbor parts. rapier.js `createImpulseJoint` does not auto-disable them everywhere, so use `collider.setCollisionGroups(groups)` with a bitmask scheme (16 bits membership << 16 | 16 bits filter) so e.g. thigh and shin never collide with each other but both collide with the world.
- Keep everything in SI units (meters/kg/s). The docs' "common mistakes" page: scaling in pixels makes everything look slow-motion and unstable. Use `world.lengthUnit` if your average object size differs a lot from 1 m.
- Friction/restitution: `collider.setFriction(0.8)`, `setRestitution(0.1)` for body parts (low bounce, decent grip reads well for ragdolls).

## 3. Seat attachment + breakable joints

**Rapier has NO native breakable joints in the JS bindings.** (The Rust docs hint at reading joint forces "in order to break it dynamically" but the JS API does not expose per-joint applied impulses.) The established pattern is: fixed joints + contact force events + manual `world.removeImpulseJoint`.

**Setup:**
```ts
// Strap pelvis (and optionally torso) to the seat with fixed joints
const seatParams = RAPIER.JointData.fixed(
  { x: 0, y: 0.4, z: 0.1 }, { w: 1, x: 0, y: 0, z: 0 },   // anchor+frame on chassis
  { x: 0, y: 0, z: 0 },     { w: 1, x: 0, y: 0, z: 0 });  // anchor+frame on pelvis
const seatJoint = world.createImpulseJoint(seatParams, chassisBody, pelvisBody, true);
```
Two fixed joints (pelvis to seat, hands to "steering wheel" point) give a nice pose; break them at different thresholds so hands let go first.

**Detecting the impact (exact API):**
```ts
chassisCollider.setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS);
chassisCollider.setContactForceEventThreshold(30_000); // Newtons; tune to taste

const eventQueue = new RAPIER.EventQueue(true);
world.step(eventQueue);

eventQueue.drainContactForceEvents(ev => {
  // ev is a TempContactForceEvent
  const h1 = ev.collider1();              // collider handle (number)
  const h2 = ev.collider2();
  const mag = ev.totalForceMagnitude();    // number, N
  const dir = ev.maxForceDirection();      // Vector
  // also: ev.totalForce(): Vector, ev.maxForceMagnitude(): number
  if (mag > BREAK_THRESHOLD && involvesChassis(h1, h2)) {
    world.removeImpulseJoint(seatJoint, true); // wakeUp=true wakes both bodies
    ejected = true;
  }
});
```
Notes verified from docs: the threshold semantics are "sum of the magnitudes of all the contacts between the two colliders", events fire only if that sum exceeds either collider's threshold (default 0 = all contacts fire, so always set a threshold). `removeImpulseJoint(joint, true)` exists on `World`; wakeUp=true is important or the freed ragdoll may stay asleep mid-air.

**Threshold tuning:** force magnitude scales with mass and 1/dt. For a ~200 kg car at 20 m/s hitting a wall and stopping in a few 1/60 frames, peak contact forces are order 10^4-10^5 N, so thresholds in the 2e4 to 1e5 range are a sensible starting band. An alternative/supplementary trigger that is frame-rate-robust: track chassis velocity each step and eject when `deltaV / dt` exceeds ~8-15 g.

**After breaking:** also consider `chassisBody.setLinvel`/`applyImpulse` on the pelvis for an extra "launch" feel, and switch the camera to follow the pelvis body.

## 4. Vehicle: use Rapier's built-in raycast vehicle controller

**`DynamicRayCastVehicleController` EXISTS in the JS bindings** (added rapier.js v0.12.0, 28 Jan 2024) and there is an official three.js example (`threejs.org/examples/physics_rapier_vehicle_controller.html`). Created via `world.createVehicleController(chassis: RigidBody)`. It directly modifies the chassis rigid body's velocity; wheels are raycasts, not colliders.

**Full verified API:**
```ts
const vehicle = world.createVehicleController(chassisBody);

// addWheel(chassisConnectionCs: Vector, directionCs: Vector, axleCs: Vector,
//          suspensionRestLength: number, radius: number)
vehicle.addWheel({ x: -1, y: 0, z: -1.5 }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.8, 0.3);
// (three.js example wheel layout: (+-1, 0, +-1.5) on a BoxGeometry(2,1,4) chassis, mass 10)

// per wheel index i:
vehicle.setWheelSuspensionStiffness(i, 24.0);      // three.js example value
vehicle.setWheelFrictionSlip(i, 1000.0);           // three.js example value (very grippy)
vehicle.setWheelSideFrictionStiffness(i, 1.0);
vehicle.setWheelSuspensionCompression(i, 1.0);
vehicle.setWheelSuspensionRelaxation(i, 1.0);
vehicle.setWheelMaxSuspensionTravel(i, 0.5);
vehicle.setWheelMaxSuspensionForce(i, 6000);

// controls per frame:
vehicle.setWheelEngineForce(i, force);   // three.js example UI range: -30..30 for mass-10 chassis
vehicle.setWheelSteering(i, angleRad);   // example max: Math.PI / 4
vehicle.setWheelBrake(i, brake);         // example range 0..1

// step: call right before world.step()
vehicle.updateVehicle(1 / 60);
// signature: updateVehicle(dt, filterFlags?, filterGroups?, filterPredicate?)

// reading state for visuals:
vehicle.currentVehicleSpeed();
vehicle.wheelChassisConnectionPointCs(i).y;
vehicle.wheelSuspensionLength(i);
vehicle.wheelSteering(i);
vehicle.wheelRotation(i);
vehicle.wheelAxleCs(i);
```
**Wheel mesh sync (from the official three.js example):**
```ts
wheel.position.y = vehicle.wheelChassisConnectionPointCs(i).y - vehicle.wheelSuspensionLength(i);
wheelSteeringQuat.setFromAxisAngle(up, vehicle.wheelSteering(i));
wheelRotationQuat.setFromAxisAngle(vehicle.wheelAxleCs(i), vehicle.wheelRotation(i));
wheel.quaternion.multiplyQuaternions(wheelSteeringQuat, wheelRotationQuat);
```

**Crash-game-specific guidance:**
- The raycast vehicle is only meaningful while wheels point roughly down. For a Turbo Dismount loop this is fine: drive phase uses the controller; at impact, stop calling `updateVehicle`/zero the engine force and let the chassis (an ordinary dynamic body with a cuboid/convex collider) tumble freely. The chassis IS a normal `RigidBody`, so nothing special is needed to transition; just stop driving it.
- Lower the center of mass for stability: `RigidBodyDesc.setAdditionalMass()` or place the chassis collider with a downward offset (`ColliderDesc.cuboid(...).setTranslation(0, -0.3, 0)`).
- Alternative ultra-simple approach (valid for a first prototype): a dynamic box with high friction colliders, propelled with `applyImpulse`/`addForce` along its forward vector, no steering physics. It crashes great; it just drives badly. Given the controller exists and is ~50 lines to set up, the raycast vehicle is worth it.
- pmndrs/react-three-rapier still has no wrapper for it (issue #323), irrelevant for vanilla three.js + TS.

## 5. Slow motion

Standard, stability-preserving approach: **keep the physics dt fixed and scale how much simulated time you accumulate per rendered frame** (Gaffer on Games "Fix Your Timestep" accumulator):

```ts
const FIXED_DT = 1 / 60;       // world.timestep = FIXED_DT, never changes
let timeScale = 1.0;           // 0.1-0.3 for slow-mo
let accumulator = 0;

function frame(delta: number) { // render delta in seconds, clamped (e.g. max 0.1)
  accumulator += Math.min(delta, 0.1) * timeScale;
  while (accumulator >= FIXED_DT) {
    prevState = captureState();      // positions+rotations of synced bodies
    vehicle?.updateVehicle(FIXED_DT);
    world.step(eventQueue);
    drainEvents();
    accumulator -= FIXED_DT;
  }
  const alpha = accumulator / FIXED_DT;
  syncMeshes(prevState, alpha);      // lerp pos, slerp quat between prev and current
}
```
Why this is correct: every `world.step()` always advances exactly `world.timestep`, so solver stability and determinism are untouched; slow motion just means fewer steps per rendered second, and the interpolation (essential at timeScale 0.1, where you render ~10 frames per physics step) keeps motion smooth. This also matches the Rapier docs' guidance that the timestep "should not vary too much during the course of the simulation."

Acceptable alternative: set `world.timestep = FIXED_DT * timeScale` and step once per frame. Smaller dt is actually MORE stable, so it will not explode, but it costs determinism/replays and makes contact-force thresholds frame-rate dependent (forces scale with 1/dt), so the accumulator approach is better for this game since you read force thresholds. Whatever you do, never implement slow-mo by scaling gravity/velocities.

## 6. Performance and the render-loop pattern

- **Body counts:** a Turbo Dismount scene is tiny by physics-engine standards: 1 vehicle chassis + ~11-15 ragdoll bodies with ~10-14 joints + a few dozen props is well under 100 dynamic bodies. Rapier WASM comfortably simulates hundreds to a few thousand active dynamic bodies at 60 fps on desktop (community benchmarks: 3x+ faster than cannon.js at 1000 cubes; see isaac-mason's js-physics-benchmarks). Budget concern for you is not body count, it is solver iterations times joint count, which at this scale is negligible. You can afford `numSolverIterations = 8` plus CCD on everything that moves fast.
- Multiple ragdolls (Turbo Dismount has up to ~5 passengers): still trivially fine, ~75 bodies.
- Keep physics on the main thread first; a web worker (structured-clone the transforms or use SharedArrayBuffer) is an optimization you almost certainly will not need at this scale, and it complicates the contact-event-to-joint-removal flow.
- Fixed timestep + interpolation as in section 5 is also the answer here: it decouples a 120/144 Hz display from the 60 Hz simulation. react-three-rapier ships this exact pattern ("interpolation" + `timeStep` prop with explicit warning that `timeStep: "vary"` "may cause instability and prevents determinism"), which confirms it as the community-standard pattern even outside React.
- Cleanup gotcha: `TempContactForceEvent` objects are only valid inside the drain callback; copy fields out, do not store the event. `EventQueue(true)` auto-drains/clears.
- Sleep: leave sleeping enabled (default) so settled crash debris stops costing solver time; `removeImpulseJoint(j, true)` and `applyImpulse` wake bodies as needed.

## Suggested concrete stack

- `three` + `@dimforge/rapier3d-compat` (or `@dimforge/rapier3d` + vite-plugin-wasm) + Vite + TypeScript.
- World: gravity -9.81, `timestep = 1/60`, `numSolverIterations = 8`.
- Vehicle: `world.createVehicleController`, 4 wheels, stiffness 24, frictionSlip 30-1000 (tune; 1000 = arcade grip), `updateVehicle(dt)` before each `world.step`.
- Ragdoll: capsules, density-derived masses (~75 kg total, torso-heavy), revolute+limits for knees/elbows, spherical+angular damping 2-4 for shoulders/hips/neck (or generic with twist locked), collision groups to mask neighbor pairs, CCD enabled.
- Seat: 1-2 `JointData.fixed` joints, `CONTACT_FORCE_EVENTS` + `setContactForceEventThreshold` on chassis, `drainContactForceEvents` then `world.removeImpulseJoint(joint, true)` above threshold.
- Loop: accumulator with `timeScale` multiplier, interpolated mesh sync, slow-mo at 0.15-0.25 on detected impact.