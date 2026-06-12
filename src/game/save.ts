import { LEVELS } from '../levels/defs';
import { VEHICLES } from './vehicle';

export interface SaveData {
  bestScores: Record<string, number>;
  /** Completed challenge ids per level. */
  challenges: Record<string, string[]>;
  muted: boolean;
}

const KEY = 'turbo-dismount-save-v1';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<SaveData>;
      return {
        bestScores: data.bestScores ?? {},
        challenges: data.challenges ?? {},
        muted: data.muted ?? false,
      };
    }
  } catch {
    /* fall through to fresh save */
  }
  return { bestScores: {}, challenges: {}, muted: false };
}

export function persistSave(save: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function totalChallenges(save: SaveData): number {
  return Object.values(save.challenges).reduce((n, arr) => n + arr.length, 0);
}

/** Level N+1 unlocks once level N has at least one completed challenge. */
export function unlockedLevels(save: SaveData): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    if (i === 0) {
      out.add(level.id);
      continue;
    }
    const prev = LEVELS[i - 1];
    if ((save.challenges[prev.id] ?? []).length >= 1) out.add(level.id);
    else break;
  }
  return out;
}

/** Locked vehicles unlock from total challenge count. */
export function unlockedVehicles(save: SaveData): Set<string> {
  const total = totalChallenges(save);
  const out = new Set<string>();
  let lockedSeen = 0;
  for (const v of VEHICLES) {
    if (!v.locked) {
      out.add(v.id);
    } else {
      lockedSeen++;
      if (total >= lockedSeen * 4) out.add(v.id);
    }
  }
  return out;
}

export function vehicleUnlockNote(save: SaveData): string | null {
  const total = totalChallenges(save);
  let lockedSeen = 0;
  for (const v of VEHICLES) {
    if (v.locked) {
      lockedSeen++;
      const needed = lockedSeen * 4;
      if (total < needed) {
        return `${needed - total} more challenge${needed - total === 1 ? '' : 's'} to unlock ${v.name}`;
      }
    }
  }
  return null;
}
