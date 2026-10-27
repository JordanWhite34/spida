# Skyline Swing

A first-person 3D city exploration and web-swinging game built with Three.js.

## Run locally

From this directory, start a local web server:

```sh
python -m http.server 8000
```

Open http://localhost:8000 in a WebGL-capable browser. An internet connection is required to load Three.js and its model loader from jsDelivr. The included 3D models load from the local `assets` folder.

## Controls

- **WASD / arrow keys:** move; move the mouse to look (click the game to capture the pointer; Esc releases it).
- **Space:** jump; press again against a wall to jump away.
- **Shift:** sprint; while swinging, reel in the web.
- **Left mouse button:** hold to attach a web or grab an actor; release to let go.
- **Right mouse button:** fire a web bomb.
- **E:** web zip toward the surface at the center of the view.
- **R:** reset; **N:** trigger the nuke.

On touch devices, use the on-screen buttons and drag to look.

See [ASSETS.md](ASSETS.md) for third-party model credits.
