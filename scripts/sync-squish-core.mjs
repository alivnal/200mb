/**
 * Sync packages/squish-core → web/squish-core before web deploys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'packages', 'squish-core');
const target = path.join(root, 'web', 'squish-core');

if (!fs.existsSync(source)) {
  console.error('sync-squish-core: missing packages/squish-core');
  process.exit(1);
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log('sync-squish-core: updated web/squish-core');
