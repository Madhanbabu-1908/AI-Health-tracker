# Nalamudan | நலமுடன் — AI Health Tracker

> **நலமுடன்** (Nalamudan) means *"With Good Health"* in Tamil.

A full-stack AI-powered health and nutrition tracker — React + Vite frontend, FastAPI backend, Groq AI engine, packaged as an Android APK via Capacitor.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Frontend](#frontend)
  - [App.jsx — Root & Navigation](#appjsx--root--navigation)
  - [AppContext.jsx — Theme State](#appcontextjsx--theme-state)
  - [api.js — API Service Layer](#apijs--api-service-layer)
  - [Dashboard.jsx — Today's Summary](#dashboardjsx--todays-summary)
  - [FoodLogger.jsx — Log Meals](#foodloggerjsx--log-meals)
  - [AddFood.jsx — Custom Food Database](#addfoodjsx--custom-food-database)
  - [HistoryChart.jsx — Progress Charts](#historycharyjsx--progress-charts)
  - [AIChat.jsx — AI Health Coach](#aichatjsx--ai-health-coach)
  - [Onboarding.jsx — First-run Setup](#onboardingjsx--first-run-setup)
  - [Settings.jsx — Profile & Preferences](#settingsjsx--profile--preferences)
  - [useToast.jsx — Toast Notifications](#usetoastjsx--toast-notifications)
- [Backend](#backend)
  - [main.py — FastAPI Application & Routes](#mainpy--fastapi-application--routes)
  - [models.py — Pydantic Data Models](#modelspy--pydantic-data-models)
  - [database.py — SQLite Persistence Layer](#databasepy--sqlite-persistence-layer)
  - [ai\_agent.py — Multi-model AI Engine](#ai_agentpy--multi-model-ai-engine)
  - [mcp\_tools.py — Nutrition Web Search Tools](#mcp_toolspy--nutrition-web-search-tools)
  - [goal\_calculator.py — Personalized Goal Engine](#goal_calculatorpy--personalized-goal-engine)
  - [food\_service.py — Open Food Facts Integration](#food_servicepy--open-food-facts-integration)
  - [orchestrator.py — Request Orchestration](#orchestratorpy--request-orchestration)
- [Configuration Files](#configuration-files)
  - [capacitor.config.json](#capacitorconfigjson)
  - [vite.config.js / vite.config.ts](#viteconfigjs--viteconfigts)
  - [backend/.env.example](#backendenvexample)
  - [backend/render.yaml](#backendrenderyaml)
- [GitHub Actions — CI/CD Build](#github-actions--cicd-build)
- [Setup & Running Locally](#setup--running-locally)
- [Environment Variables & Secrets](#environment-variables--secrets)
- [API Endpoints Reference](#api-endpoints-reference)

---

## Project Overview

Nalamudan is a mobile-first health tracker with:

- **Personalised nutrition goals** calculated from your height, weight, age, gender, activity level, and health goals (lose weight, gain muscle, lower cholesterol, etc.)
- **Food database** where you define your own food items with full macro and micronutrient data
- **AI nutrition lookup** — type any food name and Groq AI + Open Food Facts estimates protein, carbs, fat, calories, cholesterol, iron, fiber, and cost
- **Water tracking** with visual progress
- **History charts** showing 7–90-day trends across all nutrients
- **AI Chat Coach** powered by Llama 3.3 70B (via Groq) that answers personalised nutrition questions, knows your daily totals, and uses live web search context
- **Light / Dark / System theme** support
- **Android APK** compiled via Capacitor + GitHub Actions

---

## Architecture

```
AI-Health-tracker/
├── frontend/                    # React + Vite + Capacitor
│   ├── src/
│   │   ├── App.jsx              # Root component, routing, session boot
│   │   ├── main.jsx             # React DOM entry point
│   │   ├── components/          # Page-level UI components
│   │   ├── context/             # React context providers
│   │   ├── hooks/               # Custom React hooks
│   │   ├── services/            # API client
│   │   └── styles/              # Global CSS
│   ├── public/                  # Static assets, icons, splash screens
│   ├── capacitor.config.json    # Capacitor (Android) config
│   ├── vite.config.js           # Vite build config
│   └── package.json
│
├── backend/                     # FastAPI Python backend
│   ├── app/
│   │   ├── main.py              # FastAPI app, all HTTP routes
│   │   ├── models.py            # Pydantic schemas
│   │   ├── database.py          # SQLite via aiosqlite / sqlite3
│   │   ├── ai_agent.py          # Groq AI multi-model engine
│   │   ├── mcp_tools.py         # Web nutrition search tools
│   │   ├── goal_calculator.py   # BMR / TDEE / macro goal math
│   │   ├── food_service.py      # Open Food Facts API client
│   │   └── orchestrator.py      # Request flow coordinator
│   ├── data/                    # Persistent JSON / SQLite data files
│   ├── requirements.txt
│   └── render.yaml              # Render.com deployment config
│
└── .github/
    └── workflows/
        └── build-apk.yaml       # GitHub Actions APK build pipeline
```

**Data flow:**

```
User (React app)
  ↕ HTTP (fetch)
FastAPI backend (Render.com)
  ├── SQLite  — profiles, food items, food logs, water logs
  ├── Groq API — AI chat + nutrition prediction
  ├── Open Food Facts API — food database lookups
  └── DuckDuckGo / web scrape — MCP nutrition context
```

---

## Frontend

### App.jsx — Root & Navigation

**File:** `frontend/src/App.jsx`

The root component. It owns the entire app shell: session bootstrapping, routing between tabs, header, and the bottom navigation bar.

**What it does:**

- On mount, calls `profileApi.get()` and `profileApi.goals()` in parallel to check whether the user has already completed onboarding. If the profile is found, the main app is shown; if 404, the Onboarding flow is shown; if a network error, a "Can't reach server" retry screen is shown.
- Manages the active tab state (`dashboard`, `log`, `add`, `history`, `ai`, `settings`).
- Passes `sessionId`, `profile`, `goals`, and a `refreshKey` (incremented after any food action) down to child components via props.
- Renders a `BMIPill` sub-component in the header that colour-codes the user's BMI as Underweight / Normal / Overweight / Obese.
- Reads `appliedTheme` from `AppContext` and renders a sun/moon toggle button to switch themes.

**Key state:**
| State | Purpose |
|---|---|
| `tab` | Which page is currently shown |
| `profile` | User's profile object from backend |
| `goals` | Personalised nutrition goals from backend |
| `ready` | Whether initial data fetch is complete |
| `loggedIn` | Whether a profile exists for this session |
| `refreshKey` | Triggers child re-fetches after food log changes |
| `connErr` | Whether the backend is unreachable |

---

### AppContext.jsx — Theme State

**File:** `frontend/src/context/AppContext.jsx`

A React Context that manages light/dark/system theme preference across the entire app.

**What it does:**

- Reads saved theme preference from `localStorage` on first render (defaults to `'system'`).
- Listens to `window.matchMedia('(prefers-color-scheme: dark)')` when in system mode, automatically switching the applied theme when the OS setting changes.
- Sets `data-theme` attribute on `document.documentElement` to `'light'` or `'dark'`, which CSS variables in `App.css` use to switch the entire colour palette.
- Exposes `theme` (saved preference), `appliedTheme` (what's actually rendered), and `toggleTheme(t)` to any component via the `useApp()` hook.

---

### api.js — API Service Layer

**File:** `frontend/src/services/api.js`

All HTTP communication with the backend is centralised here. No component makes raw `fetch()` calls directly.

**Session management:**
- `getSessionId()` — reads or creates a UUID4 from `localStorage` and returns it. This session ID is the only "user identity" in the system — no login or password is required.
- `clearSession()` — removes the session UUID and any cached profile/goal data from `localStorage`.

**Core fetch wrapper — `api(path, options)`:**
- Prepends `VITE_API_URL` (set via environment variable at build time) to the path.
- Sends `Content-Type: application/json` header.
- Parses the JSON response and throws a descriptive error if the HTTP status is not OK.

**Exported API namespaces:**

| Namespace | Methods | Purpose |
|---|---|---|
| `profileApi` | `setup`, `get`, `goals`, `delete` | Profile creation and retrieval |
| `foodApi` | `list`, `add`, `remove` | Custom food item CRUD |
| `logApi` | `log`, `deleteEntry`, `today`, `history` | Food logging and history |
| `waterApi` | `log`, `today` | Water intake tracking |
| `aiApi` | `predict`, `predictServing`, `chat` | AI nutrition lookup and chat |

---

### Dashboard.jsx — Today's Summary

**File:** `frontend/src/components/Dashboard.jsx`

The main "home screen" — shows a complete snapshot of today's nutrition intake vs personalised goals.

**What it does:**

- Fetches `/log/{sessionId}/today` and `/water/{sessionId}/today` on mount and whenever `refreshKey` changes.
- Shows a horizontal row of animated SVG rings (`Ring` component) for the four primary macros: Calories, Protein, Carbs, and Fat. Each ring fills proportionally and shows a percentage number inside.
- Shows detailed progress bars (`StatRow` component) for each tracked nutrient: Calories, Protein, Carbs, Fat, Fiber, Cholesterol, and Iron. Each bar shows the current value, goal, remaining amount, and turns green with a ✓ check when the goal is reached.
- Shows a `WaterCard` with quick-add preset buttons (150 ml, 200 ml, 250 ml, 350 ml, 500 ml) plus a custom input. Logs water via `waterApi.log()` on button tap.
- Shows today's food log entries as a list at the bottom, each with a delete button that calls `logApi.deleteEntry()`.

---

### FoodLogger.jsx — Log Meals

**File:** `frontend/src/components/FoodLogger.jsx`

Lets users quickly log food items they've already added to their personal database.

**What it does:**

- Fetches the user's food item list via `foodApi.list()`.
- Displays each food item as a card showing its per-unit nutrition summary.
- Each card has a quantity stepper (increment/decrement) and a "Log" button.
- Tapping Log calls `logApi.log()` with the food item's ID and quantity, then calls `onLogged()` to trigger a dashboard refresh.
- Supports search/filter across the food list.

---

### AddFood.jsx — Custom Food Database

**File:** `frontend/src/components/AddFood.jsx`

The form for adding new food items to the user's personal food database, with optional AI-assisted nutrition lookup.

**What it does:**

- Presents a two-step workflow: first enter the food name and unit, then either fill in nutrition values manually or click "AI Lookup" to have Groq AI estimate the values automatically.
- AI Lookup calls `aiApi.predict()` (for gram-based units) or `aiApi.predictServing()` (for serving/cup/piece units), then pre-fills all nutrition fields with the returned estimates.
- All nutrition fields are fully editable after AI fill — users can correct any value before saving.
- On submit, calls `foodApi.add()` to persist the item, then calls `onFoodAdded()` to refresh the food list.
- Tracks confidence indicator returned by the AI so users know whether the estimate is high/medium/low confidence.

---

### HistoryChart.jsx — Progress Charts

**File:** `frontend/src/components/HistoryChart.jsx`

Interactive multi-nutrient history charts using the Recharts library.

**What it does:**

- Fetches history data via `logApi.history(sessionId, days)` where `days` can be 7, 14, 30, or 90.
- Renders a `LineChart` (from Recharts) for the selected nutrient, with the user's goal displayed as a `ReferenceLine`.
- A tab row lets users switch between charts for: Calories, Protein, Carbs, Fat, Fiber, Cholesterol, Iron, and Water.
- Shows a stats summary row below the chart (average, peak, days on target) computed client-side from the fetched history array.
- Handles empty state gracefully when there is no history for the selected range.

---

### AIChat.jsx — AI Health Coach

**File:** `frontend/src/components/AIChat.jsx`

A full chat interface connected to the Groq-powered AI backend, personalised with the user's profile and daily totals.

**What it does:**

- Displays a scrollable message list with user bubbles (right-aligned) and AI bubbles (left-aligned).
- A strip at the top shows the user's nickname, protein goal, calorie goal, and BMI as context chips.
- Eight "quick prompt" pill buttons let users ask common questions with one tap (e.g. "Am I on track today?", "High protein meal ideas?", "Analyse my week").
- Typing Enter (without Shift) sends the message immediately. Shift+Enter inserts a newline.
- During AI response loading, shows an animated `TypingDots` indicator.
- Each AI message shows a model tag (e.g. "✦ Llama 3.3 70B") and a "cached" badge if the response was served from the backend's response cache.
- Sends `sessionId`, `query`, and `context` to `aiApi.chat()`. The backend fills in the context with the user's profile, goals, and today's totals server-side.

---

### Onboarding.jsx — First-run Setup

**File:** `frontend/src/components/Onboarding.jsx`

The multi-step onboarding wizard shown to new users before they have a profile.

**What it does:**

- Step 1: Collects nickname, height, weight, age, and gender.
- Step 2: Asks for primary health goal (lose weight, gain muscle, maintain weight, improve endurance, lower cholesterol, increase iron) and activity level (sedentary → very active).
- Step 3: Optional secondary goals (multi-select).
- Step 4: Currency selection (₹, $, €, £, etc.) for food cost tracking.
- On final submit, calls `profileApi.setup()` which creates the profile AND calculates all personalised nutrition goals server-side. Returns the profile and goals to App.jsx via `onComplete(profile, goals)`.
- Shows a BMI preview in real time as the user enters height and weight.

---

### Settings.jsx — Profile & Preferences

**File:** `frontend/src/components/Settings.jsx`

Profile viewer and account management page.

**What it does:**

- Displays the current profile (name, height, weight, BMI, goal, activity level) and all personalised nutrition targets in a readable format.
- Provides a "Reset / Delete Account" button that calls `profileApi.delete()` to wipe all backend data for this session and then calls `onReset()` in App.jsx to return to the Onboarding screen.
- Shows the current session ID for debugging purposes.

---

### useToast.jsx — Toast Notifications

**File:** `frontend/src/hooks/useToast.jsx`

A lightweight custom hook for showing temporary toast notification messages.

**What it does:**

- Returns a `showToast(message, type)` function and a `ToastContainer` component.
- Toasts auto-dismiss after 3 seconds.
- Type can be `'success'`, `'error'`, or `'info'`, mapped to different colours in CSS.

---

## Backend

### main.py — FastAPI Application & Routes

**File:** `backend/app/main.py`

The entry point for the entire backend. Defines all HTTP API routes using FastAPI.

**Setup:**
- Creates the FastAPI app with CORS middleware set to `allow_origins=["*"]` so any frontend origin (web browser, Android WebView) can call it.
- Runs `db.init_db()` on startup to create SQLite tables if they don't exist.

**Route groups:**

| Route | Method | Description |
|---|---|---|
| `/` | GET | Health check / app info |
| `/health` | GET | Liveness check with timestamp |
| `/profile/setup` | POST | Create profile + auto-calculate nutrition goals |
| `/profile/{session_id}` | GET | Retrieve profile |
| `/goals/{session_id}` | GET | Retrieve nutrition goals |
| `/session/{session_id}` | DELETE | Delete all user data |
| `/foods/{session_id}` | GET | List food items |
| `/foods/{session_id}` | POST | Add food item |
| `/foods/{session_id}/{food_id}` | DELETE | Delete food item |
| `/log/{session_id}` | POST | Log food entry (food_id + quantity) |
| `/log/{session_id}/{entry_id}` | DELETE | Delete log entry |
| `/log/{session_id}/today` | GET | Today's totals + goal percentages + entries |
| `/log/{session_id}/history` | GET | N-day history (1–90 days) |
| `/water/{session_id}` | POST | Log water intake (ml) |
| `/water/{session_id}/today` | GET | Today's water total |
| `/ai/nutrition` | GET | AI nutrition lookup by food name + grams |
| `/ai/nutrition/serving` | GET | AI nutrition lookup by serving size |
| `/ai/chat` | POST | AI health coach chat |

**Profile setup logic:**
When `/profile/setup` is called, the backend computes BMI (`weight / (height_m)²`), categorises it, creates the `UserProfile` record, then immediately calls `calculate_all_goals()` to generate personalised nutrition targets — all in a single request.

---

### models.py — Pydantic Data Models

**File:** `backend/app/models.py`

All data shapes used across the backend are defined here as Pydantic `BaseModel` classes.

**Enums:**
- `HealthGoal` — `lose_weight`, `maintain_weight`, `gain_muscle`, `improve_endurance`, `lower_cholesterol`, `increase_iron`
- `ActivityLevel` — `sedentary`, `light`, `moderate`, `active`, `very_active`
- `Gender` — `male`, `female`, `other`

**Key models:**

| Model | Purpose |
|---|---|
| `UserProfile` | Stored user profile with BMI, goals, activity |
| `ProfileSetupRequest` | Incoming body for `/profile/setup` |
| `PersonalizedNutritionGoals` | All calculated goals (protein, calories, carbs, fat, fiber, cholesterol, iron, calcium, vitamin D, water) |
| `FoodItem` | A food item in the user's database (per-unit macros + cost) |
| `FoodEntry` | A logged meal (calculated from FoodItem × quantity) |
| `WaterLog` | A water intake event |
| `ChatRequest` | Body for `/ai/chat` |
| `NutritionPrediction` | AI-returned nutrition estimate with confidence |

---

### database.py — SQLite Persistence Layer

**File:** `backend/app/database.py`

All read/write operations against the SQLite database.

**What it does:**

- `init_db()` creates four tables if they don't exist: `profiles`, `nutrition_goals`, `food_items`, `food_entries`, `water_logs`.
- Each table uses `session_id` as the primary partition key — there is no user account system; all data belongs to a session.
- Food entries store the fully computed nutrition values (protein g, carbs g, fat g, etc.) at log time, so changing a food item later does not retroactively alter logged history.
- `get_today_totals(session_id)` aggregates today's `food_entries` rows with `SUM()` grouped by date — efficient even for large logs.
- `get_history(session_id, days)` returns a per-day aggregate array for chart rendering.
- Water is tracked in a separate `water_logs` table and merged with food history in the API route.

---

### ai_agent.py — Multi-model AI Engine

**File:** `backend/app/ai_agent.py`

The heart of the AI features. Uses the Groq SDK to call large language models with automatic fallback.

**Model cascade:**

| Priority | Model | Max Tokens |
|---|---|---|
| 1 (primary) | `llama-3.3-70b-versatile` | 32,768 |
| 2 (fallback) | `llama-3.1-8b-instant` | 8,192 |
| 3 (last resort) | `gemma2-9b-it` | 8,192 |

If the primary model hits a rate limit or errors, the agent automatically retries with the next model in the list.

**Key methods:**

- `predict_nutrition(food_name, quantity_g)` — Builds a system prompt instructing the model to return strict JSON with protein, carbs, fat, cholesterol, iron, fiber, calories, and confidence. First checks the `food_service` (Open Food Facts) for a real database match; if not found, falls back to AI estimation. Results are cached in `ai_cache.json` using an MD5 hash of the query.
- `predict_nutrition_with_serving(food_name, quantity, unit)` — First calls a "serving resolver" prompt to determine the gram weight of one serving, cup, piece, etc., then uses that weight to calculate final nutrition.
- `chat(query, context)` — Builds a rich system prompt including the user's profile, today's intake totals, nutrition goals, and water. Then appends the user's query. Uses `mcp_tools` to fetch live web context (e.g. "iron-rich foods") before answering when relevant. Detects and blocks prompt injection attempts using a regex pattern list.
- **Response caching:** Chat responses are cached by a hash of `(query + context_summary)` to avoid duplicate API calls for identical questions within the same session.

**Security:** Incoming queries are checked against a regex for common prompt-injection patterns (`"ignore previous instructions"`, `"you are now"`, etc.) and blocked before reaching the AI.

---

### mcp_tools.py — Nutrition Web Search Tools

**File:** `backend/app/mcp_tools.py`

Web-based nutrition data retrieval tools used by the AI agent to augment its responses with live data.

**What it does:**

- `get_nutrition_from_web(food_name)` — Searches DuckDuckGo for `"{food_name} nutrition facts per 100g"` and scrapes the top results using BeautifulSoup to extract nutrition numbers from structured data or plain text.
- `search_health_info(query)` — Searches for general health/nutrition information (e.g. "best foods to lower cholesterol") and returns a summarised text context.
- `get_nutrition_with_serving(food_name, unit)` — Looks up typical serving sizes for a food to help the AI resolve "1 cup of rice" or "2 pieces of idli" into gram weights.

These tools act like MCP (Model Context Protocol) tools — they are called by the AI agent to fetch real-world context before composing a response, so answers are grounded in current information rather than just training data.

---

### goal_calculator.py — Personalised Goal Engine

**File:** `backend/app/goal_calculator.py`

Calculates all nutrition targets from the user's physical data and health goals using standard formulas.

**What it does:**

- **BMR (Basal Metabolic Rate)** — Uses the Mifflin-St Jeor equation:
  - Male: `(10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5`
  - Female: `(10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161`
- **TDEE (Total Daily Energy Expenditure)** — Multiplies BMR by an activity factor (1.2 for sedentary → 1.9 for very active).
- **Calorie goal** — Adjusted from TDEE based on primary goal: −500 kcal/day for weight loss, +300 kcal/day for muscle gain, no adjustment for maintenance.
- **Protein goal** — Scaled by activity and goal: 1.2–2.2 g/kg body weight.
- **Carb and fat goals** — Derived from the remaining calories after protein is allocated, split 50/30 carb/fat for most goals, or shifted for endurance training.
- **Micronutrient goals** — Iron, fiber, cholesterol, calcium, vitamin D, and water targets are set based on gender, age, and specific health goals (e.g. higher iron target if `increase_iron` is selected, lower cholesterol limit if `lower_cholesterol` is selected).
- Generates a human-readable `explanation` string summarising why each goal was set the way it was, which is shown to the user after onboarding.

---

### food_service.py — Open Food Facts Integration

**File:** `backend/app/food_service.py`

Queries the Open Food Facts open database before falling back to AI estimation.

**What it does:**

- Calls `https://world.openfoodfacts.org/cgi/search.pl` with the food name as a search term and requests JSON results.
- Parses the `nutriments` field from the first matching product for `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`, `cholesterol_100g`, and `iron_100g`.
- Returns a structured dict if a good match is found, or `None` if no product matches — triggering the AI fallback in `ai_agent.py`.
- Results are used directly for well-known packaged products and branded foods where Open Food Facts has accurate data.

---

### orchestrator.py — Request Orchestration

**File:** `backend/app/orchestrator.py`

Coordinates complex multi-step AI requests that require chaining together tool calls.

**What it does:**

- For chat requests that require web context, the orchestrator calls the relevant `mcp_tools` functions first, then injects the results into the AI prompt as additional context.
- Manages retry logic across the model cascade.
- Handles timeout and partial-failure cases — if a web search tool fails, the AI still responds using its training knowledge, with a note that live data was unavailable.

---

## Configuration Files

### capacitor.config.json

**File:** `frontend/capacitor.config.json`

Configures Capacitor, which wraps the React Vite web app in a native Android WebView.

```json
{
  "appId": "com.nalamudan.healthtracker",
  "appName": "Nalamudan",
  "webDir": "dist",
  "server": {
    "androidScheme": "https"
  }
}
```

- `appId` — Unique Android package name. Used in the Play Store and as the APK identifier.
- `webDir` — Points to Vite's output folder (`dist/`). Capacitor copies these files into the Android WebView assets.
- `androidScheme: "https"` — Forces the WebView to use `https://` URLs internally, which is required for `localStorage` and `crypto.randomUUID()` to work in modern Android WebViews.

---

### vite.config.js / vite.config.ts

**File:** `frontend/vite.config.js` and `frontend/vite.config.ts`

Vite build configuration. Both files exist; the `.js` version is the active one used by Capacitor.

- Uses `@vitejs/plugin-react` for JSX/React Fast Refresh.
- Sets `build.minify: 'terser'` for production APK builds (smaller bundle size).
- Configures `server.proxy` so `npm run dev` proxies `/api` requests to the local backend, avoiding CORS issues in development.

---

### backend/.env.example

**File:** `backend/.env.example`

Documents the required environment variables for running the backend:

```
GROQ_API_KEY=your_groq_api_key_here
```

The Groq API key is the only required secret. Get one free at [console.groq.com](https://console.groq.com).

---

### backend/render.yaml

**File:** `backend/render.yaml`

Declarative deployment config for [Render.com](https://render.com) (the free-tier hosting used for the backend).

- Defines a `web` service with `startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Sets `plan: free` — note that free-tier Render services spin down after 15 minutes of inactivity, which causes a ~30-second cold start on the first request.

---

## GitHub Actions — CI/CD Build

**File:** `.github/workflows/build-apk.yaml`

Automatically builds and releases an Android APK on every push to `main` that touches the `frontend/` directory.

**Workflow steps:**

| Step | What it does |
|---|---|
| Checkout | Clones the repo |
| Setup Node.js 20 | Installs Node (no npm cache — see note below) |
| Setup Java 17 | Required for Gradle / Android build tools |
| Setup Android SDK | Installs the Android SDK via `android-actions/setup-android` |
| Install Android platform tools | Installs `platforms;android-34` and `build-tools;34.0.0` via `sdkmanager` |
| Install frontend dependencies | Runs `npm install` in `frontend/` |
| Build React Vite app | Runs `npm run build` with `VITE_API_URL` injected |
| Setup Capacitor Android project | Initialises Capacitor and adds the Android platform |
| Sync Capacitor assets | Copies the Vite `dist/` output into the Android project |
| Install icons | Copies mipmap icon PNGs into Android resource folders |
| Install splash screen | Copies splash PNG into `res/drawable/` |
| Write Android resource files | Generates `strings.xml`, `colors.xml`, `styles.xml`, `network_security_config.xml` via Python |
| Write AndroidManifest.xml | Generates the Android manifest with correct permissions and activity config |
| Write file_paths.xml + MainActivity.java | Generates the Java activity class and FileProvider config |
| Configure Gradle | Writes `local.properties` (SDK path) and performance flags to `gradle.properties` |
| Build debug APK | Runs `./gradlew assembleDebug` |
| Rename APK | Stamps the APK with the build date |
| Upload APK artifact | Uploads to GitHub Actions artifacts (retained 30 days) |
| Create GitHub Release | Tags a release and attaches the APK (only on push to `main`) |

> **Note on the npm cache error:** The `cache: 'npm'` option in `actions/setup-node` requires a `package-lock.json` to exist before the step runs. This project does not commit `package-lock.json`, which caused the error: `"Some specified paths were not resolved, unable to cache dependencies."` The fix is to remove the `cache` and `cache-dependency-path` options from the `setup-node` step and use plain `npm install` instead.

---

## Setup & Running Locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
uvicorn app.main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive Swagger UI.

### Frontend

```bash
cd frontend
npm install
# For local development pointing at local backend:
VITE_API_URL=http://localhost:8000 npm run dev
```

Frontend dev server runs at `http://localhost:5173`.

### Building the Android APK locally

```bash
cd frontend
npm run build
npx cap add android       # first time only
npx cap sync android
npx cap open android      # opens Android Studio
```

Then in Android Studio: Build → Build Bundle(s) / APK(s) → Build APK(s).

---

## Environment Variables & Secrets

| Variable | Where | Description |
|---|---|---|
| `GROQ_API_KEY` | Backend `.env` | Your Groq API key for LLM calls |
| `VITE_API_URL` | Frontend build / GitHub Secret | Backend URL injected at Vite build time |
| `GITHUB_TOKEN` | Auto-provided | Used by `softprops/action-gh-release` to publish releases |

Set `VITE_API_URL` as a **GitHub Actions Secret** (repo Settings → Secrets and variables → Actions → New repository secret) so the APK always points to the correct backend.

---

## API Endpoints Reference

All endpoints are session-scoped. Replace `{session_id}` with the UUID generated by `getSessionId()` in `api.js`.

```
GET    /                              → App info
GET    /health                        → Liveness check

POST   /profile/setup                 → Create profile + calculate goals
GET    /profile/{session_id}          → Get profile
GET    /goals/{session_id}            → Get nutrition goals
DELETE /session/{session_id}          → Delete all session data

GET    /foods/{session_id}            → List food items
POST   /foods/{session_id}            → Add food item
DELETE /foods/{session_id}/{food_id}  → Delete food item

POST   /log/{session_id}              → Log a meal (food_id + quantity)
DELETE /log/{session_id}/{entry_id}   → Delete a log entry
GET    /log/{session_id}/today        → Today's totals + percentages + entries
GET    /log/{session_id}/history      → N-day history (?days=7)

POST   /water/{session_id}            → Log water (amount_ml)
GET    /water/{session_id}/today      → Today's water total

GET    /ai/nutrition                  → AI nutrition by name+grams
GET    /ai/nutrition/serving          → AI nutrition by serving size
POST   /ai/chat                       → AI health coach chat
```

---

*Built with ❤️ and நலமுடன் — With Good Health.*
