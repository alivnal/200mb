# 200mb — Video Compressor (Squish)

Monorepo for browser and desktop video compression under 200 MB.

## Structure

```
v3/
├── apps/web/          # Next.js browser app (v3) — FFmpeg.wasm, port 3001
├── apps/desktop/      # Electron desktop app — native FFmpeg
├── packages/          # Package stubs (squish-core, i18n) for workspace resolution
└── scripts/           # Dev helpers (sync-squish-core, kill-port, fix-electron)

v4/
└── apps/web/          # Next.js browser app (v4) — trim support, port 3002
```

**Canonical shared source** lives in `v3/apps/web/lib/squish-core/` and `v3/apps/web/lib/i18n/`.
The v4 predev script (`ensure-workspace-packages.mjs`) syncs these into `v4/apps/web/lib/` automatically on every `npm run dev`.

## Quick start

```bash
npm install

# v3 web app  → http://localhost:3001
npm run dev:web

# v4 web app  → http://localhost:3002
npm run dev:web:v4

# Electron desktop
npm run dev
```

## Build & deploy

```bash
# Production web builds
npm run build:web        # v3
npm run build:web:v4     # v4

# Desktop portable/installer
npm run dist
```

**Vercel:** root `vercel.json` builds the v4 web app (`npm run build:web:v4`).
The Vercel project can use the repository root as its Root Directory.

## Notes

- Legacy pre-v3 files are documented in [LEGACY.md](LEGACY.md).
- When modifying shared types/functions (squish-core, i18n), always edit the **v3 source** (`v3/apps/web/lib/`). The v4 sync script will pick up changes automatically.
