import * as THREE from 'three';
import { Engine } from '../core/engine';
import { Physics, ContactInfo, RAPIER } from '../core/physics';
import { AudioSystem } from '../core/audio';
import { Particles } from '../fx/particles';
import { CameraDirector } from './cameraDirector';
import { Dummy } from './dummy';
import { NpcCar } from './npc';
import { buildProp, PropInstance } from './props';
import { Replay } from './replay';
import { Scoring } from './scoring';
import { Vehicle, VehicleDef, VEHICLES } from './vehicle';
import { GROUP, groups, PALETTE, PoseId, PropType } from './data';
import { LevelContext } from '../levels/builder';
import { LevelDef, levelById, LEVELS } from '../levels/defs';
import { UI } from '../ui/ui';
import {
  loadSave, persistSave, SaveData, unlockedLevels, unlockedVehicles, vehicleUnlockNote,
} from './save';

type GameState =
  | 'title'
  | 'levels'
  | 'setup'
  | 'charging'
  | 'running'
  | 'settling'
  | 'results'
  | 'replay';

export class Game {
  state: GameState = 'title';
  physics!: Physics;
  levelCtx: LevelContext | null = null;
  level: LevelDef | null = null;
  vehicle: Vehicle | null = null;
  dummy: Dummy | null = null;
  npcs: NpcCar[] = [];
  props: (PropInstance | null)[] = [];
  propSelections: PropType[] = [];
  hotspotMarkers: THREE.Mesh[] = [];
  scoring = new Scoring();
  replay = new Replay();
  particles: Particles;
  cam: CameraDirector;
  save: SaveData;

  vehicleDef: VehicleDef = VEHICLES[0];
  pose: PoseId = 'seated';

  private chargeT = 0;
  private power = 0;
  private runTime = 0;
  private quietTime = 0;
  private slowmoLeft = 0;
  private slowmoUsed = false;
  private settleTimer = 0;
  private turboCooldown = new Map<string, number>();
  private steerLeft = false;
  private steerRight = false;
  private resultsArgs: Parameters<UI['showResults']>[0] | null = null;
  private replaySpeeds = [0.125, 0.25, 0.5, 1, 2, 4];
  private replaySpeedIdx = 3;
  private prevVehicleSpeed = 0;
  /** Debug telemetry for tuning crash thresholds: [time, decelG] per step. */
  decelLog: Array<[number, number]> = [];
  private replayPlaying = true;
  private sun!: THREE.DirectionalLight;
  private raycaster = new THREE.Raycaster();
  private pointerDownAt: { x: number; y: number } | null = null;

  constructor(
    public engine: Engine,
    public audio: AudioSystem,
    public ui: UI
  ) {
    this.save = loadSave();
    this.audio.setMuted(this.save.muted);
    this.particles = new Particles(engine.scene);
    this.cam = new CameraDirector(engine.camera, engine.renderer.domElement);
    this.cam.getVehicleFocus = () =>
      this.vehicle ? { pos: this.vehicle.position, vel: this.vehicle.velocity } : null;
    this.cam.getDummyFocus = () => (this.dummy ? this.dummy.pelvisPosition : null);

    this.setupEnvironment();
    this.bindInput();
    this.buildUI();

    engine.onFixedStep = (dt) => this.fixedStep(dt);
    engine.onRender = (alpha, dt) => this.render(alpha, dt);
  }

  // ------------------------------------------------------------------
  // Environment (sky, lights) - persistent across levels
  // ------------------------------------------------------------------

  private setupEnvironment() {
    const scene = this.engine.scene;
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#f3c897');
    grad.addColorStop(0.55, '#e8ab74');
    grad.addColorStop(1, '#dd9663');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
    scene.fog = new THREE.Fog(PALETTE.fog, 80, 290);

    const hemi = new THREE.HemisphereLight(0xffe6c4, 0xc9a76e, 0.95);
    scene.add(hemi);
    this.sun = new THREE.DirectionalLight(PALETTE.sun, 2.2);
    this.sun.position.set(45, 65, -25);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0008;
    scene.add(this.sun);
    scene.add(this.sun.target);
  }

