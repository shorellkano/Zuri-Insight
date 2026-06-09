---
name: Production routing — api-server vs zuri-ai artifacts
description: How Replit routes /api/* requests in production; the api-server artifact must NOT declare paths.
---

## Rule
The `api-server` artifact (`artifacts/api-server/.replit-artifact/artifact.toml`) must NOT have `paths = ["/api"]` in its `[[services]]` block.

**Why:** In production, Replit's router matches the most specific path. If api-server claims `paths=["/api"]` and `localPort=8080`, all `/api/*` requests go to port 8080 where nothing runs. The actual combined Express server runs on port 3000 (started by the zuri-ai artifact's `pnpm start`). The zuri-ai artifact already has `paths=["/"]` which covers everything including `/api/*`.

**How to apply:** The correct api-server artifact.toml has NO `paths` key and NO `[services.production.run]` — it only exists for the dev workflow. The zuri-ai artifact handles all production routing.

## Correct api-server artifact.toml shape
```toml
[[services]]
localPort = 8080
name = "API Server"
# NO paths = [...] here

[services.development]
run = "pnpm --filter @workspace/api-server run dev"

[services.env]
PORT = "8080"
```
