import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { chmod, copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceDirectory = resolve(appDirectory, '../../..');
const targetPlatform = process.env.SQUIK_TARGET_PLATFORM || process.platform;
const targetArch = process.env.SQUIK_TARGET_ARCH || process.arch;
const isWindows = targetPlatform === 'win32';
// Windows binaries get their own subfolder so a Mac build never ships .exe files
// and a Windows build never ships Mach-O ones (see "extraResources" per platform).
const outputDirectory = join(appDirectory, 'build-resources', 'bin', ...(isWindows ? [`win32-${targetArch}`] : []));

/**
 * The binary inside an @ffmpeg-installer / @ffprobe-installer platform package.
 * npm installs only the host's package, so for another OS (a Windows build on a
 * Mac) the tarball pinned in package-lock.json is fetched, checked against its
 * lockfile integrity, and unpacked into node_modules/.cache.
 */
async function platformBinary(scope, name) {
  const packageName = `${scope}/${targetPlatform}-${targetArch}`;
  const fileName = isWindows ? `${name}.exe` : name;
  try {
    return require.resolve(`${packageName}/${fileName}`);
  } catch {
    // Not installed for this host; fall through to the lockfile.
  }

  const lock = JSON.parse(readFileSync(join(workspaceDirectory, 'package-lock.json'), 'utf8'));
  const entry = lock.packages?.[`node_modules/${packageName}`];
  if (!entry?.resolved || !entry.integrity) {
    throw new Error(`package-lock.json has no ${packageName} entry; FFmpeg cannot be prepared for ${targetPlatform}-${targetArch}.`);
  }
  const cacheDirectory = join(workspaceDirectory, 'node_modules', '.cache', 'squik-native', `${packageName.replace('/', '+')}-${entry.version}`);
  const cachedBinary = join(cacheDirectory, 'package', fileName);
  if (existsSync(cachedBinary)) return cachedBinary;

  const response = await fetch(entry.resolved);
  if (!response.ok) throw new Error(`Downloading ${entry.resolved} failed: HTTP ${response.status}.`);
  const tarball = Buffer.from(await response.arrayBuffer());
  const [algorithm, expected] = entry.integrity.split('-');
  const actual = createHash(algorithm).update(tarball).digest('base64');
  if (actual !== expected) throw new Error(`${packageName}@${entry.version} does not match its package-lock.json integrity.`);

  await rm(cacheDirectory, { recursive: true, force: true });
  await mkdir(cacheDirectory, { recursive: true });
  const tarballPath = join(cacheDirectory, 'package.tgz');
  await writeFile(tarballPath, tarball);
  execFileSync('tar', ['-xzf', tarballPath, '-C', cacheDirectory], { stdio: 'inherit' });
  await rm(tarballPath, { force: true });
  if (!existsSync(cachedBinary)) throw new Error(`${packageName}@${entry.version} has no ${fileName}.`);
  return cachedBinary;
}

await mkdir(outputDirectory, { recursive: true });

for (const [name, scope] of [['ffmpeg', '@ffmpeg-installer'], ['ffprobe', '@ffprobe-installer']]) {
  const sourcePath = targetPlatform === process.platform && targetArch === process.arch
    ? require(`${scope}/${name}`).path
    : await platformBinary(scope, name);
  if (!sourcePath) {
    throw new Error(`The ${scope}/${name} package has no binary for ${targetPlatform}-${targetArch}.`);
  }

  const destinationPath = join(outputDirectory, isWindows ? `${name}.exe` : name);
  await rm(destinationPath, { force: true });
  await copyFile(sourcePath, destinationPath);
  await chmod(destinationPath, 0o755);
}

console.info(`Prepared native FFmpeg binaries for ${targetPlatform}-${targetArch} in ${outputDirectory}.`);
