import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from .models import (
    UserProfile, FoodItem, FoodEntry, WaterLog,
    PersonalizedNutritionGoals,
    HealthMetric, SleepSession, Workout, HealthSyncState
)

DB_PATH = os.getenv("DB_PATH", "data/health_tracker.db")


def get_conn() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create all tables on startup."""
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS profiles (
            session_id     TEXT PRIMARY KEY,
            nickname       TEXT NOT NULL,
            height         REAL NOT NULL,
            weight         REAL NOT NULL,
            bmi            REAL,
            age            INTEGER,
            gender         TEXT,
            primary_goal   TEXT,
            activity_level TEXT,
            currency       TEXT DEFAULT '₹',
            created_at     TEXT,
            updated_at     TEXT
        );

        CREATE TABLE IF NOT EXISTS nutrition_goals (
            session_id        TEXT PRIMARY KEY,
            protein_goal      REAL,
            calorie_goal      REAL,
            carb_goal         REAL,
            fat_goal          REAL,
            fiber_goal        REAL,
            cholesterol_limit REAL,
            iron_goal         REAL,
            calcium_goal      REAL,
            vitamin_d_goal    REAL,
            water_goal        REAL,
            explanation       TEXT,
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS food_items (
            id                   TEXT,
            session_id           TEXT,
            name                 TEXT NOT NULL,
            protein_per_unit     REAL DEFAULT 0,
            carbs_per_unit       REAL DEFAULT 0,
            fat_per_unit         REAL DEFAULT 0,
            cholesterol_per_unit REAL DEFAULT 0,
            iron_per_unit        REAL DEFAULT 0,
            fiber_per_unit       REAL DEFAULT 0,
            calories_per_unit    REAL DEFAULT 0,
            cost_per_unit        REAL DEFAULT 0,
            default_unit         TEXT DEFAULT 'serving',
            usage_count          INTEGER DEFAULT 0,
            created_at           TEXT,
            PRIMARY KEY (id, session_id),
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS food_entries (
            id          TEXT,
            session_id  TEXT,
            name        TEXT,
            protein     REAL DEFAULT 0,
            carbs       REAL DEFAULT 0,
            fat         REAL DEFAULT 0,
            cholesterol REAL DEFAULT 0,
            iron        REAL DEFAULT 0,
            fiber       REAL DEFAULT 0,
            calories    REAL DEFAULT 0,
            cost        REAL DEFAULT 0,
            quantity    REAL DEFAULT 1,
            unit        TEXT,
            logged_at   TEXT,
            PRIMARY KEY (id, session_id),
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS water_logs (
            id         TEXT,
            session_id TEXT,
            amount_ml  REAL,
            logged_at  TEXT,
            PRIMARY KEY (id, session_id),
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS ai_cache (
            query_hash TEXT PRIMARY KEY,
            query      TEXT,
            response   TEXT,
            cached_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS health_metrics (
            id          TEXT PRIMARY KEY,
            session_id  TEXT NOT NULL,
            provider    TEXT NOT NULL,
            source      TEXT,
            device      TEXT,
            metric_type TEXT NOT NULL,
            value       REAL,
            unit        TEXT,
            start_time  TEXT NOT NULL,
            end_time    TEXT,
            source_id   TEXT,
            metadata    TEXT,
            created_at  TEXT,
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_hm_session_type_time
            ON health_metrics(session_id, metric_type, start_time);
        CREATE INDEX IF NOT EXISTS idx_hm_source_id
            ON health_metrics(session_id, source_id);

        CREATE TABLE IF NOT EXISTS sleep_sessions (
            id                   TEXT PRIMARY KEY,
            session_id           TEXT NOT NULL,
            provider             TEXT NOT NULL,
            source               TEXT,
            device               TEXT,
            start_time           TEXT NOT NULL,
            end_time             TEXT NOT NULL,
            duration_minutes     REAL,
            awake_minutes        REAL,
            light_sleep_minutes  REAL,
            deep_sleep_minutes   REAL,
            rem_sleep_minutes    REAL,
            source_id            TEXT,
            created_at           TEXT,
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sleep_session_time
            ON sleep_sessions(session_id, start_time);
        CREATE INDEX IF NOT EXISTS idx_sleep_source_id
            ON sleep_sessions(session_id, source_id);

        CREATE TABLE IF NOT EXISTS workouts (
            id               TEXT PRIMARY KEY,
            session_id       TEXT NOT NULL,
            provider         TEXT NOT NULL,
            source           TEXT,
            device           TEXT,
            exercise_type    TEXT,
            start_time       TEXT NOT NULL,
            end_time         TEXT NOT NULL,
            duration_minutes REAL,
            active_calories  REAL,
            distance_km      REAL,
            avg_heart_rate   REAL,
            source_id        TEXT,
            created_at       TEXT,
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_workout_session_time
            ON workouts(session_id, start_time);

        CREATE TABLE IF NOT EXISTS health_sync_state (
            session_id          TEXT NOT NULL,
            provider            TEXT NOT NULL,
            last_sync_at        TEXT,
            last_sync_status    TEXT DEFAULT 'never',
            permissions_granted TEXT,
            PRIMARY KEY (session_id, provider),
            FOREIGN KEY (session_id) REFERENCES profiles(session_id) ON DELETE CASCADE
        );
        """)


