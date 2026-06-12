import * as THREE from 'three';

/** Collision group bits (Rapier: 16 bits membership << 16 | 16 bits filter). */
export const GROUP = {
  GROUND: 1 << 0,
  VEHICLE: 1 << 1,
  DUMMY: 1 << 2,
  PROP: 1 << 3,
  NPC: 1 << 4,
  DEBRIS: 1 << 5,
} as const;

export function groups(membership: number, filter: number): number {
  return (membership << 16) | filter;
}

export const ALL =
  GROUP.GROUND | GROUP.VEHICLE | GROUP.DUMMY | GROUP.PROP | GROUP.NPC | GROUP.DEBRIS;

/** Dummy body part ids. */
export type PartId =
  | 'head'
  | 'torso'
  | 'pelvis'
  | 'armUpperL'
  | 'armUpperR'
  | 'armLowerL'
  | 'armLowerR'
  | 'thighL'
  | 'thighR'
  | 'shinL'
  | 'shinR';

export const PART_LABEL: Record<PartId, string> = {
  head: 'Skull',
  torso: 'Ribs',
  pelvis: 'Pelvis',
  armUpperL: 'Shoulder',
  armUpperR: 'Shoulder',
  armLowerL: 'Arm',
  armLowerR: 'Arm',
  thighL: 'Hip',
  thighR: 'Hip',
  shinL: 'Leg',
  shinR: 'Leg',
};

/** Score multiplier per body part. */
export const PART_MULT: Record<PartId, number> = {
  head: 3,
  torso: 1.6,
  pelvis: 1.4,
  armUpperL: 1,
  armUpperR: 1,
  armLowerL: 0.8,
  armLowerR: 0.8,
  thighL: 1.1,
  thighR: 1.1,
  shinL: 0.9,
  shinR: 0.9,
};

export interface ScoreEvent {
  kind:
    | 'impact'
    | 'fracture'
    | 'dislocation'
    | 'detach'
    | 'somersault'
    | 'airtime'
    | 'vehicle'
    | 'traffic'
    | 'boom'
    | 'brick'
    | 'cone'
    | 'altitude';
  label: string;
  points: number;
  combo: number;
  /** World position for the floating popup. */
  at?: THREE.Vector3;
  part?: PartId;
}

export interface RunStats {
  score: number;
  maxCombo: number;
  injuries: number;
  fractures: number;
  detachedParts: number;
  somersaults: number;
  maxAltitude: number;
  maxSpeed: number;
  airtime: number;
  minesTriggered: number;
  npcHits: number;
  bricksScattered: number;
  vehicleParts: number;
  nailedIt: boolean;
  launchPower: number;
  events: ScoreEvent[];
}

export function emptyStats(): RunStats {
  return {
    score: 0,
    maxCombo: 1,
    injuries: 0,
    fractures: 0,
    detachedParts: 0,
    somersaults: 0,
    maxAltitude: 0,
    maxSpeed: 0,
    airtime: 0,
    minesTriggered: 0,
    npcHits: 0,
    bricksScattered: 0,
    vehicleParts: 0,
    nailedIt: false,
    launchPower: 0,
    events: [],
  };
}

export type PoseId = 'seated' | 'superman' | 'surfer' | 'clinger';

export const POSE_LABEL: Record<PoseId, string> = {
  seated: 'Take a Seat',
  superman: 'Superman',
  surfer: 'Roof Surfer',
  clinger: 'Hood Ornament',
};

export type PropType =
  | 'empty'
  | 'ramp'
  | 'brickwall'
  | 'megawall'
  | 'turbo'
  | 'mine'
  | 'cones';

export const PROP_LABEL: Record<PropType, string> = {
  empty: 'Empty',
  ramp: 'Ramp',
  brickwall: 'Brick Wall',
  megawall: 'Mega Wall',
  turbo: 'Turbo Pad',
  mine: 'Land Mine',
  cones: 'Traffic Cones',
};

export const PROP_ICON: Record<PropType, string> = {
  empty: '∅',
  ramp: '◢',
  brickwall: '▤',
  megawall: '█',
  turbo: '»',
  mine: '✸',
  cones: '▲',
};

/** TD1 sepia palette. */
export const PALETTE = {
  skyTop: 0xe8b488,
  skyBottom: 0xe6a06b,
  fog: 0xe2a877,
  sun: 0xfff1d6,
  ground: 0xc9a76e,
  road: 0x39322b,
  skyline: 0xe97e2e,
  skylineFar: 0xe9b57b,
  treeCanopy: 0x8a7d33,
  treeTrunk: 0x7d5034,
  dummy: 0xd8d3c8,
  dummyJoint: 0xb7b1a4,
};
