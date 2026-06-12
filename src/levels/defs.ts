import * as THREE from 'three';
import { PropType, RunStats } from '../game/data';
import { NpcRouteDef } from '../game/npc';
import { LevelContext } from './builder';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface Hotspot {
  position: THREE.Vector3;
  yaw: number;
  initial: PropType;
}

export interface Challenge {
  id: string;
  label: string;
  test: (stats: RunStats) => boolean;
}

export interface LevelDef {
  id: string;
  name: string;
  tagline: string;
  spawn: { position: THREE.Vector3; yaw: number };
  orbitOffset?: THREE.Vector3;
  hotspots: Hotspot[];
  npcs: NpcRouteDef[];
  scoreTarget: number;
  challenges: Challenge[];
  gimmick?: 'altitude' | 'speedtrap';
  speedTrapZ?: number;
  build(ctx: LevelContext): Promise<void>;
}

export const LEVELS: LevelDef[] = [
  // ------------------------------------------------------------------
  {
    id: 'classic',
    name: 'The Original Classic',
    tagline: 'A road. A wall. A ramp. Physics does the rest.',
    spawn: { position: V(0, 0, -2), yaw: 0 },
    hotspots: [
      { position: V(0, 0, 30), yaw: 0, initial: 'ramp' },
      { position: V(0, 0, 44), yaw: 0, initial: 'brickwall' },
    ],
    npcs: [],
    scoreTarget: 300000,
    challenges: [
      { id: 'score', label: 'Score 300 000', test: (s) => s.score >= 300000 },
      { id: 'air', label: '2.5s of airtime', test: (s) => s.airtime >= 2.5 },
      { id: 'bones', label: '6 injuries in one run', test: (s) => s.injuries >= 6 },
    ],
    async build(ctx) {
      ctx.addGround();
      ctx.addSkyline();
      ctx.addRoad(V(0, 0, -16), V(0, 0, 90));
      for (let z = -8; z <= 80; z += 11) {
        ctx.addTree(-6.2, z + 2.5);
        ctx.addTree(6.2, z - 1.5);
      }
      await ctx.addBillboard(V(-9.5, 0, 22), 0.5);
      await ctx.addBillboard(V(9.5, 0, 52), -0.5);
      // Distant parked props for flavor.
      await ctx.addModelStatic({
        path: '/assets/models/roads/construction-barrier.glb',
        position: V(3.2, 0, 62), yaw: 0.4, targetLength: 2.4, collider: 'box', name: 'barrier', material: 'wood',
      });
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'tjunction',
    name: 'T-Junction',
    tagline: 'Two lanes of crossing traffic. They will not stop for you.',
    spawn: { position: V(0, 0, -2), yaw: 0 },
    hotspots: [
      { position: V(0, 0, 18), yaw: 0, initial: 'empty' },
      { position: V(0, 0, 32), yaw: 0, initial: 'empty' },
      { position: V(0, 0, 44), yaw: 0, initial: 'empty' },
    ],
    npcs: [
      { model: 'sedan.glb', from: V(-70, 0, 52), to: V(70, 0, 52), speed: 14, phase: 0.1 },
      { model: 'hatchback-sports.glb', from: V(-70, 0, 52), to: V(70, 0, 52), speed: 14, phase: 0.45 },
      { model: 'van.glb', from: V(-70, 0, 52), to: V(70, 0, 52), speed: 14, phase: 0.8 },
      { model: 'taxi.glb', from: V(70, 0, 57), to: V(-70, 0, 57), speed: 17, phase: 0.25 },
      { model: 'suv-luxury.glb', from: V(70, 0, 57), to: V(-70, 0, 57), speed: 17, phase: 0.6 },
      { model: 'ambulance.glb', from: V(70, 0, 57), to: V(-70, 0, 57), speed: 17, phase: 0.92, targetLength: 5 },
    ],
    scoreTarget: 600000,
    challenges: [
      { id: 'pingpong', label: 'Hit 3 different cars', test: (s) => s.npcHits >= 3 },
      { id: 'score', label: 'Score 600 000', test: (s) => s.score >= 600000 },
      { id: 'limb', label: 'Lose 2 limbs', test: (s) => s.detachedParts >= 2 },
    ],
    async build(ctx) {
      ctx.addGround();
      ctx.addSkyline();
      ctx.addRoad(V(0, 0, -16), V(0, 0, 50));
      ctx.addRoad(V(-80, 0, 54.5), V(80, 0, 54.5), 12);
      // Building wall behind the junction.
      const buildings = ['building-a', 'building-c', 'building-e', 'building-g', 'building-h', 'building-b'];
      for (let i = 0; i < buildings.length; i++) {
        await ctx.addModelStatic({
          path: `/assets/models/buildings/${buildings[i]}.glb`,
          position: V(-50 + i * 20, 0, 75),
          yaw: Math.PI,
          targetHeight: 14 + (i % 3) * 5,
          collider: 'box',
        });
      }
      for (let z = -8; z <= 40; z += 12) {
        ctx.addTree(-6.2, z);
        ctx.addTree(6.2, z + 5);
      }
      await ctx.addBillboard(V(10, 0, 40), -0.7);
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'skidmarks',
    name: 'Skid Marks',
    tagline: 'Drag night. Bricks at the finish line. Glory optional.',
    spawn: { position: V(0, 0, -2), yaw: 0 },
    gimmick: 'speedtrap',
    speedTrapZ: 86,
    hotspots: [
      { position: V(0, 0, 22), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 48), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 70), yaw: 0, initial: 'empty' },
    ],
    npcs: [
      { model: 'sedan-sports.glb', from: V(-5.5, 0, -6), to: V(-5.5, 0, 140), speed: 26, phase: 0 },
      { model: 'police.glb', from: V(5.5, 0, -10), to: V(5.5, 0, 140), speed: 23, phase: 0 },
    ],
    scoreTarget: 750000,
    challenges: [
      { id: 'fast', label: 'Cross the line above 130 km/h', test: (s) => s.maxSpeed >= 36 },
      { id: 'score', label: 'Score 750 000', test: (s) => s.score >= 750000 },
      { id: 'bricks', label: 'Scatter 35 bricks', test: (s) => s.bricksScattered >= 35 },
    ],
    async build(ctx) {
      ctx.addGround();
      ctx.addSkyline();
      // Three drag lanes.
      ctx.addRoad(V(0, 0, -16), V(0, 0, 92), 4.5);
      ctx.addRoad(V(-5.5, 0, -16), V(-5.5, 0, 92), 4.5);
      ctx.addRoad(V(5.5, 0, -16), V(5.5, 0, 92), 4.5);
      // Finish gantry + brick stack across the player's lane.
      ctx.addBox({ size: [0.5, 6, 0.5], position: V(-8.5, 3, 88), color: 0xd9d3c5 });
      ctx.addBox({ size: [0.5, 6, 0.5], position: V(8.5, 3, 88), color: 0xd9d3c5 });
      ctx.addBox({ size: [17.5, 0.7, 0.5], position: V(0, 6, 88), color: 0xc8332b, collider: false });
      await ctx.addModelStatic({
        path: '/assets/models/props/flagCheckers.glb',
        position: V(-8.5, 6.2, 88), targetHeight: 1.6, collider: 'none',
      });
      await ctx.addModelStatic({
        path: '/assets/models/props/grandStandCovered.glb',
        position: V(-16, 0, 55), yaw: Math.PI / 2, targetLength: 18, collider: 'box',
      });
      await ctx.addModelStatic({
        path: '/assets/models/props/grandStand.glb',
        position: V(16, 0, 35), yaw: -Math.PI / 2, targetLength: 14, collider: 'box',
      });
      await ctx.addBillboard(V(13, 0, 80), -0.9);
      for (const side of [-1, 1]) {
        for (let z = 0; z < 90; z += 18) {
          await ctx.addModelStatic({
            path: '/assets/models/props/barrierWhite.glb',
            position: V(side * 10.5, 0, z), targetLength: 3.4, collider: 'box', name: 'barrier', material: 'metal',
          });
        }
      }
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'space',
    name: 'Space Program',
    tagline: 'The ramp points up. Commitment is mandatory.',
    spawn: { position: V(0, 0, -2), yaw: 0 },
    gimmick: 'altitude',
    hotspots: [
      { position: V(0, 0, 25), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 55), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 80), yaw: 0, initial: 'empty' },
    ],
    npcs: [],
    scoreTarget: 500000,
    challenges: [
      { id: 'alt40', label: 'Reach 40m altitude', test: (s) => s.maxAltitude >= 40 },
      { id: 'alt65', label: 'To space! 65m altitude', test: (s) => s.maxAltitude >= 65 },
      { id: 'flips', label: '3 somersaults', test: (s) => s.somersaults >= 3 },
    ],
    async build(ctx) {
      ctx.addGround();
      ctx.addSkyline();
      ctx.addRoad(V(0, 0, -16), V(0, 0, 100), 8);
      // Mega ramp: quarter-pipe arc up to ~70 degrees.
      ctx.addArcTrack({
        x: 0, zStart: 100, radius: 42, width: 9,
        angleFrom: 0, angleTo: (70 * Math.PI) / 180, segments: 16, rails: true,
      });
      // Support pillars.
      for (const [y, z] of [
        [4, 122], [10, 132], [18, 138],
      ] as Array<[number, number]>) {
        ctx.addBox({ size: [1.6, y * 2, 1.6], position: V(-5.5, y, z), color: 0xa8543a });
        ctx.addBox({ size: [1.6, y * 2, 1.6], position: V(5.5, y, z), color: 0xa8543a });
      }
      for (let z = 0; z < 95; z += 16) {
        ctx.addTree(-7.5, z, 1.1);
        ctx.addTree(7.5, z + 8, 1.1);
      }
      await ctx.addBillboard(V(-11, 0, 60), 0.8);
      await ctx.addModelStatic({
        path: '/assets/models/props/bannerTowerRed.glb',
        position: V(9, 0, 96), targetHeight: 8, collider: 'box',
      });
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'loop',
    name: 'Loop De Loop',
    tagline: 'A full vertical loop. Most vehicles disagree with it.',
    spawn: { position: V(0, 0, -2), yaw: 0 },
    hotspots: [
      { position: V(0, 0, 14), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 26), yaw: 0, initial: 'turbo' },
      { position: V(0, 0, 36), yaw: 0, initial: 'empty' },
    ],
    npcs: [],
    scoreTarget: 400000,
    challenges: [
      { id: 'looper', label: 'Get higher than 12m in the loop', test: (s) => s.maxAltitude >= 12 },
      { id: 'score', label: 'Score 400 000', test: (s) => s.score >= 400000 },
      { id: 'speed', label: 'Hit 110 km/h', test: (s) => s.maxSpeed >= 30.5 },
    ],
    async build(ctx) {
      ctx.addGround();
      ctx.addSkyline();
      ctx.addRoad(V(0, 0, -16), V(0, 0, 46));
      // The loop: full circle, radius 7.5, with entry/exit lips.
      ctx.addArcTrack({
        x: 0, zStart: 53, radius: 7.5, width: 6.5,
        angleFrom: -0.25, angleTo: Math.PI * 2 + 0.25, segments: 30, rails: true,
        color: 0x55483c,
      });
      ctx.addRoad(V(0, 0, 56), V(0, 0, 90));
      for (let z = -6; z < 44; z += 13) {
        ctx.addTree(-6.5, z);
        ctx.addTree(6.5, z + 6);
      }
      await ctx.addBillboard(V(-10, 0, 70), 0.7);
      await ctx.addModelStatic({
        path: '/assets/models/props/bannerTowerGreen.glb',
        position: V(-8, 0, 47), targetHeight: 8, collider: 'box',
      });
      await ctx.addModelStatic({
        path: '/assets/models/props/pylon.glb',
        position: V(8, 0, 47), targetHeight: 6, collider: 'box',
      });
    },
  },
  // ------------------------------------------------------------------
  {
    id: 'stairs',
    name: 'Stairway to Heaven',
    tagline: 'Twenty steps of municipal granite. A classic dismount.',
    spawn: { position: V(0, 7, -2), yaw: 0 },
    hotspots: [
      { position: V(0, 7, 20), yaw: 0, initial: 'empty' },
      { position: V(0, 0, 60), yaw: 0, initial: 'cones' },
      { position: V(0, 0, 78), yaw: 0, initial: 'empty' },
    ],
    npcs: [],
    scoreTarget: 650000,
    challenges: [
      { id: 'steps', label: '10 injuries in one run', test: (s) => s.injuries >= 10 },
      { id: 'score', label: 'Score 650 000', test: (s) => s.score >= 650000 },
      { id: 'yard', label: 'Lose 3 limbs', test: (s) => s.detachedParts >= 3 },
    ],
    async build(ctx) {
      // Raised plaza; stairs descend to lower ground.
      ctx.addGround();
      ctx.addSkyline();
      // Upper plaza slab from z=-20 to z=34, height 7.
      ctx.addBox({ size: [60, 7, 56], position: V(0, 3.5, 6), color: 0xbfa37a, name: 'plaza' });
      ctx.addRoad(V(0, 7.02, -16), V(0, 7.02, 30), 7);
      // Steps: 20 steps down 7m over z=34..54.
      const steps = 20;
      for (let i = 0; i < steps; i++) {
        const h = 7 - ((i + 1) * 7) / steps;
        ctx.addBox({
          size: [16, Math.max(h, 0.18), 1.0],
          position: V(0, Math.max(h, 0.18) / 2, 34.5 + i * 1.0),
          color: i % 2 === 0 ? 0xcdb68f : 0xc2aa82,
          name: 'stairs',
        });
      }
      // Side buildings on the plaza.
      const sides = ['building-d', 'building-f', 'building-i'];
      for (let i = 0; i < sides.length; i++) {
        await ctx.addModelStatic({
          path: `/assets/models/buildings/${sides[i]}.glb`,
          position: V(-16, 7, -4 + i * 16), yaw: Math.PI / 2, targetHeight: 12, collider: 'box',
        });
        await ctx.addModelStatic({
          path: `/assets/models/buildings/${sides[(i + 1) % 3]}.glb`,
          position: V(16, 7, 2 + i * 16), yaw: -Math.PI / 2, targetHeight: 11, collider: 'box',
        });
      }
      // Lower plaza dressing: fountain + lamp posts.
      ctx.addBox({ size: [6, 0.8, 6], position: V(0, 0.4, 86), color: 0x9fb6b8, name: 'fountain' });
      ctx.addBox({ size: [1.2, 2.2, 1.2], position: V(0, 1.5, 86), color: 0x8ea6a8, name: 'fountain' });
      await ctx.addModelStatic({
        path: '/assets/models/props/lightPostModern.glb',
        position: V(-9, 0, 70), targetHeight: 6, collider: 'box', name: 'lamp', material: 'metal',
      });
      await ctx.addModelStatic({
        path: '/assets/models/props/lightPostModern.glb',
        position: V(9, 0, 70), targetHeight: 6, collider: 'box', name: 'lamp', material: 'metal',
      });
      await ctx.addBillboard(V(12, 0, 90), -2.4);
    },
  },
];

export function levelById(id: string): LevelDef {
  const def = LEVELS.find((l) => l.id === id);
  if (!def) throw new Error(`Unknown level: ${id}`);
  return def;
}
