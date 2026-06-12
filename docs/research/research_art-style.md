# Turbo Dismount 1 & 2 (Secret Exit) — Art Style and Audio-Visual Reference

Research based on: Steam store API data for both games (app 263760 and 2280350), direct pixel-sampling of 12 official 1080p Steam screenshots (downloaded to /tmp/td1_*.jpg and /tmp/td2_*.jpg and analyzed with PIL, including k-means dominant-palette extraction), Wikipedia, Kill Screen developer interview, Metacritic credits, the khinsider OST track list, Steam community threads, and Jani Kahrama's ARTTech 2022 talk metadata plus the SX Tools GitHub readmes (Secret Exit's own published art pipeline).

---

## 0. The single most important technical fact

Secret Exit's pipeline (confirmed by CEO/3D artist Jani Kahrama's ARTTech 2022 talk "The art pipe of [REDACTED] dismount" and their open-source tools) is **Blender-to-Unity, vertex-colored low-poly meshes, NO textures**. Their in-house tool "SX Tools" (github.com/FrandSX/sxtools-blender, sxtools2-blender, by Secret Exit) works like this:

- Model assets as **low-poly control cages for subdivision** (so: low-poly silhouettes but with beveled/rounded edges, not hard-faceted)
- Color them with **multi-layer vertex colors** (layers with blend modes like Photoshop: alpha, additive, multiply, overlay)
- **Bake ambient occlusion, curvature shading, gradients and noise directly into vertex colors** — this is why TD2 objects look soft and "lit" even before scene lighting
- Per-vertex metallic/smoothness/emission/transmission channels exported via UV channels driving a standard PBR material (Unity URP/HDRP shader graphs ship with the tool)
- A **Master Palette tool** recolors whole objects from a shared palette — which is why everything in a level feels color-coordinated

For a 3D web recreation (three.js etc.): use vertex colors on subdivided/beveled low-poly meshes, bake AO into vertex color, `MeshStandardMaterial` with `vertexColors: true`, no texture maps. That literally is the authentic pipeline.

---

## 1. Overall visual style

### Turbo Dismount 1 (2014, Unity)
- **Look**: smooth low-poly "toy world". Not flat-faceted; surfaces are smooth-shaded with rounded, beveled edges. Solid colors, clean untextured surfaces, blocky simplified shapes. Reviewers: "blocky and uncomplicated with clean textures and solid colors", "low-polygon, toy-like style... instantly readable silhouettes". The clean look deliberately "dampens the brutality".
- **Signature color mood**: a warm **sepia/orange grade over everything**, like a faded 70s photo. Steam description calls it "an indiscriminate sense of style".
- **Sampled palette (from official screenshots)**:
  - Sunset sky gradient: peach `#e8b488` down to `#e6a06b`; deeper variants `#d29872`, `#ce9972` (56% of one frame is this orange)
  - Background skyscrapers: flat orange silhouettes `#e97e2e`, `#ec8636`, lighter `#e9b57b` — buildings get *more orange and flatter* with distance (aerial perspective in orange, not blue)
  - Road asphalt: very dark warm brown-grey `#2c2723`–`#3a332d` near camera; sepia-lit city streets read `#9b895d`. Lane dashes off-white/cream `#c8b595`, center line dull yellow
  - Player vehicles: saturated **school-bus yellow `#ffb904`** and orange — the hero vehicle is always the most saturated thing on screen
  - AI traffic/props: deliberately desaturated beige/grey/lavender-grey (`#caab93`, `#aa979f`, `#76718a`) so the player and hero car pop
  - Trees: stylized **cube-canopy trees** (a rounded cube of green `#8a7d33` warm-olive in sunset light, fresher green in city scenes) on simple cylinder trunks `#7d5034`
- **Lighting TD1**: one warm directional sun, low in the sky (long soft shadows toward camera in street scenes), very high warm ambient so shadows never go black, soft-edged shadows. Post: warm sepia color grade + **dark vignette with visibly rounded screen corners** (the whole screen is masked like an old TV/photo). Slight glossy specular on dummy and cars (toy plastic).

### Turbo Dismount 2 (Early Access Jan 23 2025, full release Mar 13 2026, Unity)
- Steam: "A full visual upgrade from object detail to lighting to special effects"; "an incomprehensibly slick sense of style oozing with confidence".
- Same vertex-colored toy language but **modern PBR rendering**: real soft shadows, baked per-vertex AO, bloom, depth of field in gameplay/cinematic cameras (foreground bokeh visible in screenshots), aerial fog, motion-blurred background traffic.
- **Each level has a strong monochromatic-ish color theme** (reviewers: "color palettes lean bright and separated, which aids readability"; "lighting favors clarity over mood"):
  - Daytime highway: near-white cyan sky `#d1f8ff`–`#b1d1de`, distant hills dissolve into fog `#e0fcfe`, cool grey roads `#778296`/`#5e6c6c` with crisp white dashes, green terrain tinted by sky
  - "Vertigo" skyscraper-drop level: the entire city is **lavender/periwinkle `#beb5e2`/`#b6abd7`** (58%+ of frame), buildings flat-shaded with white window dots, warm cream accents `#e6ced4`
  - Desert/stunt arena at golden hour: pink-sand ground `#f5cdb0`/`#f7d2cb`, long shadows, giant props
  - Night stadium: near-black sky `#08090d`, deep red crowd seating `#400201`, warm sodium street lamps, lit building windows, fire orange + ember sparks
  - Night neon race track: teal fog `#2f4143`, black asphalt `#0e1414`, **pure emissive yellow `#fefd01` neon pillars and X-markers** with heavy bloom
