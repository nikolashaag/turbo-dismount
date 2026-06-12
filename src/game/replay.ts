import { Physics, Binding } from '../core/physics';

/**
 * Records every fixed step's transforms for all physics bindings so the crash
 * can be scrubbed back and forth (TD2 replay: slow-mo slider, rewind, speeds).
 */
export class Replay {
  private frames: Float32Array[] = [];
  private bindings: Binding[] = [];
  recording = false;
  /** Playback cursor (fractional frame index). */
  cursor = 0;
  /** Playback speed in frames per frame; 0 = paused. Negative rewinds. */
  speed = 1;

  get frameCount() {
    return this.frames.length;
  }

  start(physics: Physics) {
    this.bindings = physics.allBindings();
    this.frames = [];
    this.recording = true;
    this.capture();
  }

  /** Call after each physics step while recording. */
  capture() {
    if (!this.recording) return;
    const f = new Float32Array(this.bindings.length * 7);
    let o = 0;
    for (const b of this.bindings) {
      f[o++] = b.currPos.x;
      f[o++] = b.currPos.y;
      f[o++] = b.currPos.z;
      f[o++] = b.currRot.x;
      f[o++] = b.currRot.y;
      f[o++] = b.currRot.z;
      f[o++] = b.currRot.w;
    }
    this.frames.push(f);
    // Cap at ~60s of footage.
    if (this.frames.length > 3600) this.frames.shift();
  }

  stop() {
    this.recording = false;
  }

  /** Apply frame at the cursor to the bound visuals. */
  apply() {
    if (this.frames.length === 0) return;
    const idx = Math.max(0, Math.min(this.frames.length - 1, Math.round(this.cursor)));
    const f = this.frames[idx];
    let o = 0;
    for (const b of this.bindings) {
      b.object.position.set(f[o], f[o + 1], f[o + 2]);
      b.object.quaternion.set(f[o + 3], f[o + 4], f[o + 5], f[o + 6]);
      o += 7;
    }
  }

  /** Advance cursor by playback speed; returns normalized position 0..1. */
  tick(): number {
    this.cursor += this.speed;
    this.cursor = Math.max(0, Math.min(this.frames.length - 1, this.cursor));
    this.apply();
    return this.frames.length > 1 ? this.cursor / (this.frames.length - 1) : 0;
  }

  seek(normalized: number) {
    this.cursor = normalized * (this.frames.length - 1);
    this.apply();
  }

  dispose() {
    this.frames = [];
    this.bindings = [];
    this.recording = false;
  }
}
