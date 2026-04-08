import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from .models import (
    UserProfile, FoodItem, FoodEntry, WaterLog,
    PersonalizedNutritionGoals
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
