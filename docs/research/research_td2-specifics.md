# Turbo Dismount 2 (Secret Exit) — Research Findings, June 2026

A note on sources up front: the official Steam store page, Secret Exit's Steam announcements (pulled via the Steam news API), Steam community guides/discussions, and IGCD are solid. The fan site turbodismount2.com looks like an AI/SEO content farm; several of its claims (e.g. "8 official levels", vehicles named "Golf R", "Token Bird", "Corley = sedan") directly contradict official patch notes and IGCD, so I have excluded its level/vehicle lists except where independently confirmed. Where something is only single-sourced or uncertain, I say so.

## 1. Release status (as of June 2026) and platforms

- **Full release (v1.0): March 13, 2026** on Steam, after **Early Access starting January 23, 2025**. Secret Exit describes it as "over eight years of development."
- Announced August 2024 (Steam wishlist tweet); playable **Next Fest demo October 2024**.
- **Platforms: Windows 64-bit only (Steam)**. **Steam Deck Verified** (achieved during EA, ~mid-2025). No native Mac/Linux; Mac and "AI racers" and "more game modes" were on the community roadmap as planned. **iOS/Android: not released**, officially "planned after the PC full release," no date.
- **Price: $19.99 / EUR 19.50**, with a launch-window 30% discount seen ($13.99) and a bundle with Turbo Dismount 1 (~EUR 23.40 at 20% off).
- Reception: ~95-96% positive (~672 reviews at time of checking), small but happy audience (one press piece reports launch peak concurrents of only ~190 and calls it "the quietest sequel of 2026").
- Post-1.0 support is active: Release Patch (Mar 19, 2026), Trading Cards Update (Mar 26, 2026), **Skid Marks Season (Apr 13, 2026)**, **"Skate or Bye!" update (June 5, 2026)** — the latter two are content seasons, so the game is in live seasonal-update mode right now.
- Engine: **Unity, upgraded to Unity 6 during EA (May 2025), then Unity 6.3 LTS (Dec 2025)**. 17 Steam achievements, trading cards, cloud saves, leaderboards, Family Sharing, Steam Timeline support, full controller support.

## 2. Everything new or different vs Turbo Dismount 1

**Graphics/tech**
- Same crash-test-dummy comedy aesthetic but "a full visual upgrade, from object detail to lighting to special effects" (Steam page). Reviews: "same art direction as the previous games, but with far better lighting, immensely increased object density"; physics feel "heavier, more chaotic, and more cinematic than the mobile-era original."
- Heavier system requirements than you'd expect (16 GB RAM minimum, GTX 1070 recommended) — this is no longer a mobile-class game.

**New mechanics**
- **Full manual vehicle controls** ("AAA-level driving physics", manual first-person driving). TD1 was set-it-and-watch; TD2 lets you actually drive, including a first-person steering view. Settings offer **Arcade or Hardcore** manual-handling modes (added Apr 2026). Air control (mid-air rotation), secondary sideways spin while handbraking, "Free Flight" after steering loss, handbrake, tire burning (achievement for burning 2000 tires).
- **Multiple characters per vehicle** ("multiple passengers on vehicles") — the headline sequel feature. Score logic was rebalanced around multi-character crashes; dashcam views exist per passenger; high-capacity vehicles (double-decker bus Royal Highness, Smooth Cruiser) are the high-score meta.
- **Multiple named characters**: Mr. Dismount (default), Mrs. Dismount (same pose set), plus "friends" — names appearing in patch notes include **Mr. Ego** and **Penelope** (a level is called "Penelope's Challenge"). TD1 had only Mr. Dismount.
- **Character customization**: poses per vehicle (as TD1), **hats** (e.g. a "Mallard" duck cap added June 2026), **animated bobblehead custom faces with custom photo support**, and **live webcam video faces** (there is an official "Live Face Streamer Guide" by Secret Exit). TD1 only had static custom face photos.
- **Vehicle customization**: paintjobs and stickers; achievement "Dismount City Customs — fully customize a vehicle."
- Upgraded destruction: vehicles fragment via a "complex damage system," internal vehicle damage modeling, detachable heads/decapitations (two achievements), wheels catching fire, NPC AI traffic with tunable aggressive behaviors.
- New placeable obstacles beyond TD1's set: **Jelly Cube** (squishy momentum stopper, color shifts with strength), **TNT Pile**, **Bouncy Cushion** (replaced the classic Soft Cushion), **adjustable-width Ramp**, **Ring of Fire** (adjustable), **Low Blow** (width/height sliders), **Spinner** hazard, boxing gloves, Ball and Chain, springboards, catapults, NPC Train. Obstacles have adjustable position/size sliders during setup.

