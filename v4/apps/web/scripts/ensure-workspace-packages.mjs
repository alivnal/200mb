/**
 * Sync shared lib folders from v3/apps/web/lib into v4/apps/web/lib.
 * The canonical source lives in v3/apps/web/lib/{squish-core,i18n}.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..', '..', '..');

function syncLib(libFolder) {
  const source = path.join(repoRoot, 'v3/apps/web/lib', libFolder);
  const target = path.join(webRoot, 'lib', libFolder);

  if (!fs.existsSync(source)) {
    console.error(`ensure-workspace-packages: missing v3/apps/web/lib/${libFolder}`);
    process.exit(1);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`ensure-workspace-packages: updated lib/${libFolder}`);
}

syncLib('squish-core');
syncLib('i18n');
