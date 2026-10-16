const { downloadArtifact } = require('@electron/get');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const electronDir = path.join(projectRoot, 'node_modules', 'electron');
const distDir = path.join(electronDir, 'dist');
const { version } = require(path.join(electronDir, 'package.json'));

function isInstalled() {
  const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron';
  const exePath = path.join(distDir, exeName);
  const pathFile = path.join(electronDir, 'path.txt');
  return fs.existsSync(exePath) && fs.existsSync(pathFile);
}

async function extractZip(zipPath, destDir) {
  if (process.platform === 'win32') {
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`,
      ],
      { stdio: 'inherit' }
    );
    return;
  }

  const extract = require('extract-zip');
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  await extract(zipPath, { dir: destDir });
}

async function main() {
  if (isInstalled()) {
    console.log(`Electron v${version} already installed.`);
    return;
  }

  console.log(`Installing Electron v${version}...`);

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch: process.arch,
    force: true,
  });

  console.log(`Downloaded: ${zipPath}`);
  await extractZip(zipPath, distDir);

  const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron';
  const exePath = path.join(distDir, exeName);

  if (!fs.existsSync(exePath)) {
    console.error('Extract failed. dist contents:', fs.readdirSync(distDir));
    process.exit(1);
  }

  fs.writeFileSync(path.join(electronDir, 'path.txt'), exeName);
  fs.writeFileSync(path.join(distDir, 'version'), `v${version}`);

  console.log(`Ready: ${exePath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