# ─── Profile ─────────────────────────────────────────────────────────────────

def save_profile(profile: UserProfile):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO profiles VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(session_id) DO UPDATE SET
                nickname=excluded.nickname, height=excluded.height,
                weight=excluded.weight, bmi=excluded.bmi, age=excluded.age,
                gender=excluded.gender, primary_goal=excluded.primary_goal,
                activity_level=excluded.activity_level, currency=excluded.currency,
                updated_at=excluded.updated_at
        """, (
            profile.session_id, profile.nickname, profile.height,
            profile.weight, profile.bmi, profile.age, profile.gender,
            profile.primary_goal, profile.activity_level, profile.currency,
            profile.created_at, profile.updated_at
        ))


def get_profile_by_nickname(nickname: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE LOWER(nickname)=LOWER(?) ORDER BY updated_at DESC LIMIT 1",
            (nickname,)
        ).fetchone()
    return dict(row) if row else None


def get_profile(session_id: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM profiles WHERE session_id=?", (session_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_session(session_id: str):
    """Cascades to all related tables."""
    with get_conn() as conn:
        conn.execute("DELETE FROM profiles WHERE session_id=?", (session_id,))


# ─── Nutrition Goals ──────────────────────────────────────────────────────────

def save_nutrition_goals(goals: PersonalizedNutritionGoals):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO nutrition_goals VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(session_id) DO UPDATE SET
                protein_goal=excluded.protein_goal,
                calorie_goal=excluded.calorie_goal,
                carb_goal=excluded.carb_goal,
                fat_goal=excluded.fat_goal,
                fiber_goal=excluded.fiber_goal,
                cholesterol_limit=excluded.cholesterol_limit,
                iron_goal=excluded.iron_goal,
                calcium_goal=excluded.calcium_goal,
                vitamin_d_goal=excluded.vitamin_d_goal,
                water_goal=excluded.water_goal,
                explanation=excluded.explanation
        """, (
            goals.session_id, goals.protein_goal, goals.calorie_goal,
            goals.carb_goal, goals.fat_goal, goals.fiber_goal,
            goals.cholesterol_limit, goals.iron_goal, goals.calcium_goal,
            goals.vitamin_d_goal, goals.water_goal, goals.explanation
        ))


def get_nutrition_goals(session_id: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM nutrition_goals WHERE session_id=?", (session_id,)
        ).fetchone()
    return dict(row) if row else None


# ─── Food Items ───────────────────────────────────────────────────────────────

