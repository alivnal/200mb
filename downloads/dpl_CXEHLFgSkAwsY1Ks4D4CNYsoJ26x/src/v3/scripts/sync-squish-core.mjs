/**
 * Sync shared packages into v3/apps/web/lib before web deploys.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const v3Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function syncPackage(packageName, libFolder) {
  const source = path.join(v3Root, 'packages', packageName, 'src');
  const target = path.join(v3Root, 'apps', 'web', 'lib', libFolder);

  if (!fs.existsSync(source)) {
    console.error(`sync-squish-core: missing v3/packages/${packageName}/src`);
    process.exit(1);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`sync-squish-core: updated v3/apps/web/lib/${libFolder}`);
}

syncPackage('squish-core', 'squish-core');
syncPackage('i18n', 'i18n');