**Level editor / Workshop (the biggest structural change)**
- A **full level creation toolkit in Unity** — the *same internal tools Secret Exit uses* — published as a "Level Editor Package" with full **Steam Workshop** support. Official "Level Creation Guide" by Secret Exit on Steam.
- It is not just geometry: **logic nodes** (e.g. SelectedVehicle, VehicleID, SetDisplayScore, DiscardScore, SetMusic), road splines/spline animators, physics joints (Hinge, Spring, Configurable, Spline), collectible assets — so creators can build **new rules and game modes** (races, puzzles, derbies, police chases), not just maps. Marketing: "power-ups, obstacles, traps, rules, and entirely new game modes."
- Requires Unity 6.3 Editor for level creation (after the Dec 2025 engine migration).
- Achievements push Workshop use: "I Made This!" (load your own level), "Gourmet Buffet" (subscribe to 10+ Workshop levels).

**Mission/objective system**
- **Challenge Mode** (added in "The BIG Update", Dec 1, 2025): "levels can contain challenges to beat. Completed challenges may unlock rewards." Each level carries roughly **1-4 specific objectives** (a reviewer compares them to FlatOut-style dismount challenges). Objective types: score thresholds (e.g. 5000 pts "Duke of Donuts" on Parkade Drift), time trials (beat 1:05 on Catch My Drift), height goals (reach 450m/500m on Space Program), races/lap times, drift/donut challenges, collectibles (golden hot dogs on Skate or Bye under a time limit), police chases, physics puzzles.
- **Tutorial levels** exist in Challenge Mode (achievement "Training Wheels — complete all Tutorial levels"), including a "Manual Triggers" tutorial.

**Progression**
- **No currency found anywhere** — progression is goal-based, not economy-based. Completing level challenges/goals **unlocks further levels, vehicles ("cars") and hats** (confirmed by a dev-answered Steam thread). Patch notes confirm level-to-level unlock chains (e.g. a Hoops of Doom goal unlocks "Fifty Sixty"; Slam Dunk unlocks "Penelope's Challenge"; Donut Drop has an unlock goal).
- **Sandbox Mode**: everything unlocked from the start, dev-confirmed ("just start the game and pick Sandbox instead of Challenge mode"). This is the TD1-style experience.
- **Per-level leaderboards**, time-based leaderboards on race levels, and **vehicle-tagged leaderboards** added at 1.0. Leaderboards were fully reset once during EA when scoring was revamped (the old scoring had clipping exploits — "get an object to clip inside your vehicle" gave huge points).
- **No daily challenges**. The closest analogue is the **Featured Level system** (added June 5, 2026): the title screen spotlights a level for a **time-limited period**, playable even if you haven't unlocked it in Challenge Mode, optionally restricted to specific vehicles "for fair competition" on its leaderboard. It is a rotating competition, cadence appears to be per-update/per-season rather than daily.

**Replay / movie**
- Enhanced replay system: slow-motion slider, **time rewind**, playback speed control, free camera, camera target cycling (TAB / shoulder buttons), per-passenger dashcams, controller trigger control of replay speed. Easter egg: dropping below 1/16 speed switches the soundtrack to classical music.
- **Movie Creation Mode** with multi-camera shot staging and **video export** (achievement "Kubrick, Spielberg, Me! — Export a Movie Mode video").
- **Steam Game Recording / Timeline integration** (auto-markers for state changes and replays) and screenshots saved to the Steam Photos library.

## 3. Levels/maps (official, built-in)

Secret Exit has never published a single numbered list; this is compiled exhaustively from official patch notes, achievements, and guides (~40 named levels). Exact EA-launch lineup was never itemized, so "base" below means "present before the first content update that names it."

