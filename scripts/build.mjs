// Concatenates src/*.js (in file-name order) into game.js, which index.html loads directly.
// Usage: node scripts/build.mjs          rebuild game.js
//        node scripts/build.mjs --check  fail if game.js is out of date
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parts = readdirSync(join(root, 'src')).filter(name => name.endsWith('.js')).sort();
const output = parts.map(name => readFileSync(join(root, 'src', name), 'utf8')).join('');
const target = join(root, 'game.js');

if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) {
    console.error('game.js is out of date. Run: node scripts/build.mjs');
    process.exit(1);
  }
  console.log(`game.js matches ${parts.length} source parts.`);
} else {
  writeFileSync(target, output);
  console.log(`Wrote game.js from ${parts.length} source parts.`);
}
