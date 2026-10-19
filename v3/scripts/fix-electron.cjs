const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const electronInstallScript = path.join(projectRoot, 'node_modules', 'electron', 'install.js');

if (!fs.existsSync(electronInstallScript)) {
  throw new Error(`Electron installer not found: ${electronInstallScript}`);
}

execFileSync(process.execPath, [electronInstallScript], { stdio: 'inherit' });
