Original prompt: Improve the Skyline Swing game as a goofy, off-color Spider-Man / Goat Simulator sandbox: better graphics and buildings, a more alive and explorable city with many more NPCs and things to do, crazier interactions, and very fluid movement. First propose a plan for approval.

User approved the plan and added: find and fix broken or unsatisfying world features, including a bridge connecting to nothing; improve combat; keep funny words on screen to a minimum, if any.

## Status
- Developed in a temporary working copy and prepared for delivery to `/Users/jordanwhite/Projects/spida`.
- Connected the waterfront bridge to a new island, added a Manhattan ramp and clear roadway for Brooklyn Bridge, and made Liberty Island accessible with collision and minimap support.
- Added facade colors, storefronts, pedestrians with roles and accessories, market scenes, park gatherings, rooftop parties and a scaffold.
- Restored the previously uncalled residential-neighborhood generator in a reserved northern part of the map; its 100 existing GLB house variants load, and building collisions were checked.
- Improved swing targeting, movement control, jump buffering, chained and buffered attacks, juggling, and spatial lookup for player collision.
- Added throwable/webbable carts, bins, cones and benches; actor-to-actor web tethers; cart, rescue, performance and pileup incidents; and a directional dodge with timed protection.
- Suppressed floating joke/score captions and feeds while retaining concise information and combat hints. Delayed the initial boss encounter to give players room to get oriented.
- Added Performance, Balanced and High settings and reduced distant geometry and character-shadow work. Distant low-detail NPCs remain targetable.
- Added deterministic `?test` stepping and expanded `?debug` hooks. The supplied game client and focused Playwright scenarios verified both directions of the Brooklyn Bridge, the harbor and Liberty islands, the Statue of Liberty pizza, a successful and a failed rescue, swings and web zips, double jumping, gliding, ground pounding, a boss hit, dodge immunity and cooldown, chained slaps, web bombs, towing an NPC behind a car, starting/stopping an incident, saved graphics settings, touch controls, and a full nuke sequence/reset. Embedded pointer-lock rejection was fixed.

## Next
- No known blocking issues remain from the local playtests.
- A future playtest on the player's real GPU can inform further crowd and graphics tuning; the headless browser uses software rendering and is not representative of that hardware.

## Detail and activities follow-up
- Added procedural road texture, row-house entrance details, shop displays, roof panels and piping, market produce and striped canopies, and more rooftop party decoration.
- Added eight bounce pads across the park, islands and rooftops. Players, people, vehicles and thrown objects can bounce; a pad can safely catch a falling rescue target.
- Added eight pressure tanks that detonate when struck or web-bombed, launch nearby actors and props, chain together, and respawn after a delay.
- Added three replayable target galleries in the park, at the boardwalk and on a rooftop. Web bombs, slaps and thrown props activate their targets, with visible progress and a combo reward.
- Added landing rewards for longer aerial runs that link swings, zips, bounces and close passes. Routine jumps do not trigger the reward. No new joke captions were added.
- Browser playtests checked all three galleries and their shot, slap and thrown-object hits; player/NPC/rescue bounces; pressure-tank shots, slaps, chain reactions and reset; air scoring; the bridge, combat, rescues, movement, settings and touch controls; and the full nuke sequence and reset. Fixed a target post that initially blocked shots.

## Graphics and third-person follow-up
- Added a switchable third-person camera with near-wall obstruction handling; V, the pause menu and touch controls switch views. The existing first-person view remains available and the preference persists.
- Replaced the initial primitive character after user feedback with a CC0 rigged superhero, a fitted procedural suit and emblem, skin-aware animation clips and an arm that reaches for the web anchor.
- Added detailed building bands, balconies and roof rails, higher-resolution facades, street crossings, contact shadows, foliage shading, sky and glass reflections, and local CC0 grass and asphalt color/normal maps.
- Trimmed the animation library to the five clips used in the game and bundled the model, materials and their licenses locally.
- Playwright checks covered third- and first-person aim, shots and swinging; wall clearance; switching during a swing; zip, glide and third-person nuke targeting; walking, sprinting, jumping and punching animation; web grabs; suit changes; saved preferences; and the touch camera button.
- Also checked the existing successful/failed rescues, movement abilities, all target galleries, distant targeting and the full nuke/reset sequence. Reduced an opaque steam plume that was obscuring the street view. A headless software-renderer comparison found no obvious simulation slowdown; real GPU performance still needs a player test.


