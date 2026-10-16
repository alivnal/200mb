#!/usr/bin/env node
/**
 * Free a TCP port before starting a dev server (Windows-friendly).
 */

import { execSync } from 'node:child_process';

const port = process.argv[2] ?? '3001';

function killWindows(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const pids = [
      ...new Set(
        output
          .split(/\r?\n/)
          .map((line) => line.trim().split(/\s+/).at(-1))
          .filter((pid) => pid && pid !== '0'),
      ),
    ];

    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`Freed port ${port} (stopped PID ${pid})`);
    }
  } catch {
    // Nothing listening — port already free.
  }
}

function killUnix(port) {
  try {
    execSync(`lsof -ti tcp:${port} | xargs -r kill -9`, { stdio: 'ignore', shell: true });
    console.log(`Freed port ${port}`);
  } catch {
    // Nothing listening.
  }
}

if (process.platform === 'win32') killWindows(port);
else killUnix(port);