  private buildUI() {
    this.ui.build({
      onPlay: () => {
        this.audio.resume();
        this.audio.ui('confirm');
        this.audio.startMusic();
        this.showLevels();
      },
      onSelectLevel: (id) => {
        this.audio.ui('click');
        void this.loadLevel(id, true);
      },
      onBack: () => {
        this.audio.ui('close');
        if (this.state === 'setup' || this.state === 'results') this.showLevels();
        else this.showTitle();
      },
      onVehiclePick: (id) => {
        this.audio.ui('select');
        this.vehicleDef = VEHICLES.find((v) => v.id === id)!;
        if (!this.vehicleDef.poses.includes(this.pose)) this.pose = this.vehicleDef.poses[0];
        void this.respawnActors();
      },
      onPosePick: (pose) => {
        this.audio.ui('select');
        this.pose = pose;
        void this.respawnActors();
      },
      onChargeStart: () => this.beginCharge(),
      onChargeEnd: () => this.releaseCharge(),
      onRetry: () => {
        this.audio.ui('click');
        void this.loadLevel(this.level!.id, false);
      },
      onWatchReplay: () => {
        this.audio.ui('open');
        this.enterReplay();
      },
      onExitReplay: () => {
        this.audio.ui('close');
        this.exitReplay();
      },
      onNextLevel: () => {
        this.audio.ui('confirm');
        const idx = LEVELS.findIndex((l) => l.id === this.level!.id);
        if (idx < LEVELS.length - 1) void this.loadLevel(LEVELS[idx + 1].id, true);
      },
      onPropPick: (i, type) => {
        this.audio.ui('select');
        void this.setProp(i, type);
      },
      onToggleMute: () => {
        this.save.muted = !this.save.muted;
        this.audio.setMuted(this.save.muted);
        persistSave(this.save);
        return this.save.muted;
      },
      onReplaySeek: (t) => {
        this.replayPlaying = false;
        this.replay.seek(t);
      },
      onReplaySpeed: (dir) => {
        this.replaySpeedIdx = Math.max(0, Math.min(this.replaySpeeds.length - 1, this.replaySpeedIdx + dir));
        this.applyReplaySpeed();
      },
      onReplayPlayPause: () => {
        this.replayPlaying = !this.replayPlaying;
        return this.replayPlaying;
      },
      onSteer: (dir, active) => {
        if (dir === 'left') this.steerLeft = active;
        else this.steerRight = active;
      },
    });
  }

