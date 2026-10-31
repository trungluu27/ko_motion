// Downloads MediaPipe pose models into public/models and copies the WASM runtime into public/mediapipe/wasm.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODELS = ['full', 'lite'] as const;
const modelUrl = (v: string) =>
  `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${v}/float16/latest/pose_landmarker_${v}.task`;

async function fetchModels(): Promise<void> {
  const dir = join('public', 'models');
  mkdirSync(dir, { recursive: true });
  for (const v of MODELS) {
    const file = join(dir, `pose_landmarker_${v}.task`);
    if (existsSync(file) && statSync(file).size > 0) {
      console.log(`✓ ${file} (đã có)`);
      continue;
    }
    const res = await fetch(modelUrl(v));
    if (!res.ok) throw new Error(`Tải ${v} thất bại: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`↓ ${file} (${statSync(file).size} bytes)`);
  }
}

function copyWasm(): void {
  const src = join('node_modules', '@mediapipe', 'tasks-vision', 'wasm');
  const dst = join('public', 'mediapipe', 'wasm');
  mkdirSync(dst, { recursive: true });
  for (const f of readdirSync(src)) copyFileSync(join(src, f), join(dst, f));
  console.log(`✓ WASM → ${dst}`);
}

await fetchModels();
copyWasm();
