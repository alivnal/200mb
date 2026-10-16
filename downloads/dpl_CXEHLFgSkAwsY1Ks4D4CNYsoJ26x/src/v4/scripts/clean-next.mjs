import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nextDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', '.next');

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(`[Squish] Removed ${nextDir}`);
} catch {
  // already clean
}
