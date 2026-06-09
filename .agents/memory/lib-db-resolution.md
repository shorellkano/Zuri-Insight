---
name: lib/db package resolution
description: @workspace/db must have a main/exports field pointing to its TypeScript source or esbuild cannot bundle the api-server.
---

## Rule
`lib/db/package.json` must always include:
```json
"main": "./src/index.ts",
"exports": { ".": "./src/index.ts" }
```

**Why:** esbuild bundles the api-server with `bundle: true`. It resolves `@workspace/db` via the symlink at `artifacts/api-server/node_modules/@workspace/db → lib/db`. Without a `main` or `exports` field, esbuild has no entry point and throws "Could not resolve @workspace/db". The tsconfig emits declarations only (`emitDeclarationOnly: true`), so `lib/db/dist` contains only `.d.ts` files — never JS.

**How to apply:** Any time `lib/db/package.json` is edited (e.g. adding dependencies), verify `main` and `exports` are still present. The build error `Could not resolve "@workspace/db"` is the symptom when they are missing.
