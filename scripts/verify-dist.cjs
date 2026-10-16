const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const required = [
  'index.html',
  'kunduz-logo-blue.svg',
  path.join('wave', 'a9d7298a-b887-4d0c-a7b6-76b5932299ca-1.svg'),
  path.join('gym', '608c7462-9c8f-4fc1-8b71-ad3773f8ba73-1.svg'),
  path.join('sleep', 'e2980622-70aa-4b1e-a0a8-3e08c99eb958-1.svg'),
];

const missing = required.filter((rel) => !fs.existsSync(path.join(dist, rel)));

if (missing.length > 0) {
  console.error('Dist verification failed. Missing:');
  missing.forEach((item) => console.error(`  - dist/${item}`));
  process.exit(1);
}

console.log('Dist verification passed.');