def add_food_item(item: FoodItem):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO food_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id, session_id) DO UPDATE SET
                name=excluded.name,
                protein_per_unit=excluded.protein_per_unit,
                carbs_per_unit=excluded.carbs_per_unit,
                fat_per_unit=excluded.fat_per_unit,
                cholesterol_per_unit=excluded.cholesterol_per_unit,
                iron_per_unit=excluded.iron_per_unit,
                fiber_per_unit=excluded.fiber_per_unit,
                calories_per_unit=excluded.calories_per_unit,
                cost_per_unit=excluded.cost_per_unit,
                default_unit=excluded.default_unit
        """, (
            item.id, item.session_id, item.name,
            item.protein_per_unit, item.carbs_per_unit, item.fat_per_unit,
            item.cholesterol_per_unit, item.iron_per_unit, item.fiber_per_unit,
            item.calories_per_unit, item.cost_per_unit,
            item.default_unit, item.usage_count, item.created_at
        ))


def get_food_items(session_id: str) -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM food_items WHERE session_id=? ORDER BY usage_count DESC, name ASC",
            (session_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def get_food_item_by_name(session_id: str, name: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM food_items WHERE session_id=? AND LOWER(name)=LOWER(?)",
            (session_id, name)
        ).fetchone()
    return dict(row) if row else None


def get_food_item_by_id(session_id: str, food_id: str) -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM food_items WHERE session_id=? AND id=?",
            (session_id, food_id)
        ).fetchone()
    return dict(row) if row else None


def increment_food_usage(session_id: str, food_id: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE food_items SET usage_count = usage_count + 1 WHERE session_id=? AND id=?",
            (session_id, food_id)
        )

def delete_food_item(session_id: str, food_id: str):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM food_items WHERE session_id=? AND id=?",
            (session_id, food_id)
        )


# ─── Food Entries ─────────────────────────────────────────────────────────────

def add_food_entry(entry: FoodEntry):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO food_entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            entry.id, entry.session_id, entry.name,
            entry.protein, entry.carbs, entry.fat,
            entry.cholesterol, entry.iron, entry.fiber,
            entry.calories, entry.cost,
            entry.quantity, entry.unit, entry.logged_at
        ))
    # Also bump usage count
    item = get_food_item_by_name(entry.session_id, entry.name)
    if item:
        increment_food_usage(entry.session_id, item["id"])


def delete_food_entry(session_id: str, entry_id: str):
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM food_entries WHERE session_id=? AND id=?",
            (session_id, entry_id)
        )


def get_entries_for_date(session_id: str, date_str: str) -> List[Dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM food_entries WHERE session_id=? AND DATE(logged_at)=? ORDER BY logged_at DESC",
            (session_id, date_str)
        ).fetchall()
    return [dict(r) for r in rows]


def get_today_totals(session_id: str) -> Dict:
    today = datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        row = conn.execute("""
            SELECT
                COALESCE(SUM(protein),0)     AS protein,
                COALESCE(SUM(carbs),0)       AS carbs,
                COALESCE(SUM(fat),0)         AS fat,
                COALESCE(SUM(cholesterol),0) AS cholesterol,
                COALESCE(SUM(iron),0)        AS iron,
                COALESCE(SUM(fiber),0)       AS fiber,
                COALESCE(SUM(calories),0)    AS calories,
                COALESCE(SUM(cost),0)        AS cost
            FROM food_entries
            WHERE session_id=? AND DATE(logged_at)=?
        """, (session_id, today)).fetchone()
    return dict(row) if row else {
        "protein":0,"carbs":0,"fat":0,"cholesterol":0,
        "iron":0,"fiber":0,"calories":0,"cost":0
    }


def get_history(session_id: str, days: int = 7) -> List[Dict]:
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT
                DATE(logged_at) AS date,
                COALESCE(SUM(protein),0)     AS protein,
                COALESCE(SUM(carbs),0)       AS carbs,
                COALESCE(SUM(fat),0)         AS fat,
                COALESCE(SUM(cholesterol),0) AS cholesterol,
                COALESCE(SUM(iron),0)        AS iron,
                COALESCE(SUM(fiber),0)       AS fiber,
                COALESCE(SUM(calories),0)    AS calories,
                COALESCE(SUM(cost),0)        AS cost
            FROM food_entries
            WHERE session_id=? AND DATE(logged_at) >= ?
            GROUP BY DATE(logged_at)
            ORDER BY date ASC
        """, (session_id, start)).fetchall()
    return [dict(r) for r in rows]


# ─── Water Logs ───────────────────────────────────────────────────────────────

def add_water_log(log: WaterLog):
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO water_logs VALUES (?,?,?,?)",
            (log.id, log.session_id, log.amount_ml, log.logged_at)
        )


def get_today_water_ml(session_id: str) -> float:
    today = datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        row = conn.execute("""
            SELECT COALESCE(SUM(amount_ml),0) AS total
            FROM water_logs
            WHERE session_id=? AND DATE(logged_at)=?
        """, (session_id, today)).fetchone()
    return row["total"] if row else 0.0


