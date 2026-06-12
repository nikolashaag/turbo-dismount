import { Engine } from './core/engine';
import { initRapier } from './core/physics';
import { preloadModels } from './core/assets';
import { AudioSystem } from './core/audio';
import { Game } from './game/game';
import { UI } from './ui/ui';
import { VEHICLES } from './game/vehicle';

declare global {
  interface Window {
    __td: ReturnType<Game['testApi']>;
  }
}

async function boot() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const engine = new Engine({ canvas });
  const ui = new UI();
  const audio = new AudioSystem();

  ui.setLoadingScreen();
  ui.setLoading(0.05);

  await initRapier();
  ui.setLoading(0.3);

  const vehicleModels = VEHICLES.filter((v) => !v.model.startsWith('proc:')).map(
    (v) => `/assets/models/vehicles/${v.model}`
  );
  const npcModels = [
    'sedan.glb', 'hatchback-sports.glb', 'van.glb', 'taxi.glb', 'suv-luxury.glb',
    'ambulance.glb', 'police.glb', 'sedan-sports.glb', 'cone.glb',
  ].map((m) => `/assets/models/vehicles/${m}`);
  const propModels = [
    '/assets/models/props/ramp.glb',
    '/assets/models/props/billboard.glb',
    '/assets/models/props/flagCheckers.glb',
  ];
  await Promise.all([
    preloadModels([...vehicleModels, ...npcModels, ...propModels]).then(() => ui.setLoading(0.7)),
    audio.preload().then(() => ui.setLoading(0.85)),
  ]);

  const game = new Game(engine, audio, ui);
  window.__td = game.testApi();

  ui.setLoading(1);
  engine.start();
  game.showTitle();
  // Give the backdrop level a beat to load before revealing.
  setTimeout(() => ui.setLoading(1, true), 400);

  // First user interaction unlocks audio.
  window.addEventListener(
    'pointerdown',
    () => {
      audio.resume();
    },
    { once: true }
  );
}

boot().catch((err) => {
  console.error('[boot] failed:', err?.message ?? err, err?.stack);
});
