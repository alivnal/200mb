# Video Compressor (Squish v3)

Monorepo for browser and desktop video compression under 200 MB.

## Structure

```
v3/
├── apps/web/       # Next.js browser app (Squik) — FFmpeg.wasm
├── apps/desktop/   # Electron desktop app — native FFmpeg
├── packages/squish-core/
└── scripts/
```

See [v3/README.md](v3/README.md) for details. Legacy pre-v3 folders are documented in [LEGACY.md](LEGACY.md).

## Quick start

```bash
npm install
npm run dev:web      # http://localhost:3001
npm run dev          # Electron desktop → http://localhost:3000
```

## Build & deploy

```bash
npm run build:web    # Production web build
npm run dist         # Desktop portable/installer → v3/apps/desktop/release/
```

**Vercel:** set Root Directory to `v3/apps/web`.

## Fonts

Geist + Geist Mono (Fontsource) on web and desktop.
