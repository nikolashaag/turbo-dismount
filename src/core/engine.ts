import * as THREE from 'three';

export interface EngineOptions {
  canvas: HTMLCanvasElement;
}

/**
 * Renderer + scene + fixed-timestep driver.
 * Physics steps at a fixed dt (1/60). Slow motion scales how fast simulated
 * time accumulates, never the dt itself, so the simulation stays stable.
 * Rendering interpolates between the last two physics states.
 */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;

  /** Fixed physics timestep in seconds. */
  static readonly FIXED_DT = 1 / 60;

  /** 1 = realtime, 0.15 = slow-mo, 0 = paused. */
  timeScale = 1;

  /** Called once per fixed physics step. */
  onFixedStep: (dt: number) => void = () => {};
  /** Called once per rendered frame with interpolation alpha [0,1]. */
  onRender: (alpha: number, frameDt: number) => void = () => {};

  private accumulator = 0;
  private lastTime = -1;
  private rafId = 0;
  private running = false;
  /** Caps catch-up after tab switches; avoids spiral of death. */
  private static readonly MAX_FRAME_TIME = 0.1;

  constructor(opts: EngineOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      600
    );

    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = () => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = -1;
    this.rafId = requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private frame = (timeMs: number) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.frame);

    if (this.lastTime < 0) this.lastTime = timeMs;
    let frameDt = (timeMs - this.lastTime) / 1000;
    this.lastTime = timeMs;
    if (frameDt > Engine.MAX_FRAME_TIME) frameDt = Engine.MAX_FRAME_TIME;

    this.tick(frameDt);
  };

  /**
   * Advance simulated time by `frameDt * timeScale` and render once.
   * Public so tests can drive the engine deterministically without rAF.
   */
  tick(frameDt: number) {
    this.accumulator += frameDt * this.timeScale;
    let steps = 0;
    while (this.accumulator >= Engine.FIXED_DT && steps < 8) {
      this.onFixedStep(Engine.FIXED_DT);
      this.accumulator -= Engine.FIXED_DT;
      steps++;
    }
    const alpha = Math.min(this.accumulator / Engine.FIXED_DT, 1);
    this.onRender(alpha, frameDt);
    this.renderer.render(this.scene, this.camera);
  }
}
