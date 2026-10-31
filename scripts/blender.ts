// Runs a Blender Python script headless: tsx scripts/blender.ts <script.py> [-- args for the script]
// Blender is taken from $BLENDER, else the newest C:\Program Files\Blender Foundation\*\blender.exe.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function findBlender(): string {
  if (process.env.BLENDER && existsSync(process.env.BLENDER)) return process.env.BLENDER;
  const base = 'C:\\Program Files\\Blender Foundation';
  if (existsSync(base)) {
    const versions = readdirSync(base)
      .filter((d) => existsSync(join(base, d, 'blender.exe')))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    if (versions.length) return join(base, versions[0], 'blender.exe');
  }
  return 'blender';
}

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error('usage: tsx scripts/blender.ts <script.py> [-- args]');
  process.exit(2);
}
const passthrough = rest[0] === '--' ? rest.slice(1) : rest;
const blender = findBlender();
console.log(`Blender: ${blender}`);
const res = spawnSync(blender, ['-b', '--factory-startup', '-P', script, '--', ...passthrough], { stdio: 'inherit' });
process.exit(res.status ?? 1);