- City buildings in TD2: pastel pink/lavender/cream boxes `#d9c3bf`, `#f2dde8` with simple rectangular windows; faceted low-poly palm trees; overpasses, tunnels, billboards.

---

## 2. Mr. Dismount (the character)

- Designer quote (Jani Kahrama, Kill Screen): **"Mr. Dismount is not a crash-test dummy, he's an abstraction of a human figure"** — inspired by **the posable wooden art-class mannequins**. The simplification means "the viewer's attention is not on the surface details, but instead on the movement itself."
- **TD1 look**: light warm-grey/off-white (`~#d8d3c8` plastic), matte with slight sheen. Body built from **segmented capsule/lozenge limbs with visible ball-and-socket joints** — two-piece forearms/shins, segmented banded torso (3-4 stacked segments like an articulated artist mannequin), simple mitten hands, rounded shoe-feet. Head: smooth rounded helmet-like form, **no facial features at all** by default (no eyes, no mouth). Proportions: roughly human but chunky/simplified, slightly large head and hands.
- **The face gimmick**: you can map a **photo of a friend's face** onto Mr. Dismount's blank head (Steam: "such a delightful way to express one's emotions!"). This is core to the brand's humor.
- TD1 also has alternate characters (e.g., a pink-skinned variant riding a red tricycle, with color-tipped limbs).
- **TD2 look**: same mannequin language but darker (grey-brown plastic `#585951`-ish range, also tan/brown variants), more detailed joints, multiple dummies at once ("Mr. Dismount and his friends"). New: **animated bobblehead photo faces** — oversized real-photo human heads with grimacing/laughing expressions wobbling on dummy bodies — plus **live webcam faces**. Accessories: retro white racing helmet with blue center stripe, blue full-face helmet, rainbow propeller beanie, backpacks. Wikipedia: player can choose Mr. or Ms. Dismount.
- Crucially: **no blood, no gore, no dismember-gore textures** — limbs bend and detach cleanly; comedy comes from ragdoll motion and sound.

## 3. Environment design / level dressing

- **TD1**: a stage-set city. Long straight road to a crash scene; flat-orange skyline backdrop; cube trees in rows; concrete overpasses; AI traffic (desaturated beige buses, vans, sedans with simple disc wheels); ramps with orange/yellow chevron arrows; turbo pads; brick walls; **billboards advertising Secret Exit's own games** ("Eyelord" and "Stair Dismount" billboards visible in official screenshots). Obstacles are player-placeable (level-editing was a core feature). Everything reads as toy diorama, no clutter.
- **TD2**: much denser dressing, still diorama-clean: highway interchanges with tunnels and overpass bridges, pastel downtowns with palm trees, crosswalks, street lamps, scaffolding; **joke fictional branding** on signs and billboards — "Dino Juice" (gas/juice sign), "Annual Cat Fair" posters with rosette ribbon, "Safety Beats" billboard, "Vertigo" hotel script sign in red on cream. Stunt arenas have circus/carnival props: striped barrel, **giant orange boxing gloves** on springs, jelly cubes, ramps, loops. **Spectator crowds**: grandstands packed with bobblehead-photo-face spectators in red/green shirts who watch your crashes (night stadium level). Race tracks dressed with truss gantries and emissive-yellow neon pillars/X markers. Police-chase mode adds white/black cop pickups with blue light bars.

## 4. Visual effects

- **TD1**: grey billowy dust/smoke puffs at impacts and from wrecked engines; short **orange spark streaks** when metal scrapes road; tire smoke; debris is mostly the vehicles themselves breaking into parts (doors, hoods fly off; vehicles crumple via pre-broken pieces). **Damage popups**: small square icons stack in a column on the right screen edge showing each injury (body-part icon with red X / skeleton-style icons) as points bank; score counter ticks up top-right. **Replay**: "Instant Replay" banner top-center, replay-speed slider bottom-left going down to 0x — slow-mo is just time scaling, no extra grade or speed lines. No motion blur. Camera is mostly steady (the game sells impact with physics + audio, not camera shake).
- **TD2**: glowing **ember/spark particle bursts** with trails on metal impact; **nuts, bolts and screws** visibly pop off vehicles; fire with rolling dark smoke plumes; dust kick-up from offroad wheels; heavy **bloom** on emissives; **depth of field** (near bokeh) in gameplay and cinematic shots; aerial fog tinting. NeonLightsMedia review: "heavier, more chaotic, and more cinematic than the mobile-era original"; slow-mo first-person replays are a highlight. **Replay/movie mode**: screen gets a **curved black filmstrip border** (top and bottom arcs like a cinema frame), "Replay" in script lettering top-center, scrubber timeline across the bottom with a white playhead dot, **playback speed selector using turtle→rabbit icons**, photo/GIF/video capture buttons stacked on the left, REC timer bottom-left. Score popups: plain big white numerals top-right with thin-space thousands grouping ("43 125").