## Sound-effects follow-up
- Replaced oscillator-based movement, webbing, combat, crowd, vehicle and bird effects with a compact local bank of CC0 recordings, layered and varied per action. Added grass, stone and water footsteps, contextual metal/body impacts, positional falloff and stereo panning, and speed-aware wind and nearby vehicle ambience.
- Replaced synthetic NPC voices with varied human recordings and restrained crowd cooldowns; changed the nuke fall effect to recorded rushing air. All effects now pass through the effects bus so pause and mute also silence the falling sound.
- Kept the existing music separate and added source credits in ASSETS.md. The game still requires a local web server and browser gesture for full Web Audio playback.
- TODO: test the mix on the player's real speakers or headphones; headless browser checks verify signal and event routing, not subjective loudness or personal taste.
- Verified all 38 decoded foley segments and browser signal output, combat and web cues, positional panning and falloff, grass/pavement/water footsteps, wind and engine response, 24-channel crowd bursts, mute/pause and nuke fall. Direct-file playback, burst cleanup, and nuke mute were also checked. The final browser run reported no console errors or failed requests.
- One earlier headless run reported intermittent local model-texture connection resets; the later run loaded them successfully. If this recurs, investigate concurrent model/texture requests from the local server.

## Third-person animation jitter fix
- Reproduced rapid pose switching when movement speed hovered around the sprint cutoff: the old code switched jogging/sprinting 49 times in 50 frames and repeatedly reset both animations. Added separate entry/exit thresholds and blends that continue from the current weights and animation times when interrupted.
- Added a small camera hide/show buffer beside walls so the view does not flicker at the obstruction threshold. Stopped recreating the full-screen speed-streak canvas every frame; it now resizes only when needed and clears normally.
- Verified zero animation switches in the original threshold reproduction, smooth weights even when forcing a change every frame, camera stability and recovery near a wall, idle overlay sizing/drawing/clearing, walking/sprinting/jumping/slapping, web swing and first/third-person switching during a swing, plus the normal animation loop. Final browser checks reported no console errors. The player should reload to get `game.js?v=11` and confirm the feel on their own display.

## NPC arm direction fix
- Corrected forward arm rotations for photos, donations, panic, web tethers, rooftop activities, and thug attacks; walking/running now uses a forward-biased, opposing-arm gait with a modest elbow bend. Corrected villain forearms and Rhino's charge posture.
- Kept phones, signs, tools, shopping bags, and leashes aligned to the hands. Gunners hold their weapons forward and shots start at the muzzle when the detailed model is visible. Wall-splat poses now face the wall and start in the correct pose on the impact frame.
- Browser checks covered 82 walk/run poses, actual walking and fleeing, photos, a complete donation, seated and wheelchair NPCs, leash and bag attachment, enemy punch/shot damage, panic, each villain, and wall impacts from four directions. Side/front screenshots and a gameplay run were inspected; the final tests reported no console errors. Reload to get `game.js?v=12`.

## Nuke shockwave timing
- The player's launch now happens only when the expanding shockwave reaches their current horizontal position. Swinging and movement remain active until impact; the wind overlay and blast camera shake start at impact too.
- Removed the 1,700-unit propagation cap so the shockwave reaches the full map, kept the wave visible at long range, and delayed blackout/reset when needed to leave time to see a distant launch. No new on-screen text was added.
- Browser tests covered the complete keyboard launch, warning, fall, approaching wave, impact, flight and reset; nearby and distant positions; a hit more than 1,800 units from the target; movement toward and away from the wave; a web held until impact; the exact blast center; first- and third-person views; and pause/resume. Captured gameplay views were inspected and no console errors were reported. Reload to get `game.js?v=13`.
