# Phase 3 AI analytics

The backend keeps all business calculations deterministic and location-scoped.
The Manager-only briefing endpoint can optionally summarize those facts with a
local Ollama model; it never writes menu, inventory, or pricing data.

## Endpoints

All endpoints require a Manager bearer token. Managers can pass
`location_id=<positive integer>` to select a branch, or omit it for a
cross-location view.

- `GET /api/insights/menu?days=90` — menu sales, ABC classes, margins, and
  data-quality signals.
- `GET /api/insights/forecast?days=90&horizonDays=14` — deterministic
  per-menu-item demand forecasts.
- `GET /api/insights/inventory?days=90&horizonDays=14` — stockout and reorder
  actions derived from forecasts and recipes.
- `GET /api/insights/optimization?days=90&horizonDays=14` — forecasts,
  inventory actions, basket-based combos, guarded price signals, and staffing
  suggestions.
- `GET /api/insights/staffing?days=90` — advisory hourly staffing coverage
  suggestions based on completed-order demand.
- `GET` or `POST /api/insights/briefing` — advisory JSON briefing. The
  deterministic fallback is returned when Ollama is unavailable or returns
  invalid JSON.

## Ollama configuration

Copy `server/.env.example` to the deployment environment and set:

```dotenv
OLLAMA_ENABLED=false
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=qwen3.5:2b
OLLAMA_TIMEOUT_MS=5000
```

The optional Compose service is in `infra/docker-compose.yml`. Enable it with
`OLLAMA_ENABLED=true docker compose --profile ai up -d` (PowerShell:
`$env:OLLAMA_ENABLED='true'; docker compose --profile ai up -d`). The service
is not required for forecasting or inventory safety. The model output is constrained to a small
JSON schema and is treated as untrusted text; only the validated summary is
returned.

If Ollama runs on another LAN host, use that host's private address, for
example `OLLAMA_BASE_URL=http://192.168.5.115:11434`, and set `OLLAMA_MODEL`
to a model installed there. The API container must be able to reach that
address; the browser never calls Ollama directly.
