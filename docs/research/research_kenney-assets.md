# Kenney.nl Free Assets for a Turbo Dismount-Style 3D Web Game

All findings verified by fetching kenney.nl pages and by downloading and inspecting actual ZIPs (Car Kit, Racing Kit, Blocky Characters, Impact Sounds, Interface Sounds, UI Pack).

## Download URL pattern (verified)

Asset pages embed a direct download link of the form:
`https://kenney.nl/media/pages/assets/<slug>/<hash>-<timestamp>/kenney_<slug>[_version].zip`

Verified by downloading several ZIPs successfully (e.g. Car Kit, Racing Kit, Blocky Characters below). Note: the `<hash>-<timestamp>` segment changes when a pack is updated, so these exact URLs are valid now but can rotate on new releases; the stable entry point is always the `/assets/<slug>` page's Download button.

## 1. Vehicles: Car Kit (TOP PICK)

- Page: https://kenney.nl/assets/car-kit
- Direct download (verified working): https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip
- 45 files listed on page; ZIP contains 50 models per format. Formats (verified inside ZIP): **GLB, FBX, OBJ+MTL**, all sharing one `colormap.png` texture. GLB is ideal for three.js/web.
- Version 3.1 (Feb 2026). Changelog: 3.0 "Added kart racers", 2.0 "Completely remade, added debris".
- Models inside (verified file list): ambulance, delivery, delivery-flat, firetruck, garbage-truck, hatchback-sports, police, race, race-future, sedan, sedan-sports, suv, suv-luxury, taxi, tractor, tractor-police, tractor-shovel, truck, truck-flat, van, 5 kart racers (kart-oobi/oodi/ooli/oopi/oozi), cone, cone-flat, box, and **15 debris parts** (debris-bumper, debris-door, debris-door-window, debris-tire, debris-spoiler-a/b, debris-plate-a/b + small variants, debris-drivetrain, debris-drivetrain-axle, debris-bolt, debris-nut). The debris parts are tailor-made for crash/dismount gameplay.

Alternative: **Toy Car Kit** — https://kenney.nl/assets/toy-car-kit, 100 models (toy cars plus track pieces), CC0, download: https://kenney.nl/media/pages/assets/toy-car-kit/42e19cc426-1736346027/kenney_toy-car-kit.zip

## 2. Roads, ramps, racing props: Racing Kit (TOP PICK)

- Page: https://kenney.nl/assets/racing-kit
- Direct download (verified working): https://kenney.nl/media/pages/assets/racing-kit/933b8fd9fd-1677580949/kenney_racing-kit.zip
- 112 models per format. Formats (verified inside ZIP): **GLB (in "GLTF format" folder), FBX, OBJ+MTL, DAE, STL** plus 587 PNG previews.
- Models inside (verified file list): full modular road system (roadStraight, roadCurved, roadCornerSmall/Large/Larger with border/wall/sand variants, roadSplit, roadCrossing, roadStart, roadStartPositions, road bridges), **ramps** (ramp, roadRamp, roadRampLong, roadRampLongCurved, roadRampWall variants, roadBump, roadStraightLongBump), **barriers** (barrierRed, barrierWhite, barrierWall, fenceStraight, fenceCurved, rail, railDouble, pylon), grandstands (4 variants), pits garages/offices, flags (checkers, red, green), billboards, banner towers, overhead gantries, light posts, tents, radar equipment, trees, grass, and 4 race cars (raceCarRed/Green/Orange/White).

Also relevant for crazy ramp levels:
- **Coaster Kit** — https://kenney.nl/assets/coaster-kit, 180 models (steel/wooden/mouse/hanging coaster track, monorail, flume ride), CC0. Download: https://kenney.nl/media/pages/assets/coaster-kit/546fdc554f-1731487890/kenney_coaster-kit.zip
- **Mini Skate** — https://kenney.nl/assets/mini-skate, skate park ramps/halfpipes plus a rigged character, CC0. Download: https://kenney.nl/media/pages/assets/mini-skate/00b0c2b304-1709221152/kenney_mini-skate.zip
- **Minigolf Kit** — https://kenney.nl/assets/minigolf-kit, 125 models of course pieces/obstacles, CC0. Download: https://kenney.nl/media/pages/assets/minigolf-kit/3ae60d8b01-1741163874/kenney_minigolf-kit.zip

## 3. City streets and buildings: City Kit series