def get_water_history(session_id: str, days: int = 7) -> List[Dict]:
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT DATE(logged_at) AS date, COALESCE(SUM(amount_ml),0) AS total_ml
            FROM water_logs
            WHERE session_id=? AND DATE(logged_at) >= ?
            GROUP BY DATE(logged_at)
            ORDER BY date ASC
        """, (session_id, start)).fetchall()
    return [dict(r) for r in rows]


# ─── AI Cache ────────────────────────────────────────────────────────────────

def get_cached_response(query_hash: str) -> Optional[str]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT response FROM ai_cache WHERE query_hash=?", (query_hash,)
        ).fetchone()
    return row["response"] if row else None


def cache_response(query_hash: str, query: str, response: str):
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO ai_cache VALUES (?,?,?,?)
            ON CONFLICT(query_hash) DO UPDATE SET response=excluded.response, cached_at=excluded.cached_at
        """, (query_hash, query, response, datetime.now().isoformat()))
        # Prune to latest 1000 entries
        conn.execute("""
            DELETE FROM ai_cache WHERE query_hash NOT IN (
                SELECT query_hash FROM ai_cache ORDER BY cached_at DESC LIMIT 1000
            )
        """)


# ─── Fuzzy food search ───────────────────────────────────────────────────────

def search_food_items(session_id: str, query: str) -> list:
    """Search food items by partial name match (case-insensitive)."""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT * FROM food_items
               WHERE session_id=? AND LOWER(name) LIKE LOWER(?)
               ORDER BY usage_count DESC, name ASC
               LIMIT 20""",
            (session_id, f"%{query}%")
        ).fetchall()
    return [dict(r) for r in rows]


# ─── Health Metrics ───────────────────────────────────────────────────────────

def upsert_health_metric(session_id: str, metric: dict) -> bool:
    """Insert metric; skip if source_id already exists (idempotent). Returns True if inserted."""
    now = datetime.now().isoformat()
    source_id = metric.get("source_id")

    with get_conn() as conn:
        # Deduplication: if source_id exists for this session, skip
        if source_id:
            exists = conn.execute(
                "SELECT 1 FROM health_metrics WHERE session_id=? AND source_id=?",
                (session_id, source_id)
            ).fetchone()
            if exists:
                return False

        import uuid as _uuid
        row_id = str(_uuid.uuid4())
        conn.execute("""
            INSERT INTO health_metrics
                (id, session_id, provider, source, device, metric_type,
                 value, unit, start_time, end_time, source_id, metadata, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            row_id, session_id,
            metric.get("provider", "health_connect"),
            metric.get("source"), metric.get("device"),
            metric["metric_type"],
            metric.get("value"), metric.get("unit"),
            metric["start_time"], metric.get("end_time"),
            source_id,
            json.dumps(metric.get("metadata")) if metric.get("metadata") else None,
            now
        ))
    return True


def upsert_sleep_session(session_id: str, sleep: dict) -> bool:
    """Insert sleep session; skip if source_id already exists."""
    now = datetime.now().isoformat()
    source_id = sleep.get("source_id")

    with get_conn() as conn:
        if source_id:
            exists = conn.execute(
                "SELECT 1 FROM sleep_sessions WHERE session_id=? AND source_id=?",
                (session_id, source_id)
            ).fetchone()
            if exists:
                return False

        import uuid as _uuid
        row_id = str(_uuid.uuid4())
        conn.execute("""
            INSERT INTO sleep_sessions
                (id, session_id, provider, source, device, start_time, end_time,
                 duration_minutes, awake_minutes, light_sleep_minutes,
                 deep_sleep_minutes, rem_sleep_minutes, source_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            row_id, session_id,
            sleep.get("provider", "health_connect"),
            sleep.get("source"), sleep.get("device"),
            sleep["start_time"], sleep["end_time"],
            sleep.get("duration_minutes"), sleep.get("awake_minutes"),
            sleep.get("light_sleep_minutes"), sleep.get("deep_sleep_minutes"),
            sleep.get("rem_sleep_minutes"), source_id, now
        ))
    return True


def upsert_workout(session_id: str, workout: dict) -> bool:
    """Insert workout; skip if source_id already exists."""
    now = datetime.now().isoformat()
    source_id = workout.get("source_id")

    with get_conn() as conn:
        if source_id:
            exists = conn.execute(
                "SELECT 1 FROM workouts WHERE session_id=? AND source_id=?",
                (session_id, source_id)
            ).fetchone()
            if exists:
                return False

        import uuid as _uuid
        row_id = str(_uuid.uuid4())
        conn.execute("""
            INSERT INTO workouts
                (id, session_id, provider, source, device, exercise_type,
                 start_time, end_time, duration_minutes, active_calories,
                 distance_km, avg_heart_rate, source_id, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            row_id, session_id,
            workout.get("provider", "health_connect"),
            workout.get("source"), workout.get("device"),
            workout.get("exercise_type"),
            workout["start_time"], workout["end_time"],
            workout.get("duration_minutes"), workout.get("active_calories"),
            workout.get("distance_km"), workout.get("avg_heart_rate"),
            source_id, now
        ))
    return True


