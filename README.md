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
- **Left mouse button:** hold to swing. The web picks a good anchor ahead of you, so you don't need to aim precisely (the ring shows where it will land). Hold on a person or car to grab them, then release while aiming at a wall to pin them, or at the sky to yeet them.
- **W while swinging:** pump through the bottom of the arc for speed. Releasing on the upswing slingshots you.
- **Space:** jump; while swinging fast it launches you with a barrel roll; against a wall it wall-jumps.
- **Shift:** sprint; while swinging, reel in the web; while airborne, glide.
- **F / Q / middle click:** spider-slap whatever is in front of you (people, cars, benches, hydrants, villains).
- **Hold T:** spider-sense slow motion.
- **Right mouse button:** web bomb.
- **E:** web zip toward the surface at the center of the view.
- **R:** reset; **N:** nuke (locked at first).

On touch devices, use the on-screen buttons and drag to look.

## The city

Manhattan runs from Harlem down past Central Park, Midtown (Times Square, the Empire State and Chrysler buildings), the Flatiron and Washington Square to the Financial District and Battery Park. The Statue of Liberty stands in the harbor, and the Brooklyn Bridge crosses the East River to DUMBO, brownstone Brooklyn and Coney Island's Wonder Wheel. You can swim in the rivers.

## Things to do

- **Cause chaos.** Body-check, stomp, slap and yeet citizens for chaos points and combo multipliers. Thrown people bowl others over and splat against walls. They get back up eventually.
- **Fight villains.** Rhino, Electro, the Green Goblin and Doc Ock each haunt a neighborhood. A breaking-news alert says when one shows up. Wear them down with webs, slaps, and by throwing people and cars at them. Each third of their health stuns them briefly.
- **Unlock the nuke** by beating every villain, or by causing 250,000 chaos.
- **Find the 40 golden pizza slices** hidden on rooftops and landmarks.
- **Race** through rings on four courses; fly through a glowing start ring to begin.
- **Rescue people** when the alerts pop up, or don't. Public opinion is watching.
- **Mutators** in the pause menu: moon gravity, bobblehead citizens, it's raining men, rocket webs.

Progress on the nuke unlock, pizza and race records is kept in the browser's local storage.

See [ASSETS.md](ASSETS.md) for third-party model credits.