## 5. UI style

- **TD1 — "1950s Americana roadside diner/racing badge"**:
  - Font: chunky, friendly **rounded slab/Cooper-Black-ish display font**, cream/off-white fill `#e1cda0` with dark chocolate-brown outline and drop shadow, used for everything (Score, labels, button text). "Instant Replay" title in deep brick red.
  - Buttons: **circular enamel-badge buttons** — concentric red/orange target rings (`#c85724`-family) with a cream **flame/swoosh banner** trailing off the right side; the big DISMOUNT!/RESET button bottom-right is the hero element. Bottom edge: row of round badge icons with cream outlines, labeled Characters / Vehicles / Obstacles / Poses / Steering. Top-left: round badge back button.
  - Panels: dark warm-brown rounded-rectangle pills (replay speed slider = brown pill + cream oval knob).
  - Layout: Score/High Score top-right (right-aligned, two lines); telemetry block left edge (Character: Altitude/Airtime; Vehicle: Altitude/Speed) in small cream text; hint text above the main button ("Hold to rev engine, release to dismount!").
  - Whole screen has rounded-corner vignette mask.
- **TD2 — flat, modern, semi-transparent dark**:
  - Font: clean bold **geometric/rounded sans-serif in white** (Nunito/Filson vibe) for HUD ("Lap:", "Steering", scores); one **retro 50s-diner script face** reserved for flavor headers ("Replay", the "Vertigo" sign).
  - Buttons: **dark slate-blue translucent rounded pills and circles** (`~#16222e` at ~80% alpha) with white glyph icons; bottom-right cluster = horn icon, RESET (with a swoosh tail nodding to the TD1 badge), camera, target/respawn; tiny keycap badges (A/D, S/W, CTRL, TAB, R, T) attached to controls showing bindings.
  - Layout: minimalist — hamburger circle top-left, score top-right, keybind legend bottom-left, action cluster bottom-right; lap/time block top-left in races. Everything floats directly on the 3D view, no panels.

## 6. Audio

- **TD1 music**: an original **funk soundtrack** by Finnish musician **Ville "Crud" Eriksson** (Metacritic credits; fans call it "ABSOLUTELY GROOVY"). Official OST track list (each ~3 min): "Disaster Funk", "Cruisin' for a Bruisin'", "Dirty Windshield", "Ragdolls of Sunset Drive", "Traffic Juices", "Bumper Humper", plus bonus "Truck Dismount 2003" (remastered theme from the 2003 original). Vibe: upbeat wah-guitar/clavinet/horns 70s funk — cheerful, never dramatic, ironically groovy against the carnage.
- **TD1 sound design** (additional SFX by **Joonas Turner** — the Nuclear Throne/Downwell sound designer): Kahrama's stated philosophy is that **"gruesome sounds during impacts, without the use of gory imagery"** produce "a stronger emotional response than full-on graphic violence". So: exaggerated wet **bone crunches, cracks and thuds layered over metal crashes and glass** while visuals stay clean. Engine revs up in pitch while you hold the launch button; release = launch. Crashes are the percussion; the dummy itself is mostly silent (comedy of deadpan).
- **TD2 audio**: reviews describe "**crisp impact Foley**", "immediate, weighty impact cues and mechanical rattles that make each collision feel tactile", with the criticism that music is repetitive loops and ambience is thin ("prioritizes immediacy over nuance"). Adds: car horn button, crowd presence in stadium levels, fire/spark sizzle, race-mode bleeps. Same crunch-over-cleanliness philosophy.
- The brand's "iconic sound" in players' memory = the funk groove + the comedic crunch/thump cascade of a ragdoll tumbling through traffic, and the rising engine-rev before launch.

---

## Quick recreation cheat sheet (web 3D)

- Geometry: low-poly + bevel/subdiv, vertex colors, zero textures; cube trees (TD1) or faceted palms (TD2); toy-proportion vehicles with big rounded fenders.
- TD1 grade: warm sun ~30° above horizon, sepia post (lift reds, crush blues), vignette + 24px rounded screen-corner mask, orange fog for distance.
- TD2 grade: per-level monochrome themes (lavender `#beb5e2`, sand-pink `#f5cdb0`, teal-night + emissive yellow `#fefd01`), bloom, DOF, fog-to-sky-color.
- Dummy: capsule-segment mannequin, blank head, photo-decal face option; grey-cream (TD1) or grey-brown with helmets/bobbleheads (TD2).
- Score/feel: damage = points; right-edge injury icon stack (TD1) or bare white numerals (TD2); slow-mo replay scrubber; turtle/rabbit speed icons (TD2).
- Audio: 70s funk loop, pitch-rising rev, layered crunch+metal+glass impact stacks, no screams needed.