import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CamMode = 'orbit' | 'chase' | 'crash';

/**
 * Camera direction: free orbit during setup/replay, smoothed chase cam during
 * the run, dummy-following crash cam after ejection.
 */
export class CameraDirector {
  mode: CamMode = 'orbit';
  controls: OrbitControls;
  private chasePos = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  /** Where the chase/crash cam reads its target from. */
  getVehicleFocus: (() => { pos: THREE.Vector3; vel: THREE.Vector3 } | null) = () => null;
  getDummyFocus: (() => THREE.Vector3 | null) = () => null;

  constructor(private camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 80;
  }

  setOrbit(target: THREE.Vector3, offset: THREE.Vector3) {
    this.mode = 'orbit';
    this.controls.enabled = true;
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  startChase() {
    this.mode = 'chase';
    this.controls.enabled = false;
    this.chasePos.copy(this.camera.position);
    this.lookTarget.copy(this.controls.target);
  }

  startCrash() {
    if (this.mode === 'chase') this.mode = 'crash';
  }

  /** Re-enable manual orbiting around a point (results/replay). */
  freeOrbitAround(target: THREE.Vector3) {
    this.mode = 'orbit';
    this.controls.enabled = true;
    this.controls.target.copy(target);
    if (this.camera.position.distanceTo(target) > 40) {
      const dir = this.camera.position.clone().sub(target).normalize();
      this.camera.position.copy(target).addScaledVector(dir, 18);
    }
    this.controls.update();
  }

  update(dt: number) {
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }
    const k = 1 - Math.pow(0.0012, dt); // smooth, framerate independent
    if (this.mode === 'chase') {
      const focus = this.getVehicleFocus();
      if (!focus) return;
      const speedDir =
        focus.vel.lengthSq() > 1 ? focus.vel.clone().normalize() : new THREE.Vector3(0, 0, 1);
      const desired = focus.pos
        .clone()
        .addScaledVector(speedDir, -10.5)
        .add(new THREE.Vector3(0, 4.6, 0));
      this.chasePos.lerp(desired, k);
      this.camera.position.copy(this.chasePos);
      this.lookTarget.lerp(focus.pos.clone().addScaledVector(speedDir, 3), k * 1.4);
      this.camera.lookAt(this.lookTarget);
    } else if (this.mode === 'crash') {
      const dummyPos = this.getDummyFocus();
      const focus = dummyPos ?? this.getVehicleFocus()?.pos ?? null;
      if (!focus) return;
      // Follow the flying dummy from a raised three-quarter angle.
      const desired = focus.clone().add(new THREE.Vector3(7, 6, -7));
      this.chasePos.lerp(desired, k * 0.9);
      this.camera.position.copy(this.chasePos);
      this.lookTarget.lerp(focus, k * 2.2);
      this.camera.lookAt(this.lookTarget);
    }
  }
}
