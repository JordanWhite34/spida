# Skyline Swing

A first-person, deeply irresponsible web-swinging sandbox set in New York, built with Three.js. Think superhero game crossed with Goat Simulator: the citizens are there to be saved, and also to be thrown.

## Run locally

From this directory, start a local web server:

```sh
python -m http.server 8000
```

Open http://localhost:8000 in a WebGL-capable browser. An internet connection is required to load Three.js and its model loader from jsDelivr. The included 3D models load from the local `assets` folder.

## Controls

- **WASD / arrow keys:** move; move the mouse to look (click the game to capture the pointer; Esc pauses).
- **Left mouse button:** hold to attach a web where you aim and swing. Hold on a person or car to grab them, then release while aiming at a wall to pin them, or at the sky to yeet them.
- **Space:** jump; press again against a wall to jump away.
- **Shift:** sprint; while swinging, reel in the web; while airborne, glide.
- **F / Q / middle click:** spider-slap whatever is in front of you (people, cars, benches, hydrants, villains). In midair (once unlocked) it becomes a ground pound; with a full hit combo it becomes a finisher.
- **Hold T:** spider-sense slow motion.
- **Right mouse button:** web bomb.
- **E:** web zip toward the surface at the center of the view.
- **R:** reset; **N:** nuke (locked at first).

On touch devices, use the on-screen buttons and drag to look.

## The city

Manhattan runs from Harlem down past Central Park, Midtown (Times Square, the Empire State and Chrysler buildings), the Flatiron and Washington Square to the Financial District and Battery Park. The Statue of Liberty stands in the harbor, and the Brooklyn Bridge crosses the East River to DUMBO, brownstone Brooklyn and Coney Island's Wonder Wheel. You can swim in the rivers.

## Things to do

- **Follow the story.** A chain of missions (top left, with a gold waypoint) walks you through street crime, each villain, collectibles and races, and ends at the nuke.
- **Stop street crime.** Muggings, robberies and gang fights pop up around you (red beacon). Thugs punch, gunners shoot and brutes take three hits. Red spider-sense means an attack is coming: jump for a perfect dodge.
- **Level up.** Heroics earn XP. Levels unlock a double jump, ground pound, faster web zips, faster finishers and new suits (pick them in the pause menu).
- **Don't get knocked out.** You have health now; it regenerates when you stay out of trouble. Hospital bills are not covered.
- **Cause chaos.** Body-check, stomp, slap and yeet citizens for chaos points and combo multipliers. Thrown people bowl others over and splat against walls. They get back up eventually.
- **Fight villains.** Rhino, Electro, the Green Goblin and Doc Ock each haunt a neighborhood. A breaking-news alert says when one shows up. They hit hard, heal if you run off, and each has a trick: Rhino's front is armored (hit him from behind, or dodge a charge so he crashes into a building and gets dazed), Electro shocks you if you slap him before webs stun him, the Goblin throws bomb volleys when enraged, and Doc Ock hurls cars. Throwing people and cars at them does the most damage.
- **Unlock the nuke** by beating every villain, or by causing 250,000 chaos. When it's called, the whole city runs for it.
- **Find the 40 golden pizza slices** hidden on rooftops and landmarks.
- **Race** through rings on four courses; fly through a glowing start ring to begin.
- **Rescue people** when the alerts pop up, or don't. Public opinion is watching.
- **Mutators** in the pause menu: moon gravity, bobblehead citizens, it's raining men, rocket webs.

Story progress, levels, suits, the nuke unlock, pizza and race records are kept in the browser's local storage.

## Models

The villains are generated in code by [toy-models.js](toy-models.js) from smooth primitives with vertex colors. The pedestrians use the original hand-built models in [game.js](game.js). [models.html](models.html) previews the generator, including an alternative set of people the game doesn't currently use.

See [ASSETS.md](ASSETS.md) for third-party model credits.
