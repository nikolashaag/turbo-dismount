import { PoseId, POSE_LABEL, PropType, PROP_ICON, PROP_LABEL, RunStats } from '../game/data';
import { VehicleDef, VEHICLES } from '../game/vehicle';
import { Challenge, LevelDef, LEVELS } from '../levels/defs';
import { SaveData } from '../game/save';

export interface UICallbacks {
  onPlay(): void;
  onSelectLevel(id: string): void;
  onBack(): void;
  onVehiclePick(id: string): void;
  onPosePick(pose: PoseId): void;
  onChargeStart(): void;
  onChargeEnd(): void;
  onRetry(): void;
  onWatchReplay(): void;
  onExitReplay(): void;
  onNextLevel(): void;
  onPropPick(hotspotIndex: number, type: PropType): void;
  onToggleMute(): boolean;
  onReplaySeek(t: number): void;
  onReplaySpeed(speed: number): void;
  onReplayPlayPause(): boolean;
  onSteer(dir: 'left' | 'right', active: boolean): void;
}

const INJURY_ICON: Record<string, string> = {
  fracture: '🦴',
  dislocation: '💥',
  detach: '🍗',
  somersault: '🌀',
  traffic: '🚗',
  boom: '💣',
  vehicle: '🔩',
  airtime: '🪂',
  altitude: '🚀',
};

export class UI {
  private root = document.getElementById('ui-root')!;
  private el = new Map<string, HTMLElement>();
  cb!: UICallbacks;
  private bannerTimer = 0;
  private chargeActive = false;

