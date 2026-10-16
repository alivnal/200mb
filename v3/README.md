# Squish v3

Production monorepo layout for browser (WASM) and desktop (Electron) video compression.

## Structure

```
v3/
├── apps/
│   ├── web/          # Next.js — browser compression (Squik)
│   └── desktop/      # Electron + Vite — native FFmpeg
├── packages/
│   └── squish-core/  # Shared compression strategy & types
└── scripts/          # Build utilities (sync, verify, electron fix)
```

## Commands (from repo root)

| Command | Description |
|---------|-------------|
| `npm run dev:web` | Next.js dev server → http://localhost:3001 |
| `npm run dev` | Electron desktop dev → http://localhost:3000 |
| `npm run build:web` | Production web build |
| `npm run build:desktop` | Desktop Vite + Electron bundle |
| `npm run sync:squish-core` | Copy core package into web vendor dir |

## Vercel

Set **Root Directory** to `v3/apps/web` in the Vercel project settings, or deploy from that folder.

## Fonts

Web and desktop use **Geist** + **Geist Mono** (Fontsource). Material Symbols for icons.
