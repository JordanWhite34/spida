// Headless smoke test: serves the game, loads it with the debug hook and drives a few core systems.
// Usage: npm test   (needs `npx playwright install chromium` once)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const file = join(root, path === '/' ? 'index.html' : path);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, resolve));
const url = `http://localhost:${server.address().port}/?debug&test`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });

let failures = 0;
async function check(name, fn) {
  try { const detail = await page.evaluate(fn); console.log(`ok   ${name}${detail ? ` (${detail})` : ''}`); }
  catch (error) { failures++; console.log(`FAIL ${name}: ${error.message.split('\n')[0]}`); }
}

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__spida, null, { timeout: 60000 });

  await check('world builds', () => {
    const S = window.__spida;
    if (S.buildings.length < 500) throw new Error(`only ${S.buildings.length} buildings`);
    if (S.pedestrians.length < 200) throw new Error(`only ${S.pedestrians.length} pedestrians`);
    return `${S.buildings.length} buildings, ${S.pedestrians.length} people, ready after ${(performance.now() / 1000).toFixed(1)}s`;
  });
  await check('simulation runs', () => {
    const S = window.__spida; S.teleport(0, 2, 30); S.tick(2);
    const state = JSON.parse(window.render_game_to_text());
    if (!Number.isFinite(state.player.y)) throw new Error('player position is not finite');
    return `${S.renderer.info.render.calls} draw calls`;
  });
  await check('web swing attaches', () => {
    const S = window.__spida; S.teleport(-120, 30, 222); S.look(-Math.PI / 2, .3); S.tick(.1);
    S.beginWebAction(); S.tick(.5); const swinging = S.state().rope; S.endWebAction(); S.tick(.2);
    if (!swinging) throw new Error('no rope after aiming at a building');
  });
  await check('slap and dodge', () => {
    const S = window.__spida; S.teleport(0, 1, 30); S.tick(.5); S.spiderSlap(); S.dodge(); S.tick(.5);
    if (S.state().dodgeCooldown <= 0) throw new Error('dodge did not start its cooldown');
  });
  await check('day, night and weather', () => {
    const S = window.__spida; S.setTime(23); S.setWeather('rain'); S.tick(1); S.setWeather('snow'); S.tick(1); S.setWeather('clear'); S.setTime(12); S.tick(.5);
  });
  await check('subway train runs', () => {
    const S = window.__spida; const start = S.trainState().z; S.tick(5);
    if (S.trainState().z === start) throw new Error('train did not move');
  });
  await check('nuke is locked at first', () => {
    const S = window.__spida; S.teleport(0, 2, 30); S.launchNuke(); S.tick(1);
    if (S.nukeState()) throw new Error('nuke launched while locked');
    localStorage.setItem('spida.nukeUnlocked', '1');
  });
  await page.reload();
  await page.waitForFunction(() => window.__spida, null, { timeout: 60000 });
  await check('unlocked nuke launches', () => {
    const S = window.__spida; S.teleport(0, 2, 30); S.look(0, -.6); S.tick(.2); S.launchNuke(); S.tick(1);
    if (!S.nukeState()) throw new Error('nuke did not start');
    localStorage.removeItem('spida.nukeUnlocked');
    S.reset(); S.tick(.5);
    if (S.nukeState()) throw new Error('reset left the nuke active');
  });
  if (errors.length) { failures++; console.log(`FAIL console errors:\n  ${errors.slice(0, 10).join('\n  ')}`); }
  else console.log('ok   no console errors');
} finally {
  await browser.close(); server.close();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
