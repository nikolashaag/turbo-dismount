import * as THREE from 'three';
import { ContactInfo } from '../core/physics';
import { emptyStats, PART_LABEL, PART_MULT, PartId, RunStats, ScoreEvent } from './data';
import { Dummy } from './dummy';

const FRACTURE_FORCE = 9000;
const DISLOCATE_FORCE = 22000;
const DETACH_FORCE = 36000;
const HEAD_DETACH_FORCE = 44000;

/**
 * Converts physics contacts and flight telemetry into TD-style scoring:
 * per-part impact ticks scaled by a decaying combo multiplier, discrete
 * injury events (fracture / dislocation / clean off), acrobatics bonuses.
 */
export class Scoring {
  stats: RunStats = emptyStats();
  combo = 1;
  private lastEventTime = -10;
  private partCooldown = new Map<PartId, number>();
  private fractured = new Set<PartId>();
  private dislocated = new Set<PartId>();
  private bricksSeen = new Set<string>();
  private conesSeen = new Set<string>();
  private npcSeen = new Set<string>();
  private spinAwarded = 0;
  private time = 0;
  /** Events produced this step, drained by the game for popups/audio. */
  pending: ScoreEvent[] = [];

  reset() {
    this.stats = emptyStats();
    this.combo = 1;
    this.lastEventTime = -10;
    this.partCooldown.clear();
    this.fractured.clear();
    this.dislocated.clear();
    this.bricksSeen.clear();
    this.conesSeen.clear();
    this.npcSeen.clear();
    this.spinAwarded = 0;
    this.time = 0;
    this.pending = [];
  }

  private push(ev: Omit<ScoreEvent, 'combo'>) {
    const event: ScoreEvent = { ...ev, combo: this.combo };
    event.points = Math.round(event.points);
    this.stats.score += event.points;
    this.stats.events.push(event);
    this.pending.push(event);
    if (event.points > 0) {
      this.combo = Math.min(10, this.combo + 0.25);
      this.stats.maxCombo = Math.max(this.stats.maxCombo, Math.floor(this.combo));
      this.lastEventTime = this.time;
    }
  }

  step(dt: number, contacts: ContactInfo[], dummy: Dummy | null) {
    this.time += dt;
    if (this.time - this.lastEventTime > 1.2) {
      this.combo = Math.max(1, this.combo - 5 * dt);
    }

    for (const c of contacts) {
      if (c.tag.kind === 'dummy') this.dummyImpact(c, dummy);
      else if (c.tag.name === 'brick') this.brickImpact(c);
      else if (c.tag.name === 'cone') this.coneImpact(c);
    }

    if (dummy && !dummy.attached) {
      // Somersault bonus per (slightly forgiving) full rotation while airborne.
      const turns = Math.floor(dummy.spinAccum / 5.8);
      while (this.spinAwarded < turns) {
        this.spinAwarded++;
        this.stats.somersaults++;
        this.push({
          kind: 'somersault',
          label: 'Somersault!',
          points: 26000 * this.combo,
          at: dummy.pelvisPosition,
        });
      }
      this.stats.maxAltitude = Math.max(this.stats.maxAltitude, dummy.maxPartAltitude);
    }
  }

  private dummyImpact(c: ContactInfo, dummy: Dummy | null) {
    const part = c.tag.name as PartId;
    const now = this.time;
    const last = this.partCooldown.get(part) ?? -10;
    if (now - last < 0.15) return;
    this.partCooldown.set(part, now);

    const mult = PART_MULT[part] ?? 1;
    const points = c.force * 0.14 * mult * this.combo;
    if (points < 350) return;

    // Discrete injuries on top of the raw impact tick.
    if (c.force > DETACH_FORCE && dummy) {
      const threshold = part === 'head' ? HEAD_DETACH_FORCE : DETACH_FORCE;
      if (c.force > threshold && dummy.detachPart(part)) {
        this.stats.detachedParts++;
        this.stats.injuries++;
        this.push({
          kind: 'detach',
          label: part === 'head' ? 'DECAPITATION!' : 'CLEAN OFF!',
          points: 90000 * this.combo,
          at: c.point,
          part,
        });
        return;
      }
    }
    if (c.force > DISLOCATE_FORCE && !this.dislocated.has(part)) {
      this.dislocated.add(part);
      this.stats.injuries++;
      this.push({
        kind: 'dislocation',
        label: `Shattered ${PART_LABEL[part]}!`,
        points: 40000 * this.combo,
        at: c.point,
        part,
      });
      return;
    }
    if (c.force > FRACTURE_FORCE && !this.fractured.has(part)) {
      this.fractured.add(part);
      this.stats.injuries++;
      this.stats.fractures++;
      this.push({
        kind: 'fracture',
        label: `Fractured ${PART_LABEL[part]}!`,
        points: 16000 * this.combo,
        at: c.point,
        part,
      });
      return;
    }
    this.push({ kind: 'impact', label: '', points, at: c.point, part });
  }

  private brickImpact(c: ContactInfo) {
    if (c.force < 2600) return;
    const key = `b${c.tag.ownerId ?? -1}`;
    if (this.bricksSeen.has(key)) return;
    this.bricksSeen.add(key);
    this.stats.bricksScattered++;
    this.push({ kind: 'brick', label: this.stats.bricksScattered % 10 === 0 ? 'Brickstorm!' : '', points: 900 * this.combo, at: c.point });
  }

  private coneImpact(c: ContactInfo) {
    if (c.force < 1300) return;
    const key = `${Math.round(c.point.x * 2)}:${Math.round(c.point.z * 2)}`;
    if (this.conesSeen.has(key)) return;
    this.conesSeen.add(key);
    this.push({ kind: 'cone', label: '', points: 1500 * this.combo, at: c.point });
  }

  npcHit(npcName: string, at: THREE.Vector3) {
    if (this.npcSeen.has(npcName)) return false;
    this.npcSeen.add(npcName);
    this.stats.npcHits++;
    this.push({ kind: 'traffic', label: 'Traffic!', points: 30000 * this.combo, at });
    return true;
  }

  mineBoom(at: THREE.Vector3) {
    this.stats.minesTriggered++;
    this.push({ kind: 'boom', label: 'KA-BOOM!', points: 55000 * this.combo, at });
  }

  vehicleSmash(at: THREE.Vector3, poppedWheel: boolean) {
    this.stats.vehicleParts++;
    this.push({
      kind: 'vehicle',
      label: poppedWheel ? 'Wheel Off!' : 'Vehicle Damage!',
      points: 12000 * this.combo,
      at,
    });
  }

  /** End-of-run bonuses; call once when the run settles. */
  finalize(dummy: Dummy | null) {
    if (dummy) {
      this.stats.airtime = dummy.airtime;
      if (dummy.airtime > 1.2) {
        this.push({
          kind: 'airtime',
          label: `Airtime ${dummy.airtime.toFixed(1)}s`,
          points: dummy.airtime * 14000,
        });
      }
      if (this.stats.maxAltitude > 12) {
        this.push({
          kind: 'altitude',
          label: `Max Altitude ${this.stats.maxAltitude.toFixed(0)}m`,
          points: this.stats.maxAltitude * 1200,
        });
      }
    }
    this.stats.nailedIt = this.stats.injuries === 0 && this.stats.vehicleParts === 0;
    if (this.stats.nailedIt) {
      this.push({ kind: 'impact', label: 'NAILED IT!', points: 50000 });
    }
  }
}
