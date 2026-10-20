/**
 * Windows smoke test for a built or installed Squik.exe (run by
 * .github/workflows/windows-desktop.yml). It drives the real app with
 * Playwright: window chrome, menu, then compress, merge (copy and encode) and
 * trim jobs on videos whose paths hold spaces, Turkish letters, an apostrophe,
 * and a UNC share. It also checks the window opens inside the screen's work
 * area with nothing scrolled or cut off. Screenshots and results.json land in
 * the output folder.
 *
 * With a scale (1.25, 1.5) it starts the app at that display scale, as Windows
 * display scaling would, and checks only the window and its layout.
 *
 *   node scripts/windows-smoke.mjs <path to Squik.exe> <output folder> [scale]
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { _electron } = require('playwright-core');

const [executablePath, outputArg = 'smoke-out', scaleArg] = process.argv.slice(2);
const scale = Number(scaleArg) || 1;
const tag = scale === 1 ? '' : `-${Math.round(scale * 100)}`;
if (!executablePath || !existsSync(executablePath)) throw new Error(`Squik.exe not found: ${executablePath}`);
const output = resolve(outputArg);
mkdirSync(output, { recursive: true });

const binDirectory = join(dirname(executablePath), 'resources', 'bin');
const ffmpeg = join(binDirectory, 'ffmpeg.exe');
const ffprobe = join(binDirectory, 'ffprobe.exe');

const results = [];
let failed = false;
function check(name, ok, detail, { soft = false } = {}) {
  results.push({ name, ok, soft, detail });
  console.log(`${ok ? 'PASS' : soft ? 'WARN' : 'FAIL'}  ${tag ? `[${Math.round(scale * 100)}%] ` : ''}${name}${detail === undefined ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok && !soft) failed = true;
}

function duration(path) {
  return Number(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], { encoding: 'utf8' }));
}

/** The whole screen, so the caption buttons Windows draws over the page are in the picture. */
function screenshotScreen(name) {
  const file = join(output, `${name}${tag}.png`);
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
    '$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$i = New-Object System.Drawing.Bitmap $b.Width, $b.Height',
    '$g = [System.Drawing.Graphics]::FromImage($i)',
    '$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)',
    `$i.Save('${file.replaceAll("'", "''")}', [System.Drawing.Imaging.ImageFormat]::Png)`,
  ].join('; ');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'inherit' });
  } catch (error) {
    check(`screen screenshot ${name}`, false, String(error), { soft: true });
  }
}

// Test clips: two that share codec settings (joined by stream copy through the
// concat list) and one at another size (joined by re-encoding).
const videoDirectory = join(tmpdir(), "Squik Smoke Ömer Şahin", "it's ders");
const clips = {
  first: join(videoDirectory, 'ders 1 çğü.mp4'),
  second: join(videoDirectory, "ders 2 it's.mp4"),
  other: join(videoDirectory, 'farklı boyut 3.mp4'),
  // Phone-like 4K HEVC: decoded on the GPU when it can, in software when not.
  phone: join(videoDirectory, 'telefon 4K hevc.mp4'),
};
for (const [path, size] of scale === 1 ? [[clips.first, '1280x720'], [clips.second, '1280x720'], [clips.other, '640x480']] : []) {
  mkdirSync(videoDirectory, { recursive: true });
  execFileSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `testsrc2=d=3:s=${size}:r=30`,
    '-f', 'lavfi', '-i', 'sine=f=440:d=3',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path,
  ]);
}
if (scale === 1) {
  execFileSync(ffmpeg, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', 'testsrc2=d=2:s=3840x2160:r=30',
    '-f', 'lavfi', '-i', 'sine=f=440:d=2',
    '-c:v', 'libx265', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-c:a', 'aac', '-shortest', clips.phone,
  ]);
  check('test clips created with bundled ffmpeg.exe', true, videoDirectory);
}

