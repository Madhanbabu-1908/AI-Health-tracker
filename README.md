# 🏋️ Health+Wealth Tracker

AI-powered personal health & nutrition tracker with wealth (food cost) tracking.
Built with React + FastAPI + Groq + DuckDuckGo MCP.

---

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite + Recharts |
| Mobile   | Capacitor 6 (Android APK) |
| Backend  | FastAPI + SQLite |
| AI       | Groq (3-model fallback) |
| Search   | DuckDuckGo MCP |
| Hosting  | Render.com (backend) |
| CI/CD    | GitHub Actions (APK build) |

---

## AI Models (priority order)

| Priority | Model | Purpose |
|----------|-------|---------|
| 1 | `llama-3.3-70b-versatile` | Primary — high-quality coaching |
| 2 | `llama-3.1-8b-instant` | Secondary — fast fallback |
| 3 | `gemma2-9b-it` | Tertiary — last resort |

---

## Quick Start

### Backend (Render.com)

1. Push `backend/` to your repo
2. Create a new **Web Service** on Render pointing to `backend/`
3. Set build command: `pip install -r requirements.txt`
4. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variable: `GROQ_API_KEY=your_key`
6. Add a **Disk** named `health-data` mounted at `/opt/render/project/src/data`

### Frontend (local dev)

```bash
cd frontend
npm install
cp ../.env.example .env         # edit VITE_API_URL
npm run dev
```

### Build APK

**Option A — GitHub Actions (recommended)**
1. Push to `main` branch
2. Go to Actions → Build Android APK
3. Download the APK from Artifacts

**Option B — Local**
```bash
cd frontend
npm install
npm run build
npx cap sync android
# open android/ in Android Studio and build
```

---

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `VITE_API_URL` | `https://your-backend.onrender.com` (optional, has default) |

---

## Features

- **Onboarding** — 4-step setup, auto-calculates all nutrition goals via BMR/TDEE
- **Dashboard** — hero protein tracker, SVG rings, macro rows, water widget, cost card
- **Log Meal** — search food database, quantity stepper, delete entries
- **Add Food** — AI auto-fill via DuckDuckGo + Groq, manual edit, cost tracking
- **History** — bar/line charts, 7/14/21/30 day ranges, 9 metrics, goal reference lines
- **AI Coach** — multi-model Groq chat with context injection, quick prompts, model badge
- **Settings** — profile info, goals summary, dark/light/system theme, full data reset
- **Water** — quick-log buttons (150/200/250/350/500ml), visual fill indicator
- **Wealth** — today's food spend, 7-day total, daily average

---

## Session Model

No login required. A UUID session ID is generated and stored in `localStorage`.
Clearing browser/app data resets the session. All data is isolated per session on the backend via SQLite cascade deletes.

---

## Environment Variables

### Backend `.env`
```
GROQ_API_KEY=gsk_...
DB_PATH=data/health_tracker.db
PORT=8000
```

### Frontend `.env`
```
VITE_API_URL=https://your-backend.onrender.com
```
