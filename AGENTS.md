# AGENTS.md

## Cursor Cloud specific instructions

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Excalidraw Dev Server (Vite) | `yarn start` | 3001 | Main frontend app; works standalone for editing/drawing |

The app works fully for local drawing without external services. Collaboration (WebSocket on port 3002), AI backend (port 3016), and Excalidraw Plus (port 3000) are optional and require separate repos/services.

### Running the app

```bash
yarn start          # Starts Vite dev server on http://localhost:3001
```

### Lint / Test / Build

See `CLAUDE.md` for the canonical list. Key commands:

- `yarn test:typecheck` — TypeScript type checking
- `yarn test:code` — ESLint (must pass with `--max-warnings=0`)
- `yarn test:update` — Run all vitest tests (updates snapshots)
- `yarn fix` — Auto-fix formatting + lint issues
- `yarn build:app` — Production build of the web app

### Non-obvious caveats

- The `prepare` script runs `husky install` during `yarn install`. The pre-commit hook is currently commented out (see `.husky/pre-commit`).
- Firebase config warnings in test output (`Error JSON parsing firebase config`) are expected and harmless — the test env does not set `VITE_APP_FIREBASE_CONFIG`.
- Browserslist "caniuse-lite outdated" warnings during dev server startup are cosmetic and do not affect functionality.
- TypeScript version (5.9.x) is newer than what `@typescript-eslint` officially supports — this produces a warning during lint but does not cause failures.
- The dev server uses `FAST_REFRESH=false` by default (see `.env.development`).