  build(cb: UICallbacks) {
    this.cb = cb;
    this.root.innerHTML = `
      <div class="vignette"></div>

      <div id="screen-title" class="screen hidden">
        <div class="title-logo td-text">TURBO<span class="line2">DISMOUNT</span></div>
        <div class="title-sub">a loving fan-made clone · crash responsibly</div>
        <button class="badge-btn" id="btn-play">PLAY!</button>
        <div class="title-sub" style="opacity:.8">made with Kenney assets · physics by Rapier</div>
      </div>

      <div id="screen-levels" class="screen hidden">
        <div class="levels-heading td-text">PICK YOUR POISON</div>
        <div class="levels-grid"></div>
        <div class="mode-row">
          <div class="hint">Complete challenges to unlock the next level. New vehicles unlock as your total grows.</div>
        </div>
      </div>

      <div id="hud" class="hidden">
        <div class="hud-score">
          <div class="label">SCORE</div>
          <div class="score td-text">0</div>
          <div class="label best-label"></div>
        </div>
        <div class="hud-combo td-text hidden">x1</div>
        <div class="hud-telemetry"></div>
        <div class="injury-stack"></div>
        <div class="steer-controls hidden">
          <button class="steer-btn" id="steer-left" aria-label="Steer left">◀</button>
          <button class="steer-btn" id="steer-right" aria-label="Steer right">▶</button>
        </div>
      </div>

      <div id="setup-bar" class="hidden">
        <button class="setup-btn" id="btn-vehicle"><span class="ico">🚗</span>VEHICLE<span class="val"></span></button>
        <button class="setup-btn" id="btn-pose"><span class="ico">🤸</span>POSE<span class="val"></span></button>
        <button class="setup-btn" id="btn-camera"><span class="ico">🎥</span>ORBIT<span class="val">drag to spin</span></button>
      </div>
      <div class="hint-text hidden" id="dismount-hint">Hold to rev the engine,<br/>release to dismount!</div>
      <button id="dismount-btn" class="hidden">DISMOUNT!</button>
      <div id="gauge" class="hidden"><div class="fill"></div></div>
      <button id="back-btn" class="hidden">↩</button>
      <button id="mute-btn" class="hidden">🔊</button>

      <div id="vehicle-picker" class="picker hidden"></div>
      <div id="pose-picker" class="picker hidden"></div>
      <div id="prop-picker" class="hidden"></div>

      <div id="popup-layer"></div>
      <div id="banner-layer"></div>

      <div id="results" class="hidden"></div>

      <div class="replay-title td-text hidden" id="replay-title">INSTANT REPLAY</div>
      <div id="replay-bar" class="hidden">
        <button id="rp-play">⏸</button>
        <input type="range" id="rp-seek" min="0" max="1000" value="0" />
        <button id="rp-slower">🐢</button>
        <div class="speed" id="rp-speed">1x</div>
        <button id="rp-faster">🐇</button>
        <button class="badge-btn small dark" id="rp-exit">DONE</button>
      </div>
    `;

    const ids = [
      'screen-title', 'screen-levels', 'hud', 'setup-bar', 'dismount-btn',
      'dismount-hint', 'gauge', 'back-btn', 'mute-btn', 'vehicle-picker', 'pose-picker',
      'prop-picker', 'popup-layer', 'banner-layer', 'results', 'replay-bar', 'replay-title',
    ];
    for (const id of ids) this.el.set(id, document.getElementById(id)!);
    this.setLoadingScreen();

    document.getElementById('btn-play')!.onclick = () => cb.onPlay();
    this.el.get('back-btn')!.onclick = () => cb.onBack();
    this.el.get('mute-btn')!.onclick = () => {
      const muted = cb.onToggleMute();
      this.el.get('mute-btn')!.textContent = muted ? '🔇' : '🔊';
    };
    document.getElementById('btn-vehicle')!.onclick = () => this.togglePicker('vehicle-picker');
    document.getElementById('btn-pose')!.onclick = () => this.togglePicker('pose-picker');
    document.getElementById('btn-camera')!.onclick = () => this.toast('Drag to orbit, scroll to zoom');

    const dismount = this.el.get('dismount-btn')!;
    dismount.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.chargeActive = true;
      cb.onChargeStart();
    });
    window.addEventListener('pointerup', () => {
      if (this.chargeActive) {
        this.chargeActive = false;
        cb.onChargeEnd();
      }
    });

    // Replay controls
    document.getElementById('rp-exit')!.onclick = () => cb.onExitReplay();
    document.getElementById('rp-play')!.onclick = () => {
      const playing = cb.onReplayPlayPause();
      document.getElementById('rp-play')!.textContent = playing ? '⏸' : '▶';
    };
    const seek = document.getElementById('rp-seek') as HTMLInputElement;
    seek.oninput = () => cb.onReplaySeek(Number(seek.value) / 1000);
    document.getElementById('rp-slower')!.onclick = () => cb.onReplaySpeed(-1);
    document.getElementById('rp-faster')!.onclick = () => cb.onReplaySpeed(1);

    // On-screen steering: hold-to-steer, release-to-center. Press is captured so
    // a finger that slides off the button still releases cleanly, and the touch
    // never doubles as a camera-drag on the canvas.
    for (const dir of ['left', 'right'] as const) {
      const btn = document.getElementById(`steer-${dir}`)!;
      const press = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.add('held');
        cb.onSteer(dir, true);
      };
      const release = () => {
        if (!btn.classList.contains('held')) return;
        btn.classList.remove('held');
        cb.onSteer(dir, false);
      };
      btn.addEventListener('pointerdown', (e) => {
        press(e);
        (e as PointerEvent).pointerId !== undefined &&
          btn.setPointerCapture((e as PointerEvent).pointerId);
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    }
  }

  /** Minimal loading screen available before build() runs. */
  setLoadingScreen() {
    if (document.getElementById('loading')) return;
    const div = document.createElement('div');
    div.id = 'loading';
    div.innerHTML = `
      <div class="td-text">TURBO DISMOUNT</div>
      <div class="bar"><div class="fill"></div></div>
      <div style="font-weight:700;color:#3d2417">warming up the crash test lab...</div>`;
    this.root.appendChild(div);
  }

  setLoading(progress: number, done = false) {
    const loading = document.getElementById('loading');
    if (!loading) return;
    if (done) {
      loading.classList.add('hidden');
      return;
    }
    loading.classList.remove('hidden');
    (loading.querySelector('.fill') as HTMLElement).style.width = `${Math.round(progress * 100)}%`;
  }

  private show(ids: string[]) {
    const all = [
      'screen-title', 'screen-levels', 'hud', 'setup-bar', 'dismount-btn', 'dismount-hint',
      'gauge', 'back-btn', 'vehicle-picker', 'pose-picker', 'prop-picker', 'results',
      'replay-bar', 'replay-title',
    ];
    for (const id of all) this.el.get(id)!.classList.toggle('hidden', !ids.includes(id));
    this.el.get('mute-btn')!.classList.remove('hidden');
    // Steer controls live inside #hud; only showRunning() re-reveals them.
    this.root.querySelector('.steer-controls')?.classList.add('hidden');
  }

  showTitle() {
    this.show(['screen-title']);
  }

  showLevels(save: SaveData, unlockedIds: Set<string>) {
    this.show(['screen-levels', 'back-btn']);
    const grid = this.root.querySelector('.levels-grid')!;
    grid.innerHTML = '';
    for (const level of LEVELS) {
      const unlocked = unlockedIds.has(level.id);
      const done = new Set(save.challenges[level.id] ?? []);
      const card = document.createElement('div');
      card.className = `level-card${unlocked ? '' : ' locked'}`;
      const best = save.bestScores[level.id];
      card.innerHTML = `
        <div class="dots">${level.challenges
          .map((c) => `<div class="dot${done.has(c.id) ? ' done' : ''}"></div>`)
          .join('')}</div>
        <h3>${level.name}</h3>
        <p>${level.tagline}</p>
        <div class="best">${best ? `BEST ${formatScore(best)}` : 'not yet attempted'}</div>
        ${unlocked ? '' : '<div class="lock">🔒</div>'}
      `;
      if (unlocked) card.onclick = () => this.cb.onSelectLevel(level.id);
      grid.appendChild(card);
    }
  }

  showSetup(vehicle: VehicleDef, pose: PoseId, unlockedVehicles: Set<string>) {
    this.show(['hud', 'setup-bar', 'dismount-btn', 'dismount-hint', 'back-btn']);
    this.setVehicleLabel(vehicle, pose);
    this.buildVehiclePicker(vehicle.id, unlockedVehicles);
    this.buildPosePicker(vehicle, pose);
    this.clearInjuries();
    this.setScore(0, 1);
  }

  showRunning() {
    this.show(['hud']);
    this.root.querySelector('.steer-controls')!.classList.remove('hidden');
  }

  showResults(opts: {
    stats: RunStats;
    best: number;
    isNewBest: boolean;
    challenges: Challenge[];
    completed: Set<string>;
    fresh: Set<string>;
    unlockNote: string | null;
    hasNext: boolean;
  }) {
    this.show(['results']);
    const r = this.el.get('results')!;
    const s = opts.stats;
    const rows: Array<[string, string]> = [
      ['Injuries', String(s.injuries)],
      ['Limbs lost', String(s.detachedParts)],
      ['Somersaults', String(s.somersaults)],
      ['Max combo', `x${s.maxCombo}`],
      ['Airtime', `${s.airtime.toFixed(1)}s`],
      ['Max altitude', `${s.maxAltitude.toFixed(0)}m`],
      ['Top speed', `${Math.round(s.maxSpeed * 3.6)} km/h`],
      ['Traffic hits', String(s.npcHits)],
    ];
    r.innerHTML = `
      <div class="results-panel">
        <h2 class="td-text">${s.nailedIt ? 'NAILED IT!' : 'DISMOUNT COMPLETE'}</h2>
        <div class="final-score">${formatScore(s.score)}</div>
        <div class="pb ${opts.isNewBest ? 'new' : ''}">${
          opts.isNewBest ? '★ NEW PERSONAL BEST ★' : `personal best ${formatScore(opts.best)}`
        }</div>
        <div class="breakdown">
          ${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}
        </div>
        <div class="challenges">
          <h3>CHALLENGES</h3>
          ${opts.challenges
            .map((c) => {
              const done = opts.completed.has(c.id);
              const fresh = opts.fresh.has(c.id);
              return `<div class="challenge-row ${done ? 'done' : ''} ${fresh ? 'fresh' : ''}">
                <span class="check">✓</span><span>${c.label}</span>${fresh ? '<span>NEW!</span>' : ''}
              </div>`;
            })
            .join('')}
        </div>
        ${opts.unlockNote ? `<div class="unlock-note">🔓 ${opts.unlockNote}</div>` : ''}
        <div class="results-actions">
          <button class="badge-btn small" id="res-retry">RETRY</button>
          <button class="badge-btn small dark" id="res-replay">INSTANT REPLAY</button>
          ${opts.hasNext ? '<button class="badge-btn small green" id="res-next">NEXT LEVEL</button>' : ''}
          <button class="badge-btn small dark" id="res-levels">LEVELS</button>
        </div>
      </div>
    `;
    document.getElementById('res-retry')!.onclick = () => this.cb.onRetry();
    document.getElementById('res-replay')!.onclick = () => this.cb.onWatchReplay();
    document.getElementById('res-levels')!.onclick = () => this.cb.onBack();
    const next = document.getElementById('res-next');
    if (next) next.onclick = () => this.cb.onNextLevel();
  }

  showReplay() {
    this.show(['replay-bar', 'replay-title', 'hud']);
    document.getElementById('rp-play')!.textContent = '⏸';
  }

  setReplayProgress(t: number) {
    (document.getElementById('rp-seek') as HTMLInputElement).value = String(Math.round(t * 1000));
  }

  setReplaySpeedLabel(label: string) {
    document.getElementById('rp-speed')!.textContent = label;
  }

  // ---- pickers ----

  private togglePicker(id: 'vehicle-picker' | 'pose-picker') {
    const el = this.el.get(id)!;
    const other = this.el.get(id === 'vehicle-picker' ? 'pose-picker' : 'vehicle-picker')!;
    other.classList.add('hidden');
    this.el.get('prop-picker')!.classList.add('hidden');
    el.classList.toggle('hidden');
  }

  hidePickers() {
    this.el.get('vehicle-picker')!.classList.add('hidden');
    this.el.get('pose-picker')!.classList.add('hidden');
    this.el.get('prop-picker')!.classList.add('hidden');
  }

  setVehicleLabel(vehicle: VehicleDef, pose: PoseId) {
    (document.querySelector('#btn-vehicle .val') as HTMLElement).textContent = vehicle.name;
    (document.querySelector('#btn-pose .val') as HTMLElement).textContent = POSE_LABEL[pose];
  }

  private buildVehiclePicker(activeId: string, unlocked: Set<string>) {
    const el = this.el.get('vehicle-picker')!;
    el.innerHTML = '';
    for (const v of VEHICLES) {
      const isUnlocked = unlocked.has(v.id);
      const card = document.createElement('div');
      card.className = `pick-card${v.id === activeId ? ' active' : ''}${isUnlocked ? '' : ' locked'}`;
      const pips = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);
      card.innerHTML = `
        <h4>${v.name}</h4>
        <p>${isUnlocked ? v.desc : 'Locked: complete more challenges!'}</p>
        <div class="pips">SPD ${pips(v.stats.speed)}<br/>WGT <span>${pips(v.stats.weight)}</span><br/>CHA ${pips(v.stats.chaos)}</div>
      `;
      if (isUnlocked) {
        card.onclick = () => {
          this.cb.onVehiclePick(v.id);
          this.el.get('vehicle-picker')!.classList.add('hidden');
        };
      }
      el.appendChild(card);
    }
  }

  private buildPosePicker(vehicle: VehicleDef, active: PoseId) {
    const el = this.el.get('pose-picker')!;
    el.innerHTML = '';
    const icons: Record<PoseId, string> = {
      seated: '🪑',
      superman: '🦸',
      surfer: '🏄',
      clinger: '🫷',
    };
    for (const p of vehicle.poses) {
      const card = document.createElement('div');
      card.className = `pick-card${p === active ? ' active' : ''}`;
      card.innerHTML = `<div class="ico">${icons[p]}</div><h4>${POSE_LABEL[p]}</h4>`;
      card.onclick = () => {
        this.cb.onPosePick(p);
        this.el.get('pose-picker')!.classList.add('hidden');
      };
      el.appendChild(card);
    }
  }

  /** Prop picker anchored near a screen point. */
  showPropPicker(hotspotIndex: number, current: PropType, screenX: number, screenY: number) {
    const el = this.el.get('prop-picker')!;
    el.classList.remove('hidden');
    el.innerHTML = '';
    const types: PropType[] = ['empty', 'ramp', 'brickwall', 'megawall', 'turbo', 'mine', 'cones'];
    for (const t of types) {
      const b = document.createElement('div');
      b.className = `prop-opt${t === current ? ' active' : ''}`;
      b.innerHTML = `<span class="ico">${PROP_ICON[t]}</span>${PROP_LABEL[t]}`;
      b.onclick = () => {
        this.cb.onPropPick(hotspotIndex, t);
        el.classList.add('hidden');
      };
      el.appendChild(b);
    }
    const w = 350;
    el.style.left = `${Math.min(Math.max(screenX - w / 2, 12), window.innerWidth - w - 12)}px`;
    el.style.top = `${Math.min(Math.max(screenY - 150, 12), window.innerHeight - 180)}px`;
  }

  hidePropPicker() {
    this.el.get('prop-picker')!.classList.add('hidden');
  }

  // ---- HUD ----

  setScore(score: number, combo: number) {
    (this.root.querySelector('.hud-score .score') as HTMLElement).textContent = formatScore(score);
    const comboEl = this.root.querySelector('.hud-combo') as HTMLElement;
    if (combo >= 2) {
      comboEl.classList.remove('hidden');
      comboEl.textContent = `x${Math.floor(combo)}`;
      comboEl.style.transform = `rotate(${(combo % 2) * 4 - 2}deg) scale(${1 + combo * 0.04})`;
    } else {
      comboEl.classList.add('hidden');
    }
  }

  setBestLabel(best: number) {
    (this.root.querySelector('.best-label') as HTMLElement).textContent = best
      ? `BEST ${formatScore(best)}`
      : '';
  }

  setTelemetry(html: string) {
    (this.root.querySelector('.hud-telemetry') as HTMLElement).innerHTML = html;
  }

  pushInjury(kind: string, label: string, points: number) {
    const stack = this.root.querySelector('.injury-stack')!;
    const chip = document.createElement('div');
    chip.className = 'injury-chip';
    chip.innerHTML = `<span class="ico">${INJURY_ICON[kind] ?? '💢'}</span><span>${label}</span><b>+${formatScore(points)}</b>`;
    stack.prepend(chip);
    while (stack.children.length > 9) stack.removeChild(stack.lastChild!);
  }

  clearInjuries() {
    this.root.querySelector('.injury-stack')!.innerHTML = '';
  }

  popup(x: number, y: number, text: string, big: boolean, isLabel: boolean) {
    const layer = this.el.get('popup-layer')!;
    if (layer.children.length > 24) layer.removeChild(layer.firstChild!);
    const div = document.createElement('div');
    div.className = `popup${big ? ' big' : ''}${isLabel ? ' label' : ''}`;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    div.textContent = text;
    layer.appendChild(div);
    setTimeout(() => div.remove(), 1100);
  }

  banner(text: string, sub = '', ms = 1800) {
    const layer = this.el.get('banner-layer')!;
    layer.innerHTML = `<div class="banner td-text">${text}${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
    clearTimeout(this.bannerTimer);
    if (ms > 0) {
      this.bannerTimer = window.setTimeout(() => (layer.innerHTML = ''), ms);
    }
  }

  clearBanner() {
    this.el.get('banner-layer')!.innerHTML = '';
  }

  toast(text: string) {
    this.banner(text, '', 1200);
  }

  setGauge(power: number, visible: boolean) {
    const g = this.el.get('gauge')!;
    g.classList.toggle('hidden', !visible);
    (g.querySelector('.fill') as HTMLElement).style.width = `${Math.round(power * 100)}%`;
    this.el.get('dismount-btn')!.classList.toggle('charging', visible);
  }

  /** Toggle the setup buttons + hint without touching the DISMOUNT badge. */
  setSetupBarVisible(visible: boolean) {
    this.el.get('setup-bar')!.classList.toggle('hidden', !visible);
    this.el.get('dismount-hint')!.classList.toggle('hidden', !visible);
  }

  hideHUDForSettle() {
    this.el.get('setup-bar')!.classList.add('hidden');
    this.el.get('dismount-btn')!.classList.add('hidden');
    this.el.get('dismount-hint')!.classList.add('hidden');
  }
}

export function formatScore(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function levelDefAfter(id: string): LevelDef | null {
  const idx = LEVELS.findIndex((l) => l.id === id);
  return idx >= 0 && idx < LEVELS.length - 1 ? LEVELS[idx + 1] : null;
}
