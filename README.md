# Revive Frontend (Day 14)

React + Vite operations UI for the Revive receivables recovery engine.

## Run

1. Start backend (from Revive repo):

```bash
python run_api.py
```

2. Start frontend:

```bash
npm install
npm run dev
```

Open http://localhost:5173

API calls proxy to `http://127.0.0.1:8000` via Vite (`/api` → backend).

## Screens

| Route | Purpose |
|-------|---------|
| `/` | Dashboard — RAR, recovery, pipeline, P1 cases |
| `/cases` | Case list + search/filters |
| `/cases/:caseId` | Full pipeline detail |
| `/review` | Human review queue |
| `/audit` | Audit timeline |

No business logic in the UI — all values come from Day-13 FastAPI.
