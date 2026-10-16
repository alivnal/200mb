import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const squishCore = path.join(root, 'lib', 'squish-core', 'index.ts');
const i18n = path.join(root, 'lib', 'i18n', 'index.ts');

if (!fs.existsSync(squishCore) || !fs.existsSync(i18n)) {
  console.error(
    'Missing lib/squish-core or lib/i18n. From repo root run: node v4/apps/web/scripts/ensure-workspace-packages.mjs',
  );
  process.exit(1);
}
