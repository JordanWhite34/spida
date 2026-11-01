# Skyline Swing

A third- and first-person, deeply irresponsible web-swinging sandbox set in New York, built with Three.js. Think superhero game crossed with Goat Simulator: the citizens are there to be saved, and also to be thrown.

## Run locally

From this directory, start a local web server:

```sh
python -m http.server 8000
```

Open http://localhost:8000 in a WebGL-capable browser. An internet connection is required to load Three.js and its model loader from jsDelivr. The included 3D models load from the local `assets` folder.

## Controls

- **WASD / arrow keys:** move; move the mouse to look (click the game to capture the pointer; Esc pauses).
- **V:** switch between third-person and first-person views. The camera moves in near walls; your selected view is saved.
- **Left mouse button:** hold to attach a web where you aim and swing. Hold on a person, vehicle, bench, cart, trash can, or cone to grab it; release while aiming at a surface to pin it, at another person or vehicle to tether them together, or at the sky to throw it.
- **Space:** jump; press again against a wall to jump away.
- **Shift:** sprint; while swinging, reel in the web; while airborne, glide.
- **F / Q / middle click:** spider-slap whatever is in front of you (people, cars, benches, hydrants, villains). Chain slaps quickly for a stronger third hit, and hit airborne or downed targets again to juggle them. In midair (once unlocked) it becomes a ground pound when no target is nearby; with a full hit combo it becomes a finisher when a target is in range.
- **C:** dodge in your movement direction, or backward when stationary. Dodging during a spider-sense warning gives a perfect dodge and a brief counterattack bonus.
- **Hold T:** spider-sense slow motion.
- **Right mouse button:** web bomb.
- **E:** web zip toward the surface at the center of the view.
- **R:** reset; **N:** nuke (locked at first).

On touch devices, use the on-screen buttons and drag to look; the camera button switches views. The pause menu also has a camera switch and Performance, Balanced, and High graphics settings; the selected settings are saved in the browser. The pause menu has separate music and sound-effects switches. Sound starts after your first click or keypress, as required by browsers.

## The city

The northern residential neighborhood connects to Harlem, Central Park, Midtown (Times Square, the Empire State and Chrysler buildings), the Flatiron and Washington Square, the Financial District and Battery Park. The Statue of Liberty stands on a reachable island in the harbor, and the Brooklyn Bridge crosses the East River to DUMBO, brownstone Brooklyn and Coney Island's Wonder Wheel. The waterfront footbridge leads to a small harbor island. You can swim in the rivers.

Look for neighborhood markets, park gatherings, rooftop parties, scaffolding, different storefronts, and crowds of tourists, couriers, construction workers, performers, and other city residents. Building fronts, shop displays, rooftops and streets have details to discover. People react to nearby danger and may stop to take photos when things are calm.

## Things to do

- **Follow the story.** A chain of missions (top left, with a gold waypoint) walks you through street crime, each villain, collectibles and races, and ends at the nuke.
- **Stop street crime.** Muggings, robberies and gang fights pop up around you (red beacon). Thugs punch, gunners shoot and brutes take three hits. Red spider-sense means an attack is coming: dodge at the right moment for a counterattack bonus.
- **Level up.** Heroics earn XP. Levels unlock a double jump, ground pound, faster web zips, faster finishers and new suits (pick them in the pause menu).
- **Don't get knocked out.** You have health now; it regenerates when you stay out of trouble. Hospital bills are not covered.
- **Cause chaos.** Body-check, stomp, slap and yeet citizens for chaos points and combo multipliers. Thrown people bowl others over and splat against walls. They get back up eventually.
- **Fight villains.** Rhino, Electro, the Green Goblin and Doc Ock each haunt a neighborhood. A breaking-news alert says when one shows up. They hit hard, heal if you run off, and each has a trick: Rhino's front is armored (hit him from behind, or dodge a charge so he crashes into a building and gets dazed), Electro shocks you if you slap him before webs stun him, the Goblin throws bomb volleys when enraged, and Doc Ock hurls cars. Throwing people and cars at them does the most damage.
- **Unlock the nuke** by beating every villain, or by causing 250,000 chaos. When it's called, the whole city runs for it.
- **Find the 40 golden pizza slices** hidden on rooftops and landmarks.
- **Race** through rings on four courses; fly through a glowing start ring to begin.
- **Find the bounce pads.** Land on one or run across it at speed to launch yourself; people and thrown objects bounce too. A pad can even catch someone who is falling.
- **Hit the targets.** Look for three-target galleries in the park, at the boardwalk and on a rooftop. Hit every target with a web bomb, slap or thrown object to complete the set. The targets reset so you can play again.
- **Set off pressure tanks.** Slap them, web-bomb them or hit them with something you've thrown. Their blasts send nearby people, vehicles and objects flying, and can set off other tanks.
- **Link an aerial run.** Chain swings, zips, bounces and fast close passes near buildings before landing to add to your combo score.
- **Rescue people** when the alerts pop up, or don't. Public opinion is watching.
- **Find spontaneous incidents.** Runaway food carts, falls, street performances, and traffic pileups can happen around the city. Web a runaway cart to stop it or let events unfold.
- **Mutators** in the pause menu: moon gravity, bobblehead citizens, it's raining men, rocket webs.

Story progress, levels, suits, the nuke unlock, pizza and race records are kept in the browser's local storage.

## Models

The third-person hero uses an animated Quaternius superhero base with an in-game suit shader. The villains are generated in code by [toy-models.js](toy-models.js) from smooth primitives with vertex colors. The pedestrians use the original hand-built models in [game.js](game.js). [models.html](models.html) previews the generator, including an alternative set of people the game doesn't currently use.

See [ASSETS.md](ASSETS.md) for third-party model credits.
