# APA RackAttack — project notes for agents

All-in-one manager for amateur pool leagues: leagues, teams, players, match
schedule and computed standings.

## Stack

- `web/` — React + Vite dev server. Runs on port **3000** (the preview entry point).
- `api/` — Express + `pg` API. Runs on port **8000**.
- `db/` — PostgreSQL 16 (compose service, data in the `db_data` volume).

Single-origin wiring: the browser only talks to port 3000, and Vite proxies
`/api/*` to `http://api:8000` (see `web/vite.config.js`). No CORS needed.

## Running

```bash
docker compose -f docker-compose.base44.yml up -d --build
```

- Dependencies install on container startup (`npm install`); `node_modules` live
  in the `api_node_modules` / `web_node_modules` volumes so they survive restarts
  and are never committed.
- `api` creates the schema on boot (`initSchema`) and seeds demo data
  (`seedIfEmpty`) only when no leagues exist, so there is no one-shot container
  left in an `exited` state.
- Backend reload: `node --watch` restarts the API on file changes.
- Frontend reload: Vite HMR (watching uses polling — bind mounts don't emit
  inotify events).

## Verifying

```bash
curl -s localhost:3000/api/health           # {"status":"ok"}
curl -s localhost:3000/api/leagues          # league list (proxied through Vite)
docker compose -f docker-compose.base44.yml ps
```

## Quirks

- Vite needs `server.allowedHosts = true` because the preview proxy's hostname
  is not `localhost`. The platform also injects
  `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`.
- Local DB credentials are dev-only and set inline in compose (not secrets).
- No authentication yet — the app is a single shared workspace.
