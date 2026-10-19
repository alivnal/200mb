import { app, shell, ShareMenu, type BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, link, mkdir, readdir, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ShareResult, ShareTarget } from './contracts';

// Browsers registered for mailto: mean webmail, which cannot take an attachment by URL.
const BROWSER_NAMES = /chrome|safari|firefox|edge|brave|arc|opera|vivaldi|chromium/i;

function openWith(appPath: string, filePath: string): Promise<void> {
  if (process.platform !== 'darwin') return Promise.reject(new Error('open -a is macOS only.'));
  return new Promise((resolve, reject) => {
    const child = spawn('open', ['-a', appPath, filePath]);
    child.once('error', reject);
    child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(`open exited with ${code}.`))));
  });
}

/** Opens a page in the browser and shows the file in Finder, ready to drag in. */
async function revealFor(url: string, filePath: string): Promise<ShareResult> {
  await shell.openExternal(url);
  shell.showItemInFolder(filePath);
  return 'revealed';
}

/** The Google Drive for desktop "My Drive" folder, if Drive is installed and signed in. */
async function driveFolder(): Promise<string | null> {
  const cloudStorage = join(app.getPath('home'), 'Library', 'CloudStorage');
  const entries = await readdir(cloudStorage).catch(() => [] as string[]);
  for (const entry of entries) {
    if (!entry.startsWith('GoogleDrive-')) continue;
    const myDrive = join(cloudStorage, entry, 'My Drive');
    if (existsSync(myDrive)) return myDrive;
  }
  return null;
}

/**
 * The encoded result lives as <jobId>.mp4; what people receive should carry the
 * real name, so share a hard link (or copy) named after it.
 */
export async function shareableCopy(path: string, filename: string, directory: string): Promise<string> {
  if (basename(path) === filename) return path;
  await mkdir(directory, { recursive: true });
  const target = join(directory, filename);
  await rm(target, { force: true });
  await link(path, target).catch(() => copyFile(path, target));
  return target;
}

export async function shareFile(
  filePath: string,
  filename: string,
  target: ShareTarget,
  window: BrowserWindow | null,
): Promise<ShareResult> {
  switch (target) {
    case 'drive': {
      const myDrive = await driveFolder();
      if (!myDrive) return revealFor('https://drive.google.com/drive/my-drive', filePath);
      // Drive for desktop uploads whatever lands in this folder.
      const folder = join(myDrive, 'Squik');
      await mkdir(folder, { recursive: true });
      const destination = join(folder, filename);
      await copyFile(filePath, destination);
      shell.showItemInFolder(destination);
      return 'opened';
    }
    case 'mail': {
      const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(filename)}`;
      const info = await app.getApplicationInfoForProtocol('mailto:').catch(() => null);
      if (!info || BROWSER_NAMES.test(info.name)) return revealFor(gmail, filePath);
      // Desktop mail clients start a new message with the file attached.
      return openWith(info.path, filePath).then(() => 'opened' as const, () => revealFor(gmail, filePath));
    }
    case 'slack': {
      const web = 'https://app.slack.com/client';
      const slack = await app.getApplicationInfoForProtocol('slack://open').catch(() => null);
      if (!slack) return revealFor(web, filePath);
      // Slack takes a file opened with it like one dropped on its Dock icon.
      return openWith(slack.path, filePath).then(() => 'opened' as const, () => revealFor(web, filePath));
    }
    case 'more': {
      if (process.platform !== 'darwin') {
        shell.showItemInFolder(filePath);
        return 'revealed';
      }
      new ShareMenu({ filePaths: [filePath] }).popup(window ? { window } : {});
      return 'opened';
    }
  }
}