- **City Kit (Roads)** — https://kenney.nl/assets/city-kit-roads, 70 models, v2.0. Download: https://kenney.nl/media/pages/assets/city-kit-roads/74288c9459-1741864740/kenney_city-kit-roads.zip
- **City Kit (Commercial)** — https://kenney.nl/assets/city-kit-commercial, 50 models (skyscrapers, shops), v2.1. Download: https://kenney.nl/media/pages/assets/city-kit-commercial/a742d900eb-1753115042/kenney_city-kit-commercial_2.1.zip
- **City Kit (Suburban)** — https://kenney.nl/assets/city-kit-suburban, 40 models (houses), v2.0. Download: https://kenney.nl/media/pages/assets/city-kit-suburban/2c871b7af2-1745479373/kenney_city-kit-suburban_20.zip
- **City Kit (Industrial)** — https://kenney.nl/assets/city-kit-industrial, 25 models (factories, warehouses). Download: https://kenney.nl/media/pages/assets/city-kit-industrial/5fcb837741-1750838303/kenney_city-kit-industrial_1.0.zip
- All same series and styled to match the Car Kit. Same format convention (GLB/FBX/OBJ; not opened individually, but the series follows the Car Kit packaging).

## 4. Construction props

There is NO dedicated 3D construction pack on kenney.nl (search `category:3D?search=construction` returns zero results). Cover it with:
- Car Kit: cone, cone-flat, box (verified).
- Racing Kit: barrierRed/White/Wall, pylon, fences, rails (verified).
- City Kit (Industrial): factory/warehouse structures.
- Optionally **Prototype Kit** (https://kenney.nl/assets/prototype-kit) for generic blocks/crates obstacles.

## 5. Characters: Blocky Characters (TOP PICK for a crash dummy)

- Page: https://kenney.nl/assets/blocky-characters
- Direct download (verified working): https://kenney.nl/media/pages/assets/blocky-characters/8369c0cf30-1749547469/kenney_blocky-characters_20.zip
- 18 characters (character-a through character-r), each in **GLB, FBX, OBJ** plus per-character PNG textures.
- Verified by parsing character-a.glb: node hierarchy is `root > leg-left, leg-right, torso > arm-left, arm-right, head` — separate body-part meshes, ideal for ragdoll/dismemberment physics.
- 27 baked animations (verified in GLB): static, idle, walk, sprint, **sit, drive, die**, pick-up, emote-yes/no, holding variants, attack/kick variants, interact, wheelchair set. "drive", "sit" and "die" are exactly what a Turbo Dismount clone needs.

Alternatives: **Mini Characters** (https://kenney.nl/assets/mini-characters, 25 animated models, download: https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip) and the **Animated Characters** series (animated-characters-protagonists / -retro / -survivors).

## 6. Audio

- **Impact Sounds** — https://kenney.nl/assets/impact-sounds. 130 files, **OGG** (verified inside ZIP). Categories (verified): impactMetal/impactGlass/impactWood/impactPlank/impactPlate/impactPunch/impactSoft/impactTin/impactBell/impactGeneric in light/medium/heavy variants, plus footsteps (carpet/concrete/grass/snow/wood). Perfect crash SFX. Download (verified): https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip
- **Interface Sounds** — https://kenney.nl/assets/interface-sounds. 100 files, **OGG** (verified). Categories (verified): click, select, confirmation, error, toggle, switch, tick, scroll, open, close, minimize, maximize, drop, pluck, bong, glass, glitch, question, back, scratch. Download (verified): https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip

## 7. UI: UI Pack

- Page: https://kenney.nl/assets/ui-pack
- Direct download (verified working): https://kenney.nl/media/pages/assets/ui-pack/f651646eab-1718203990/kenney_ui-pack.zip
- 430+ assets, v2.0 ("Completely remade"). Verified inside ZIP: **870 PNG + 434 SVG**, organized in 5 color themes (Blue, Green, Grey, Red, Yellow) plus Extra, **2 TTF fonts**, and 6 sample OGG sounds. Buttons, panels, sliders, checkboxes — playful rounded style well suited to a Turbo Dismount-like game.

## 8. Licensing

Every pack above is **Creative Commons CC0 (public domain)**. Verified both on each asset page and in the License.txt inside the downloaded ZIPs, which states: "You can use this content for personal, educational, and commercial purposes. Support by crediting 'Kenney' or 'www.kenney.nl' (this is not a requirement)." No attribution required, commercial use allowed.

## Practical notes for the web build

- Use the GLB files directly with three.js GLTFLoader; every 3D pack inspected ships GLB.
- Kenney models share a single small color-palette texture per pack (e.g. `colormap.png`), so draw-call batching/material sharing is easy.
- Audio is OGG; Safari may need fallback transcoding to M4A/MP3 for older versions, though modern Safari (17.5+) plays OGG/Vorbis in most cases.
- Recommended minimal asset set: Car Kit + Racing Kit + City Kit (Roads) + Blocky Characters + Impact Sounds + Interface Sounds + UI Pack. All CC0, roughly 7 ZIPs.