def get_health_metrics(session_id: str, metric_type: str = None, days: int = 30) -> List[Dict]:
    start = (datetime.now() - timedelta(days=days)).isoformat()
    with get_conn() as conn:
        if metric_type:
            rows = conn.execute("""
                SELECT * FROM health_metrics
                WHERE session_id=? AND metric_type=? AND start_time >= ?
                ORDER BY start_time ASC
            """, (session_id, metric_type, start)).fetchall()
        else:
            rows = conn.execute("""
                SELECT * FROM health_metrics
                WHERE session_id=? AND start_time >= ?
                ORDER BY start_time ASC
            """, (session_id, start)).fetchall()
    return [dict(r) for r in rows]


def get_today_health_summary(session_id: str) -> Dict:
    """Aggregate today's health metrics into a single summary dict."""
    today = datetime.now().strftime("%Y-%m-%d")
    with get_conn() as conn:
        # Steps: sum all step records for today
        steps_row = conn.execute("""
            SELECT COALESCE(SUM(value), 0) AS total
            FROM health_metrics
            WHERE session_id=? AND metric_type='steps' AND DATE(start_time)=?
        """, (session_id, today)).fetchone()

        # Latest single-value metrics for today
        def latest(mtype):
            r = conn.execute("""
                SELECT value FROM health_metrics
                WHERE session_id=? AND metric_type=? AND DATE(start_time)=?
                ORDER BY start_time DESC LIMIT 1
            """, (session_id, mtype, today)).fetchone()
            return r["value"] if r else None

        def avg_today(mtype):
            r = conn.execute("""
                SELECT AVG(value) AS avg_val FROM health_metrics
                WHERE session_id=? AND metric_type=? AND DATE(start_time)=?
            """, (session_id, mtype, today)).fetchone()
            return round(r["avg_val"], 1) if r and r["avg_val"] is not None else None

        # Sleep: most recent session ending today or starting yesterday
        sleep_row = conn.execute("""
            SELECT duration_minutes FROM sleep_sessions
            WHERE session_id=? AND (DATE(end_time)=? OR DATE(start_time)=?)
            ORDER BY end_time DESC LIMIT 1
        """, (session_id, today, today)).fetchone()

        # Active calories sum
        cal_row = conn.execute("""
            SELECT COALESCE(SUM(value), 0) AS total FROM health_metrics
            WHERE session_id=? AND metric_type='active_calories' AND DATE(start_time)=?
        """, (session_id, today)).fetchone()

        # Active minutes sum
        min_row = conn.execute("""
            SELECT COALESCE(SUM(value), 0) AS total FROM health_metrics
            WHERE session_id=? AND metric_type='active_minutes' AND DATE(start_time)=?
        """, (session_id, today)).fetchone()

    return {
        "steps":                 round(steps_row["total"]) if steps_row else None,
        "resting_heart_rate":    latest("resting_heart_rate"),
        "average_heart_rate":    avg_today("heart_rate"),
        "hrv":                   latest("heart_rate_variability"),
        "oxygen_saturation":     latest("oxygen_saturation"),
        "respiratory_rate":      latest("respiratory_rate"),
        "sleep_duration_minutes": sleep_row["duration_minutes"] if sleep_row else None,
        "active_calories":       round(cal_row["total"]) if cal_row else None,
        "active_minutes":        round(min_row["total"]) if min_row else None,
        "vo2_max":               latest("vo2_max"),
        "skin_temperature":      latest("skin_temperature"),
    }