const app = await _electron.launch({
  executablePath,
  args: scale === 1 ? [] : [`--force-device-scale-factor=${scale}`],
  timeout: 60_000,
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('.app-header', { timeout: 60_000 });
  await page.waitForTimeout(1500);

  const chrome = await page.evaluate(() => {
    const header = document.querySelector('.app-header');
    const overlay = navigator.windowControlsOverlay;
    return {
      platform: document.documentElement.dataset.platform ?? null,
      theme: document.documentElement.getAttribute('data-theme'),
      overlayVisible: overlay?.visible ?? null,
      titlebarArea: overlay?.getTitlebarAreaRect?.().toJSON() ?? null,
      headerPaddingRight: header ? getComputedStyle(header).paddingRight : null,
      headerDrag: header ? getComputedStyle(header).getPropertyValue('-webkit-app-region') : null,
      controlsRight: document.querySelector('.app-header-controls')?.getBoundingClientRect().right ?? null,
      viewportWidth: window.innerWidth,
      hasDesktopApi: typeof window.squikDesktop?.runJob === 'function',
    };
  });
  check('html[data-platform="win"]', chrome.platform === 'win', chrome.platform);
  check('desktop API exposed', chrome.hasDesktopApi);
  check('window controls overlay visible', chrome.overlayVisible === true, chrome.titlebarArea);
  check('header is the drag region', chrome.headerDrag === 'drag', chrome.headerDrag);
  if (chrome.titlebarArea && chrome.controlsRight !== null) {
    const captionLeft = chrome.titlebarArea.x + chrome.titlebarArea.width;
    check('header controls clear the caption buttons', chrome.controlsRight <= captionLeft, { controlsRight: chrome.controlsRight, captionLeft });
  }

  const native = await app.evaluate(({ BrowserWindow, Menu }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const menu = Menu.getApplicationMenu();
    const open = menu?.items.flatMap((item) => item.submenu?.items ?? []).find((item) => item.label.startsWith('Open Video'));
    return {
      menu: menu?.items.map((item) => item.label) ?? [],
      openAccelerator: open?.accelerator ?? null,
      bounds: window.getBounds(),
      menuBarVisible: window.isMenuBarVisible(),
    };
  });
  check('menu File/Edit/View/Help', ['File', 'Edit', 'View', 'Help'].every((label) => native.menu.includes(label)), native.menu);
  check('Open Video accelerator', native.openAccelerator === 'CmdOrCtrl+O', native.openAccelerator);

  // The window opens inside the work area, and like an app: nothing scrolls,
  // the whole tool card and the footer are on screen.
  const fit = await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const bounds = window.getBounds();
    const display = screen.getDisplayMatching(bounds);
    return { bounds, workArea: display.workArea, scaleFactor: display.scaleFactor };
  });
  const { bounds, workArea } = fit;
  check('window inside the work area', bounds.x >= workArea.x - 8 && bounds.y >= workArea.y - 8 &&
    bounds.x + bounds.width <= workArea.x + workArea.width + 8 && bounds.y + bounds.height <= workArea.y + workArea.height + 8, fit);
  const layout = await page.evaluate(() => {
    const doc = document.documentElement;
    const area = document.querySelector('.screen-content');
    const card = document.querySelector('.tool-ui').getBoundingClientRect();
    const footer = document.querySelector('.app-site-footer').getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      windowScrolls: doc.scrollHeight > doc.clientHeight + 1,
      areaScrolls: area.scrollHeight > area.clientHeight + 1,
      cardBottom: Math.round(card.bottom),
      areaBottom: Math.round(area.getBoundingClientRect().bottom),
      footerOnScreen: footer.bottom <= doc.clientHeight + 1,
    };
  });
  check('opens without scrolling, card and footer on screen',
    !layout.windowScrolls && !layout.areaScrolls && layout.cardBottom <= layout.areaBottom + 1 && layout.footerOnScreen, layout);

  screenshotScreen(`window-${chrome.theme ?? 'initial'}`);
  await page.screenshot({ path: join(output, `page-${chrome.theme ?? 'initial'}${tag}.png`) });
  await page.click('.theme-toggle');
  await page.waitForTimeout(800);
  const toggled = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  screenshotScreen(`window-${toggled}`);
  await page.screenshot({ path: join(output, `page-${toggled}${tag}.png`) });

  // Jobs and paths do not depend on the display scale; the 100% run covers them.
  if (scale === 1) {
    // The app keeps results in a folder named after its process (see outputDirectory in main.ts).
    const appPid = await app.evaluate(() => process.pid);
    const outputPath = (jobId) => join(tmpdir(), 'squik-work', `${appPid}`, `${jobId}.mp4`);
    const runJob = (jobId, job) => page.evaluate(([id, value]) => window.squikDesktop.runJob(id, value), [jobId, job]);

    for (const [label, path] of Object.entries(clips)) {
      const probe = await page.evaluate((value) => window.squikDesktop.probe(value), path);
      check(`probe ${label}`, Math.abs(probe.duration - (label === 'phone' ? 2 : 3)) < 0.3, probe);
    }

    const compressed = await runJob('smoke-compress', { kind: 'compress', path: clips.first });
    check('compress', compressed.compressedSize > 0, compressed);

    const copied = await runJob('smoke-merge-copy', { kind: 'merge', paths: [clips.first, clips.second] });
    check('merge by stream copy (concat list with backslash paths)', copied.skippedEncode === true, copied);
    check('merge by copy duration', Math.abs(duration(outputPath('smoke-merge-copy')) - 6) < 0.5);

    const encoded = await runJob('smoke-merge-encode', { kind: 'merge', paths: [clips.first, clips.other] });
    check('merge by encode', encoded.skippedEncode === false && encoded.compressedSize > 0, encoded);
    check('merge by encode duration', Math.abs(duration(outputPath('smoke-merge-encode')) - 6) < 0.5);

    // 4K HEVC joined with a 640x480 clip: an encode that tries GPU decoding first.
    const phoneMerge = await runJob('smoke-merge-hevc', { kind: 'merge', paths: [clips.phone, clips.other] });
    check('merge 4K HEVC with another clip (GPU decode or software fallback)', phoneMerge.skippedEncode === false && phoneMerge.compressedSize > 0, phoneMerge);
    check('merge 4K HEVC duration', Math.abs(duration(outputPath('smoke-merge-hevc')) - 5) < 0.5);

    const trimmed = await runJob('smoke-trim', { kind: 'trim', path: clips.first, deleteSegments: [{ startSec: 1, endSec: 2 }] });
    check('trim', trimmed.compressedSize > 0, trimmed);
    check('trim duration', Math.abs(duration(outputPath('smoke-trim')) - 2) < 0.5);

    // The same clip through the administrative share, as a UNC path.
    const unc = clips.first.replace(/^([A-Za-z]):/, (_, drive) => `\\\\localhost\\${drive}$`);
    try {
      const probe = await page.evaluate((value) => window.squikDesktop.probe(value), unc);
      const job = await runJob('smoke-unc', { kind: 'trim', path: unc, deleteSegments: [{ startSec: 0, endSec: 1 }] });
      check('UNC path probe and trim', probe.duration > 0 && job.compressedSize > 0, { unc, job });
    } catch (error) {
      check('UNC path probe and trim', false, { unc, error: String(error) }, { soft: true });
    }

    // Ctrl+O through the hidden menu bar should open the page's file picker.
    try {
      const chooser = page.waitForEvent('filechooser', { timeout: 5000 });
      await page.keyboard.press('Control+O');
      await chooser;
      check('Ctrl+O opens the file picker', true);
    } catch (error) {
      check('Ctrl+O opens the file picker', false, String(error), { soft: true });
    }
  }
} catch (error) {
  check('smoke run', false, String(error?.stack ?? error));
} finally {
  writeFileSync(join(output, `results${tag}.json`), JSON.stringify(results, null, 2));
  await app.close().catch(() => {});
}

process.exit(failed ? 1 : 0);
