# Turbo Dismount Clone

A faithful, fan-made browser clone of Secret Exit's **Turbo Dismount / Turbo Dismount 2** — the
"kinetic tragedy" crash simulator. Pose a crash-test dummy on a vehicle, set up obstacles, charge
the launch gauge, and watch the ragdoll physics turn the run into a slow-motion catastrophe worth
as many points as possible.

Built from scratch with **TypeScript + Three.js + Rapier (WASM)**, no game engine.

## Play

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a static bundle with `npm run build` (outputs to `dist/`).

## How to play

1. **PLAY** → pick a level (locked levels unlock as you complete challenges).
2. In setup: pick a **Vehicle**, a **Pose**, and click the yellow **hot-spot** pads on the road to
   drop obstacles (ramp, brick wall, mega wall, turbo pad, land mine, cones).
3. **Hold** the DISMOUNT button (or **Space**) to rev the oscillating power gauge, **release** to launch.
4. During the run, steer with **A/D** or **←/→**. Watch the crash, rack up injuries and combos.
5. After it settles you get a score breakdown, challenge progress, and an **Instant Replay** you can
   scrub, slow down (turtle), and speed up (rabbit).

## What's in it

- **6 levels**: The Original Classic, T-Junction (cross traffic), Skid Marks (drag strip), Space
  Program (mega-ramp to 80m+), Loop De Loop (corkscrew loop), Stairway to Heaven (plaza + stairs).
- **9 vehicles** with distinct mass/speed/handling, from the Delivery Van to a tricycle, skateboard,
  monster SUV, semi truck and a race car. Two unlock through progression.
- **4 poses** (seated, superman, roof-surfer, hood-clinger) that change the dummy's center of mass
  and which bones break first.
- **Jointed ragdoll** (capsules + ball/hinge joints, breakable seat straps, detachable limbs) driven
  by a contact-force and deceleration model. Decapitations, fractures, dislocations.
- **Scoring**: per-body-part impact points scaled by a decaying combo multiplier (to x10),
  somersaults, airtime, altitude, traffic pile-ups, brick scatter, mine detonations, "Nailed It!".
- **Ghost NPC traffic** that turns physical on contact and chains into pile-ups.
- **Slow-motion crash cam**, floating score popups, injury icon stack, full **instant replay**.
- **Progression**: per-level challenges, level + vehicle unlocks, personal bests, all saved to
  `localStorage`.
- **Audio**: a synthesized 70s funk loop, a procedural engine that revs with the gauge, and Kenney
  impact one-shots layered for crunch, with an underwater low-pass treatment during slow-mo.

## Tech notes

- **Fixed timestep** (1/60s) with render interpolation; slow-motion scales accumulated time, never
  the timestep, so the solver stays stable (`src/core/engine.ts`).
- **Rapier** raycast vehicle controller for driving; the chassis is an ordinary dynamic body that
  tumbles freely once it crashes (`src/game/vehicle.ts`).
- Crashes register only on a **real solid contact** combined with a deceleration spike, so the
  wheel-grip model can't spuriously total the car mid-drive (`src/game/game.ts`).
- A `window.__td` test API drives the game deterministically for automated browser testing.

## Assets & credits

- 3D models, audio and UI: [Kenney](https://kenney.nl) (CC0). Car Kit, Racing Kit, City Kit,
  Impact Sounds, Interface Sounds.
- Physics: [Rapier](https://rapier.rs) · Rendering: [Three.js](https://threejs.org)
- A loving fan tribute to **Turbo Dismount** by Secret Exit. Not affiliated.