def get_health_history(session_id: str, days: int = 14) -> List[Dict]:
    """Per-day aggregated health summary for history charts."""
    start = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    with get_conn() as conn:
        # Steps per day
        steps_rows = conn.execute("""
            SELECT DATE(start_time) AS date, SUM(value) AS steps
            FROM health_metrics
            WHERE session_id=? AND metric_type='steps' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

        hr_rows = conn.execute("""
            SELECT DATE(start_time) AS date, AVG(value) AS avg_hr
            FROM health_metrics
            WHERE session_id=? AND metric_type='heart_rate' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

        rhr_rows = conn.execute("""
            SELECT DATE(start_time) AS date, MIN(value) AS rhr
            FROM health_metrics
            WHERE session_id=? AND metric_type='resting_heart_rate' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

        hrv_rows = conn.execute("""
            SELECT DATE(start_time) AS date, AVG(value) AS hrv
            FROM health_metrics
            WHERE session_id=? AND metric_type='heart_rate_variability' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

        spo2_rows = conn.execute("""
            SELECT DATE(start_time) AS date, AVG(value) AS spo2
            FROM health_metrics
            WHERE session_id=? AND metric_type='oxygen_saturation' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

        sleep_rows = conn.execute("""
            SELECT DATE(end_time) AS date, SUM(duration_minutes) AS sleep_min
            FROM sleep_sessions
            WHERE session_id=? AND DATE(end_time) >= ?
            GROUP BY DATE(end_time)
        """, (session_id, start)).fetchall()

        cal_rows = conn.execute("""
            SELECT DATE(start_time) AS date, SUM(value) AS active_cal
            FROM health_metrics
            WHERE session_id=? AND metric_type='active_calories' AND DATE(start_time) >= ?
            GROUP BY DATE(start_time)
        """, (session_id, start)).fetchall()

    # Merge by date
    by_date: Dict[str, Dict] = {}
    for r in steps_rows:
        by_date.setdefault(r["date"], {})["steps"] = round(r["steps"])
    for r in hr_rows:
        by_date.setdefault(r["date"], {})["average_heart_rate"] = round(r["avg_hr"], 1)
    for r in rhr_rows:
        by_date.setdefault(r["date"], {})["resting_heart_rate"] = round(r["rhr"], 1)
    for r in hrv_rows:
        by_date.setdefault(r["date"], {})["hrv"] = round(r["hrv"], 1)
    for r in spo2_rows:
        by_date.setdefault(r["date"], {})["oxygen_saturation"] = round(r["spo2"], 1)
    for r in sleep_rows:
        by_date.setdefault(r["date"], {})["sleep_duration_minutes"] = round(r["sleep_min"])
    for r in cal_rows:
        by_date.setdefault(r["date"], {})["active_calories"] = round(r["active_cal"])

    result = []
    for date in sorted(by_date.keys()):
        entry = {"date": date}
        entry.update(by_date[date])
        result.append(entry)
    return result


def get_health_baseline(session_id: str, days: int = 14) -> Dict:
    """Calculate per-metric averages over the last N days as personal baseline."""
    history = get_health_history(session_id, days)
    if not history:
        return {}

    keys = ["steps", "average_heart_rate", "resting_heart_rate", "hrv",
            "oxygen_saturation", "sleep_duration_minutes", "active_calories"]
    baseline = {}
    for k in keys:
        vals = [d[k] for d in history if d.get(k) is not None]
        if vals:
            baseline[k] = round(sum(vals) / len(vals), 1)
    return baseline


# ─── Health Sync State ────────────────────────────────────────────────────────

def get_health_sync_state(session_id: str, provider: str = "health_connect") -> Optional[Dict]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM health_sync_state WHERE session_id=? AND provider=?",
            (session_id, provider)
        ).fetchone()
    return dict(row) if row else None


def upsert_health_sync_state(session_id: str, provider: str, status: str,
                              sync_time: str = None, permissions: list = None):
    now = sync_time or datetime.now().isoformat()
    perms_json = json.dumps(permissions) if permissions is not None else None
    with get_conn() as conn:
        conn.execute("""
            INSERT INTO health_sync_state (session_id, provider, last_sync_at, last_sync_status, permissions_granted)
            VALUES (?,?,?,?,?)
            ON CONFLICT(session_id, provider) DO UPDATE SET
                last_sync_at=excluded.last_sync_at,
                last_sync_status=excluded.last_sync_status,
                permissions_granted=COALESCE(excluded.permissions_granted, permissions_granted)
        """, (session_id, provider, now, status, perms_json))


def delete_health_data(session_id: str):
    """Delete all health data for a session (keeps profile/nutrition intact)."""
    with get_conn() as conn:
        conn.execute("DELETE FROM health_metrics WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM sleep_sessions WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM workouts WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM health_sync_state WHERE session_id=?", (session_id,))
