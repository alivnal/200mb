# Legacy layout (v1)

The active codebase lives under **`v3/`**. These root-level folders are the pre-v3 layout and are kept for reference only:

| Path | Replaced by |
|------|-------------|
| `web/` | `v3/apps/web/` |
| `src/` + `electron/` + `public/` + `index.html` | `v3/apps/desktop/` |
| `packages/squish-core/` | `v3/packages/squish-core/` |
| `scripts/` | `v3/scripts/` |

Use commands from the repo root (`npm run dev:web`, `npm run dev`, etc.) — they target v3 workspaces.

Safe to delete the legacy folders once you confirm v3 works for your workflow.