  private bindInput() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.steerLeft = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.steerRight = true;
      if (e.code === 'Space') {
        e.preventDefault();
        if (this.state === 'setup') this.beginCharge();
        else if (this.state === 'results') void this.loadLevel(this.level!.id, false);
      }
      if (e.code === 'KeyR' && (this.state === 'running' || this.state === 'results')) {
        void this.loadLevel(this.level!.id, false);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.steerLeft = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.steerRight = false;
      if (e.code === 'Space' && this.state === 'charging') this.releaseCharge();
    });

    const canvas = this.engine.renderer.domElement;
    canvas.addEventListener('pointerdown', (e) => {
      this.pointerDownAt = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!this.pointerDownAt) return;
      const dx = e.clientX - this.pointerDownAt.x;
      const dy = e.clientY - this.pointerDownAt.y;
      this.pointerDownAt = null;
      if (Math.hypot(dx, dy) > 6) return;
      if (this.state === 'setup') this.handleSetupClick(e.clientX, e.clientY);
    });
  }

  // ------------------------------------------------------------------
  // State transitions
  // ------------------------------------------------------------------

  showTitle() {
    this.state = 'title';
    this.ui.showTitle();
    if (!this.level) void this.loadLevel(LEVELS[0].id, false, true);
  }

  showLevels() {
    this.state = 'levels';
    this.ui.showLevels(this.save, unlockedLevels(this.save));
  }

  async loadLevel(id: string, resetProps = true, backdropOnly = false) {
    const def = levelById(id);
    this.disposeLevel();
    this.level = def;
    this.physics = new Physics();
    this.levelCtx = new LevelContext(this.physics, this.engine.scene);
    await def.build(this.levelCtx);

    if (resetProps || this.propSelections.length !== def.hotspots.length) {
      this.propSelections = def.hotspots.map((h) => h.initial);
    }
    this.props = [];
    for (let i = 0; i < def.hotspots.length; i++) {
      this.props.push(null);
      await this.buildPropAt(i);
    }
    this.buildHotspotMarkers();

    this.npcs = [];
    for (const npcDef of def.npcs) {
      this.npcs.push(await NpcCar.create(this.physics, this.engine.scene, npcDef));
    }

    await this.spawnActors();
    this.scoring.reset();
    this.replay.dispose();

    if (backdropOnly) {
      // Title screen backdrop: slow orbit around the scene.
      this.cam.setOrbit(
        def.spawn.position.clone().add(new THREE.Vector3(0, 1.5, 14)),
        new THREE.Vector3(-14, 7, -13)
      );
      return;
    }

    this.state = 'setup';
    this.ui.showSetup(this.vehicleDef, this.pose, unlockedVehicles(this.save));
    this.ui.setBestLabel(this.save.bestScores[def.id] ?? 0);
    this.ui.banner(def.name, def.tagline, 2400);
    this.setMarkersVisible(true);
    const spawn = def.spawn.position;
    this.cam.setOrbit(
      spawn.clone().add(new THREE.Vector3(0, 1.5, 8)),
      new THREE.Vector3(-9, 5.5, -9)
    );
  }

  private disposeLevel() {
    this.dummy?.dispose(this.engine.scene);
    this.dummy = null;
    this.vehicle?.dispose();
    this.vehicle = null;
    for (const npc of this.npcs) npc.dispose();
    this.npcs = [];
    for (const p of this.props) p?.dispose();
    this.props = [];
    for (const m of this.hotspotMarkers) this.engine.scene.remove(m);
    this.hotspotMarkers = [];
    this.levelCtx?.dispose();
    this.levelCtx = null;
    this.replay.dispose();
    if (this.physics) this.physics.dispose();
  }

  private async spawnActors() {
    if (!this.level) return;
    this.vehicle = await Vehicle.create(this.physics, this.engine.scene, this.vehicleDef, {
      position: this.level.spawn.position.clone(),
      yaw: this.level.spawn.yaw,
    });
    this.dummy = new Dummy(
      this.physics,
      this.engine.scene,
      this.pose,
      this.vehicle.seatFrame(),
      this.vehicle.body
    );
    this.physics.snapVisuals();
  }

  private async respawnActors() {
    if (!this.level || this.state !== 'setup') return;
    this.dummy?.dispose(this.engine.scene);
    this.vehicle?.dispose();
    await this.spawnActors();
    this.ui.setVehicleLabel(this.vehicleDef, this.pose);
    this.ui.showSetup(this.vehicleDef, this.pose, unlockedVehicles(this.save));
    this.ui.setBestLabel(this.save.bestScores[this.level.id] ?? 0);
  }

  private async setProp(index: number, type: PropType) {
    this.propSelections[index] = type;
    await this.buildPropAt(index);
  }

  private async buildPropAt(index: number) {
    if (!this.level) return;
    this.props[index]?.dispose();
    this.props[index] = null;
    const hs = this.level.hotspots[index];
    const instance = await buildProp(this.propSelections[index], this.physics, this.engine.scene, {
      position: hs.position.clone(),
      yaw: hs.yaw,
    });
    if (instance) {
      // Sensors (mine, turbo) carry their hotspot index so the game can find
      // and remove the right instance. Solid props keep their own ownerIds.
      for (const body of instance.bodies) {
        for (let i = 0; i < body.numColliders(); i++) {
          const col = body.collider(i);
          const tag = this.physics.getTag(col.handle);
          if (tag && tag.kind === 'sensor') tag.ownerId = index;
        }
      }
    }
    this.props[index] = instance;
  }

  // ------------------------------------------------------------------
  // Hotspots
  // ------------------------------------------------------------------

  private buildHotspotMarkers() {
    if (!this.level) return;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = '#ffb904';
    ctx.lineWidth = 14;
    ctx.setLineDash([46, 26]);
    roundRect(ctx, 16, 16, 224, 224, 36);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,185,4,0.85)';
    ctx.beginPath();
    ctx.moveTo(128, 70);
    ctx.lineTo(170, 130);
    ctx.lineTo(140, 130);
    ctx.lineTo(140, 186);
    ctx.lineTo(116, 186);
    ctx.lineTo(116, 130);
    ctx.lineTo(86, 130);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    });
    this.level.hotspots.forEach((hs, i) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -hs.yaw;
      mesh.position.copy(hs.position).add(new THREE.Vector3(0, 0.14, 0));
      mesh.userData.hotspotIndex = i;
      mesh.renderOrder = 2;
      this.engine.scene.add(mesh);
      this.hotspotMarkers.push(mesh);
    });
  }

  private setMarkersVisible(visible: boolean) {
    for (const m of this.hotspotMarkers) m.visible = visible;
  }

  private handleSetupClick(x: number, y: number) {
    const ndc = new THREE.Vector2(
      (x / window.innerWidth) * 2 - 1,
      -(y / window.innerHeight) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.engine.camera);
    const hits = this.raycaster.intersectObjects(this.hotspotMarkers, false);
    if (hits.length > 0) {
      const idx = hits[0].object.userData.hotspotIndex as number;
      this.audio.ui('open');
      this.ui.showPropPicker(idx, this.propSelections[idx], x, y);
    } else {
      this.ui.hidePropPicker();
    }
  }

  // ------------------------------------------------------------------
  // Charge & launch
  // ------------------------------------------------------------------

  private beginCharge() {
    if (this.state !== 'setup') return;
    this.audio.resume();
    this.state = 'charging';
    this.chargeT = 0;
    this.ui.hidePickers();
    this.audio.startEngine();
  }

  private releaseCharge() {
    if (this.state !== 'charging') return;
    if (this.power < 0.06) {
      this.state = 'setup';
      this.ui.setGauge(0, false);
      this.ui.banner('STALLED', 'Hold to rev the engine, then release!', 1800);
      this.audio.setEngine(0, 0.3);
      this.audio.ui('error');
      return;
    }
    this.launch(this.power);
  }

  /** Start the run. Public for the test API. */
  launch(power: number) {
    if (!this.vehicle || !this.level) return;
    this.state = 'running';
    this.runTime = 0;
    this.quietTime = 0;
    this.slowmoUsed = false;
    this.steerLeft = false;
    this.steerRight = false;
    this.scoring.reset();
    this.scoring.stats.launchPower = power;
    this.ui.setGauge(0, false);
    this.ui.clearBanner();
    this.ui.showRunning();
    this.setMarkersVisible(false);
    this.vehicle.launch(power);
    this.prevVehicleSpeed = 0;
    this.decelLog = [];
    this.replay.start(this.physics);
    this.cam.startChase();
    this.audio.setEngine(power, 0.8);
  }

  // ------------------------------------------------------------------
  // Fixed step
  // ------------------------------------------------------------------

  private fixedStep(dt: number) {
    if (this.state !== 'running' && this.state !== 'settling') return;
    if (!this.vehicle || !this.level) return;

    this.runTime += dt;

    // Steering input. With the chase cam looking down +Z, screen-right is the
    // -X direction, so Left must drive +X and Right -X to match the player's
    // view. Both the keyboard and the on-screen buttons feed these flags.
    this.vehicle.steerInput = (this.steerLeft ? 1 : 0) - (this.steerRight ? 1 : 0);
    this.vehicle.fixedStep(dt);
    // Ghost traffic becomes physical shortly before contact so collisions are
    // dynamic-vs-dynamic (a kinematic body would slingshot the player).
    const vPos = this.vehicle.position;
    const dPos = this.dummy && !this.dummy.attached ? this.dummy.pelvisPosition : null;
    for (const npc of this.npcs) {
      if (!npc.awakened) {
        const p = npc.body.translation();
        const dv = Math.hypot(p.x - vPos.x, p.z - vPos.z);
        const dd = dPos ? Math.hypot(p.x - dPos.x, p.z - dPos.z) : 99;
        if (dv < 7.5 || dd < 4) npc.awaken();
      }
      npc.fixedStep(dt);
    }

    this.physics.step(dt);
    this.replay.capture();

    // Dummy flight tracking (grounded = short ray down from pelvis).
    if (this.dummy) {
      const grounded = this.groundedCheck(this.dummy.pelvisPosition);
      this.dummy.updateFlight(dt, grounded);
    }

    // A car that leaves a ramp spinning can't hold its passenger: a violent
    // mid-air tumble rips the straps even without a ground impact.
    if (this.dummy?.attached && !this.vehicle.grounded) {
      const av = this.vehicle.body.angvel();
      const spin = Math.hypot(av.x, av.y, av.z);
      if (spin > 4.2) {
        this.dummy.release();
        this.onEjection();
      }
    }

    // Crash detection: sudden speed loss tells us how hard the hit was, but it
    // only counts when there's a real collision this frame. The raycast-wheel
    // grip model can spike deceleration on flat ground with no contact at all,
    // so gating on an actual vehicle manifold (not just wheels-grounded) keeps
    // the car from spuriously totalling itself mid-drive.
    const speedNow = this.vehicle.speed;
    const decelG = Math.max(0, this.prevVehicleSpeed - speedNow) / dt / 9.81;
    this.prevVehicleSpeed = speedNow;
    this.decelLog.push([+this.runTime.toFixed(2), +decelG.toFixed(1)]);
    let peakSolidImpact = 0;
    for (const c of this.physics.contacts) {
      if (c.tag.kind === 'vehicle' && c.otherTag && c.otherTag.kind !== 'dummy') {
        peakSolidImpact = Math.max(peakSolidImpact, c.force);
      }
    }
    if (this.runTime > 0.45 && peakSolidImpact > 1500) {
      this.handleDeceleration(decelG, peakSolidImpact);
    }

    this.processContacts(this.physics.contacts);
    this.processSensors();
    this.scoring.step(dt, this.physics.contacts, this.dummy);
    this.drainScoreEvents();

    // Track stats.
    this.scoring.stats.maxSpeed = Math.max(this.scoring.stats.maxSpeed, this.vehicle.speed);
    if (this.dummy) {
      this.scoring.stats.maxAltitude = Math.max(
        this.scoring.stats.maxAltitude,
        this.dummy.maxPartAltitude - 0.9
      );
    }

    // Slow-mo countdown runs on simulated steps (real-time feel handled by scale).
    if (this.slowmoLeft > 0) {
      this.slowmoLeft -= dt;
      if (this.slowmoLeft <= 0) {
        this.engine.timeScale = 1;
        this.audio.setTimeFactor(1);
      }
    }

    if (this.state === 'running') {
      this.checkRunEnd(dt);
    } else if (this.state === 'settling') {
      this.settleTimer -= dt;
      if (this.settleTimer <= 0) this.finishRun();
    }
  }

  private groundedCheck(from: THREE.Vector3): boolean {
    const ray = new RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: 0, y: -1, z: 0 });
    // Filter: only ground/prop/vehicle surfaces count, never the dummy itself.
    const ground = this.physics.world.castRay(
      ray,
      1.4,
      true,
      undefined,
      groups(GROUP.DUMMY, GROUP.GROUND | GROUP.PROP | GROUP.VEHICLE | GROUP.NPC)
    );
    return ground !== null;
  }

  /**
   * Strap breaking, vehicle wrecking and wheel pops on a real impact. decelG is
   * how hard the speed dropped this frame; peakImpact is the strongest solid
   * contact force, so a gentle ramp scrape never totals the car.
   */
  private handleDeceleration(decelG: number, peakImpact: number) {
    if (!this.vehicle || !this.dummy) return;
    if (decelG < 3) return;

    if (this.dummy.attached) {
      const breaking = this.dummy.straps.filter((s) => decelG > s.breakForce);
      if (breaking.length > 0) {
        this.dummy.release(breaking);
        if (!this.dummy.attached) this.onEjection();
      }
    }
    if (decelG > 9 && peakImpact > 14000) {
      const at = this.vehicle.position;
      if (!this.vehicle.crashed) {
        this.vehicle.markCrashed();
        this.audio.impact('metal', 1);
        this.audio.impact('glass', 0.8);
        this.particles.sparks(at, 1);
        this.particles.dust(at, 0.8);
      }
      const popTarget = decelG > 18 ? 2 : 1;
      for (let i = 0; i < popTarget && this.scoring.stats.vehicleParts < 3; i++) {
        const popped = this.vehicle.popWheel();
        this.scoring.vehicleSmash(at, popped);
      }
    }
  }

  private processContacts(contacts: ContactInfo[]) {
    if (!this.vehicle || !this.dummy) return;

    for (const c of contacts) {
      // Player vehicle scraping the world: sound + sparks only.
      if (c.tag.kind === 'vehicle' && c.otherTag?.kind !== 'dummy') {
        if (c.force > 9000) {
          this.audio.impact('metal', Math.min(c.force / 35000, 1));
          this.particles.sparks(c.point, Math.min(c.force / 35000, 1));
        }
        if (c.otherTag?.kind === 'npc') this.handleNpcContact(c);
      }

      // Dummy impacts: audio + particles + slow-mo trigger.
      if (c.tag.kind === 'dummy') {
        const intensity = Math.min(c.force / 26000, 1);
        if (c.force > 2600) {
          this.audio.impact('flesh', intensity);
          this.particles.dust(c.point, intensity);
        }
        if (c.force > 12000 && !this.slowmoUsed) this.triggerSlowmo();
        if (c.otherTag?.kind === 'npc') this.handleNpcContact(c);
        // Hard dummy impact also breaks straps (e.g. dummy clipped a wall).
        // Feet/shins dragging the road shouldn't count - that's just style.
        const isLeg = c.tag.name.startsWith('shin') || c.tag.name.startsWith('thigh');
        const limit = isLeg ? 19000 : 8500;
        if (this.dummy.attached && c.force > limit) {
          this.dummy.release();
          this.onEjection();
        }
      }

      // NPC got rammed by debris/props/other awakened NPCs.
      if (c.tag.kind === 'npc' && c.otherTag && c.otherTag.kind !== 'ground' && c.force > 1200) {
        this.handleNpcContact(c);
      }

      if (c.tag.name === 'brick' && c.force > 2600) {
        this.audio.impact('wood', Math.min(c.force / 16000, 1));
      }
      if (c.tag.name === 'cone' && c.force > 1300) {
        this.audio.impact('soft', 0.5);
      }
    }
  }

  private handleNpcContact(c: ContactInfo) {
    const npcTag = c.tag.kind === 'npc' ? c.tag : c.otherTag;
    if (!npcTag) return;
    const npc = this.npcs.find((n) => `npc-${n.id}` === npcTag.name);
    if (!npc) return;
    npc.awaken();
    if (this.scoring.npcHit(npcTag.name, c.point)) {
      this.audio.impact('metal', 1);
      this.audio.impact('glass', 0.7);
      this.particles.sparks(c.point, 1);
      if (!this.slowmoUsed) this.triggerSlowmo();
    }
  }

  private processSensors() {
    for (const hit of this.physics.sensorHits) {
      if (hit.sensor.name === 'turbo' && hit.other?.kind === 'vehicle' && this.vehicle) {
        const key = `turbo-${hit.sensor.ownerId}`;
        const last = this.turboCooldown.get(key) ?? -10;
        if (this.runTime - last < 1.2) continue;
        this.turboCooldown.set(key, this.runTime);
        this.vehicle.applyBoost(9);
        const rot = this.vehicle.body.rotation();
        const fwd = new THREE.Vector3(0, 0, 1)
          .applyQuaternion(new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w))
          .normalize();
        this.audio.thud(0.8);
        const pos = this.vehicle.position;
        for (let i = 0; i < 8; i++) this.particles.turboFlame(pos, fwd);
        this.ui.banner('TURBO!', '', 700);
      }
      if (hit.sensor.name === 'mine') {
        const idx = hit.sensor.ownerId;
        if (idx === undefined) continue;
        const instance = this.props[idx];
        if (!instance || instance.type !== 'mine') continue;
        const hs = this.level!.hotspots[idx];
        this.explode(hs.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
        instance.dispose();
        this.props[idx] = null;
        this.scoring.mineBoom(hs.position);
      }
    }
  }

  private explode(at: THREE.Vector3) {
    this.audio.explosion();
    this.particles.explosion(at);
    const radius = 9;
    const strength = 13;
    for (const b of this.physics.allBindings()) {
      const body = b.body;
      if (body.isFixed() || body.isKinematic()) continue;
      const p = body.translation();
      const d = new THREE.Vector3(p.x - at.x, p.y - at.y, p.z - at.z);
      const dist = d.length();
      if (dist > radius) continue;
      const falloff = 1 - dist / radius;
      d.normalize().multiplyScalar(strength * falloff * body.mass());
      d.y += strength * falloff * body.mass() * 0.9;
      body.applyImpulse({ x: d.x, y: d.y, z: d.z }, true);
    }
    // Wake ghost NPCs in range and break dummy straps.
    for (const npc of this.npcs) {
      const p = npc.body.translation();
      if (new THREE.Vector3(p.x - at.x, p.y - at.y, p.z - at.z).length() < radius) npc.awaken();
    }
    if (this.dummy?.attached && this.dummy.pelvisPosition.distanceTo(at) < radius) {
      this.dummy.release();
      this.onEjection();
    }
    if (!this.slowmoUsed) this.triggerSlowmo();
  }

  private onEjection() {
    this.cam.startCrash();
    this.audio.stopEngine();
    if (!this.slowmoUsed) this.triggerSlowmo();
  }

  private triggerSlowmo() {
    this.slowmoUsed = true;
    this.slowmoLeft = 0.34; // simulated seconds; ~2s of real time at 0.17x
    this.engine.timeScale = 0.17;
    this.audio.setTimeFactor(0.17);
  }

  private checkRunEnd(dt: number) {
    if (!this.vehicle || !this.dummy) return;
    const vQuiet = this.vehicle.speed < 0.7;
    const dQuiet = this.dummy.isResting();
    const dPos = this.dummy.pelvisPosition;
    const vPos = this.vehicle.position;
    const outOfWorld = (p: THREE.Vector3) =>
      p.y < -12 || Math.abs(p.x) > 220 || p.z > 245 || p.z < -60;
    const fellOut = outOfWorld(dPos) && outOfWorld(vPos);
    if ((vQuiet && dQuiet && this.runTime > 3) || fellOut) {
      this.quietTime += dt;
    } else {
      this.quietTime = 0;
    }
    if (this.quietTime > 1.0 || this.runTime > 38) {
      this.state = 'settling';
      this.settleTimer = 1.0;
      this.engine.timeScale = 1;
      this.audio.setTimeFactor(1);
      this.audio.stopEngine();
      this.ui.banner(this.scoring.stats.injuries === 0 ? 'NAILED IT?' : 'DISMOUNT COMPLETE', '', 1600);
    }
  }

  private finishRun() {
    if (!this.level) return;
    this.state = 'results';
    this.replay.stop();
    this.scoring.finalize(this.dummy);
    this.drainScoreEvents();
    const stats = this.scoring.stats;

    const levelId = this.level.id;
    const prevBest = this.save.bestScores[levelId] ?? 0;
    const isNewBest = stats.score > prevBest;
    if (isNewBest) this.save.bestScores[levelId] = Math.round(stats.score);

    const prevDone = new Set(this.save.challenges[levelId] ?? []);
    const fresh = new Set<string>();
    for (const ch of this.level.challenges) {
      if (!prevDone.has(ch.id) && ch.test(stats)) {
        prevDone.add(ch.id);
        fresh.add(ch.id);
      }
    }
    const hadNext = unlockedLevels(this.save);
    this.save.challenges[levelId] = [...prevDone];
    persistSave(this.save);
    const hasNextNow = unlockedLevels(this.save);
    let unlockNote: string | null = null;
    for (const id of hasNextNow) {
      if (!hadNext.has(id)) unlockNote = `Level unlocked: ${levelById(id).name}`;
    }
    if (!unlockNote) unlockNote = fresh.size > 0 ? vehicleUnlockNote(this.save) : null;

    const nextDef = LEVELS[LEVELS.findIndex((l) => l.id === levelId) + 1];
    this.resultsArgs = {
      stats,
      best: this.save.bestScores[levelId] ?? 0,
      isNewBest,
      challenges: this.level.challenges,
      completed: prevDone,
      fresh,
      unlockNote,
      hasNext: !!nextDef && hasNextNow.has(nextDef.id),
    };
    this.ui.showResults(this.resultsArgs);
    this.audio.ui('confirm');
    if (this.dummy) this.cam.freeOrbitAround(this.dummy.pelvisPosition);
  }

  // ------------------------------------------------------------------
  // Replay
  // ------------------------------------------------------------------

  private enterReplay() {
    if (this.replay.frameCount < 2) return;
    this.state = 'replay';
    this.replay.cursor = 0;
    this.replaySpeedIdx = 3;
    this.replayPlaying = true;
    this.applyReplaySpeed();
    this.ui.showReplay();
    if (this.dummy) this.cam.freeOrbitAround(this.dummy.pelvisPosition);
  }

  private applyReplaySpeed() {
    this.replay.speed = this.replaySpeeds[this.replaySpeedIdx];
    this.ui.setReplaySpeedLabel(`${this.replaySpeeds[this.replaySpeedIdx]}x`);
  }

  private exitReplay() {
    this.state = 'results';
    // Snap visuals back to the live end state.
    this.replay.seek(1);
    if (this.resultsArgs) this.ui.showResults(this.resultsArgs);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  private render(alpha: number, dt: number) {
    if (this.state === 'replay') {
      if (this.replayPlaying) {
        const t = this.replay.tick();
        this.ui.setReplayProgress(t);
      }
    } else {
      this.physics?.syncVisuals(alpha);
    }
    this.vehicle?.syncWheels();
    this.particles.update(dt);
    this.cam.update(dt);

    // Sun follows the action for crisp shadows.
    const focus =
      this.state === 'running' || this.state === 'settling'
        ? this.dummy && !this.dummy.attached
          ? this.dummy.pelvisPosition
          : this.vehicle?.position
        : this.vehicle?.position;
    if (focus) {
      this.sun.target.position.lerp(focus, 0.2);
      this.sun.position.copy(this.sun.target.position).add(new THREE.Vector3(45, 65, -25));
    }

    if (this.state === 'charging') {
      this.chargeT += dt;
      const cycle = (this.chargeT / 1.45) % 1;
      this.power = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
      this.ui.setGauge(this.power, true);
      this.audio.setEngine(this.power, 0.6);
    }

    if (this.state === 'running' || this.state === 'settling') {
      this.ui.setScore(this.scoring.stats.score, this.scoring.combo);
      const v = this.vehicle;
      const lines: string[] = [];
      if (v) lines.push(`SPEED <b>${Math.round(v.speed * 3.6)}</b> km/h`);
      if (this.dummy && !this.dummy.attached) {
        lines.push(`AIRTIME <b>${this.dummy.airtime.toFixed(1)}</b>s`);
      }
      if (this.level?.gimmick === 'altitude') {
        lines.push(`ALTITUDE <b>${Math.max(0, this.scoring.stats.maxAltitude).toFixed(0)}</b>m`);
      }
      this.ui.setTelemetry(lines.join('<br/>'));
      this.audio.setEngine(
        Math.min((v?.speed ?? 0) / Math.max(this.vehicleDef.maxSpeed, 1), 1),
        v && v.driving && !v.crashed ? 0.55 : 0
      );
    }
  }

  private drainScoreEvents() {
    const events = this.scoring.pending;
    if (events.length === 0) return;
    for (const ev of events) {
      if (ev.at) {
        const v = ev.at.clone().project(this.engine.camera);
        if (v.z < 1) {
          const x = (v.x * 0.5 + 0.5) * window.innerWidth;
          const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
          const big = ev.points >= 50000 || ev.kind === 'detach';
          const text = ev.label ? `${ev.label} +${fmt(ev.points)}` : `+${fmt(ev.points)}`;
          if (ev.points > 2500 || ev.label) this.ui.popup(x, y, text, big, !!ev.label);
        }
      }
      if (ev.label && ev.kind !== 'impact') {
        this.ui.pushInjury(ev.kind, ev.label, ev.points);
        if (ev.kind === 'fracture' || ev.kind === 'dislocation' || ev.kind === 'detach') {
          this.audio.impact('crunch', 1);
        }
      }
    }
    this.scoring.pending = [];
  }

  // ------------------------------------------------------------------
  // Test API
  // ------------------------------------------------------------------

  /** Deterministic-ish driver for automated browser testing. */
  testApi() {
    return {
      state: () => this.state,
      loadLevel: (id: string) => this.loadLevel(id, true),
      setVehicle: async (id: string) => {
        this.vehicleDef = VEHICLES.find((v) => v.id === id)!;
        if (!this.vehicleDef.poses.includes(this.pose)) this.pose = this.vehicleDef.poses[0];
        await this.respawnActors();
      },
      setPose: async (p: PoseId) => {
        this.pose = p;
        await this.respawnActors();
      },
      setProp: (i: number, t: PropType) => this.setProp(i, t),
      launch: (power = 1) => this.launch(power),
      stepSeconds: (seconds: number, renderEvery = 6) => {
        const steps = Math.round(seconds * 60);
        for (let i = 0; i < steps; i++) {
          this.engine.onFixedStep(1 / 60);
          if (i % renderEvery === 0) {
            this.engine.onRender(1, 1 / 60);
            this.engine.renderer.render(this.engine.scene, this.engine.camera);
          }
        }
      },
      stats: () => this.scoring.stats,
      score: () => this.scoring.stats.score,
      vehiclePos: () => this.vehicle?.position.toArray(),
      dummyPos: () => this.dummy?.pelvisPosition.toArray(),
      dummyAttached: () => this.dummy?.attached,
      save: () => this.save,
      finishNow: () => {
        this.state = 'settling';
        this.settleTimer = 0;
        this.engine.onFixedStep(1 / 60);
      },
      game: this,
    };
  }
}

function fmt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