**Base / launch-era levels** (named in patch notes only via fixes/goals, descriptions where sourced):
- **Tutorial levels** (several, incl. a Manual Triggers tutorial)
- **Hit the Fan (Classic)** — remake of the TD1 classic giant-fan level (added Update #6 as "Classic"; later patch notes call it "Classic level")
- **Big Air Compo** — big-jump stunt competition
- **Stair Chase** — chase level (likely the police-chase showcase; stairs + pursuit)
- **Wobbles** — bumpy/unstable road level (icon updated at 1.0)
- **Parkade Drift** — parking-garage drift/donut level (achievement: 5000 pts "Duke of Donuts")
- **Catch My Drift** — drift time-trial (achievement: beat 1:05)
- **Space Program** — long ramp launching you toward "space"; Challenge goal: reach 450m height (achievement at 500m)
- **Out of Office** — office-themed
- **Gridiron** — American-football-stadium themed
- **High Steaks** — has a neon sign (diner/steakhouse theme)
- **Curly Dunes** — dunes/sand
- **Hoops of Doom** — hoop-jumping; its goal unlocks Fifty Sixty
- **Fifty Sixty** — unlocked from Hoops of Doom
- **Par One** — golf-themed
- **Barrel Jump** — barrel-jumping stunt (difficulty reduced June 2026)
- **Penelope's Challenge** — unlocked from Slam Dunk
- **Constructive Feedback** — construction-site level (has a dedicated leaderboard-strategy Steam guide)

**Added during Early Access 2025** (update number, date):
- **Slam Dunk** (#2, Jan 31) — basketball-dunk physics gag
- **Pendulum Passage** (#4, Feb 14) — swinging-pendulum gauntlet
- **Axe to Grind** (#5, Feb 20) — swinging axes
- **Thread the Needle** (#5, Feb 20) — precision gap-threading
- **Tropic Cruise** (#6, Feb 28) — tropical/beach cruise
- **Air Traffic Control** (#7, Mar 7) — airport/aircraft theme
- **Chef's Kiss** (#7, Mar 7) — kitchen/food theme
- **Criss-Cross** (#8, Mar 28) — crossing-traffic intersection
- **I Don't Like Sand** (#9 "Speed & Races", Apr 17) — desert race (Star Wars joke name)
- **Murder Moon** (#10 "Engine Upgrade & Space Heroics", May 28) — space/Death-Star-style gag (paired with the X-wing-like vehicle)
- **Catapulting to Success** (#10, May 28) — catapult launch level
- **Owtobahn** (#11 "Damage Season", Jun 13) — autobahn highway with traffic
- **Dismountpolis 500** (#13 "Racing Season", Jul 28) — oval/Indy-500-style race with lap-time leaderboards
- **Pizza Delivery** (#13, Jul 28) — delivery driving challenge
- **Dismount Derby** — demolition-derby arena; first released on Workshop (#14 "Workshop Season", Aug 21), promoted to built-in content in The BIG Update

**The BIG Update (Dec 1, 2025):**
- **Turbo Slalom** — slalom gates
- **Safe Travels** — road-safety irony level
- **Donut Drop** — donut/drop gag (unlockable)
- **T-Junction** — remastered TD1-style T-intersection level

**Update #16 "Winter Stunts Season" (Dec 18, 2025):**
- **Bon Voyage** — "the big brother of the Big Air Compo" (giant ramp/big air)
- **Cold Cut** — "a very tight squeeze" (narrow ice/winter gap)
- **Vertigo** — tests "air control and landing skills to the limit"

**Post-1.0 seasons:**
- **Skid Marks** (Skid Marks Season, Apr 13, 2026) — drag racing
- **Skate or Bye** (Jun 5, 2026) — skateboard level, collect golden hot dogs against a time limit

1.0 itself also added unspecified "new levels". Workshop adds unlimited community levels (popular ones per fan site, unverified: Highway Patrol, Crossy Road, Hyperspeed Highway, Atrocious Alley, Road Trip).

## 4. Vehicles (compiled from IGCD.net, official patch notes, guides)

Named roster (~26 named + several unnamed/NPC):
- **Corley** — motorcycle (Harley-Davidson Fat Boy-alike); first two-wheeler, added in The BIG Update with "quite complex and realistic physics"
- **Shuriken** — sport bike (BMW S 1000 RR-alike), added around 1.0; wheels can catch fire
- **Lean Means** — added around 1.0 (likely a leaning trike/bike; wheels catch fire per patch notes)
- **Pink Lightning** — returning TD1 sports car (has a honk)
- **The Wedge** — wedge sports car (Ferrari 308 GTS-alike per IGCD)
- **Squealer** — formula/open-wheel race car
- **Banditt** — muscle car (1966 Ford Mustang-alike)
- **Ricky-Tick** — T-bucket hot rod (1920 Ford)
- **Cricket** — tiny city car (Vignale Gamine-alike)
- **Bessenwisser** — bubble car (Messerschmitt KR 200-alike)
- **Smooth Cruiser** — big convertible, fits lots of passengers (added Update #2)
- **Boogie Bus** — VW Transporter-style van
- **Milk Van** — Divco-style milk float
- **Royal Highness** — double-decker bus (AEC Routemaster-alike), maximum passenger capacity, high-score favorite
- **Maximus** — big rig (Peterbilt 320-alike)
- **Sasquatch** — monster truck
- **Komrade** — tractor (Zetor 25-alike, added Update #11)
- **Wastelander** — dune buggy
- **Tumbler** — quad/ATV (Bombardier DS-alike)
- **LeDorean** — three-wheeler (DeLorean pun)
- **Forkules** — forklift (Hercules pun)
- **The Swinger** — mobile crane (with swinging wrecking load)
- **Mall Racer** — mobility scooter/shopping cart-type (added Update #8; spiritual successor to TD1's "The Corgi")
- **Street Slicer** — skateboard (secondary air rotation = Spin)
- **Quad-Fin Fighter** — Star Wars X-wing-alike (added Update #10 with the Murder Moon level)
- **Cricket / NPC traffic fleet** — IGCD also documents unnamed AI-traffic vehicles: a highway coach, Hummer H3-alike, bulldozer, helicopter, generic sedan, four supermini variants, and a Trabant 601-alike
- Teased by devs during EA (status as of June 2026 unconfirmed): **Rollerskis**, **Protein Torpedo**

## 5. UI/UX flow

- **Title screen**: choose **Challenge Mode** or **Sandbox Mode**; the title screen also surfaces the current **Featured Level** (time-limited, leaderboard-driven, may restrict vehicle choice, accessible even if locked).
- **Level select**: levels presented as **cards**; since the 1.0 Release Patch each card shows its challenges as **dots/"spots"** (completed vs not), plus tutorial-progression indication. In Challenge Mode locked levels show unlock goals; in Sandbox everything is open.
- **Round setup (the classic Dismount loop, expanded)**: pick vehicle → load it with one or more characters (pick characters, per-vehicle **poses**, hats, custom/live faces) → customize vehicle (paint, stickers) → place and tune obstacles/props on the level (position, width/height sliders, ramp angles, launch-pad speeds) → launch.
- **During the run**: either watch the automated run or take **manual control** (third-person or first-person; Arcade/Hardcore handling; air control, handbrake spins). On-screen control help system; **HUD shows active challenge tasks** (Challenge Mode) and a **score bar in the top-right corner showing progress toward the level's specific goals**; mono-spaced HUD numbers; camera cycling on TAB/shoulder buttons including per-passenger dashcams and camera-target cycling.
- **Scoring**: points from impact damage to dummies and vehicle, per-body-part damage events, multi-passenger multipliers, mid-air flips, tire burning, plus level-specific scoring (lap times, heights, collectibles). Scoring was globally rebalanced in The BIG Update (with a leaderboard wipe).
- **Score/results screen**: end-of-run results feed **per-level leaderboards** (score-based; time-based on race levels; **vehicle-tagged** at 1.0; screens "display more entries" after 1.0 polish). Challenge Mode shows which of the level's objectives you completed and what they unlocked.
- **Replay**: after the run, enter replay mode — scrub, slow-mo slider, rewind, free/cycling cameras, then optionally **Movie Mode** to stage multi-angle shots and export video; Steam Timeline gets automatic markers if background recording is on.
- **Progression loop**: complete challenges → unlock levels/vehicles/hats → chase leaderboards → rotate through the Featured Level competition → dip into Workshop for community levels (subscribing is one click; levels are free).

## 6. Art style vs TD1

- **Continuity, not reinvention**: identical comedic crash-test-dummy art direction, cartoon styling, deadpan tone. Reviewers consistently describe it as the same look "but with far better lighting, immensely increased object density," and a presentation "beautifully overhauled" from the original's 2009-smartphone-era fidelity.
- Concretely upgraded: object detail, lighting (day and night levels; night-level performance got dedicated optimization), particle/special effects on crashes, vehicle deformation/fragmentation detail, denser environments with AI traffic, skybox quality (a vertical seam fix is in patch notes), and audio ("extra bass to all the hit sounds," new soundtrack, the classical-music slow-mo gag).
- Net effect per press: "heavier, more chaotic, and more cinematic" — a PC-class production of the same joke, rather than a new art style.

## Caveats / open gaps
- Secret Exit has never published official totals ("X levels, Y vehicles"); the lists above are compiled from primary patch notes and may miss a handful of unannounced base levels from the EA launch build.
- turbodismount2.com (fan SEO site) data conflicts with official sources and was excluded; its "8 levels / vehicle stats" tables appear fabricated.
- "Murder Moon" appears as a level in patch notes but was once listed as a teased "vehicle" in a community roadmap snippet; the level interpretation is better supported.
- No evidence of: any in-game currency, daily challenges (Featured Level rotation is the substitute), multiplayer (a "Versus Mode" guide is a fan suggestion only), or console versions.