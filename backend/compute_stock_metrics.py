"""
Compute and cache stock metrics for the 200 NSE stocks in portfolio.db:
- fifty_two_week_high
- fifty_two_week_low
- today_change_pct
- today_change_amount
- best_day_pct
- best_day_date
- worst_day_pct
- worst_day_date
- sparkline_json (16 sampled points over 1 year)
"""
import sqlite3
import json
import os
import math

DB_PATH = os.path.join(os.path.dirname(__file__), "portfolio.db")

def compute_metrics():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # 1. Add columns to stocks table if they don't exist
    cur.execute("PRAGMA table_info(stocks)")
    existing_cols = {r[1] for r in cur.fetchall()}

    new_cols = [
        ("fifty_two_week_high", "REAL"),
        ("fifty_two_week_low", "REAL"),
        ("today_change_pct", "REAL"),
        ("today_change_amount", "REAL"),
        ("best_day_pct", "REAL"),
        ("best_day_date", "TEXT"),
        ("worst_day_pct", "REAL"),
        ("worst_day_date", "TEXT"),
        ("sparkline_json", "TEXT"),
    ]

    for col_name, col_type in new_cols:
        if col_name not in existing_cols:
            cur.execute(f"ALTER TABLE stocks ADD COLUMN {col_name} {col_type}")

    # 2. Add watchlist_items table with unique constraint and foreign key
    cur.execute("""
    CREATE TABLE IF NOT EXISTS watchlist_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, symbol)
    );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_watchlist_items_user ON watchlist_items(user_id);")

    # 3. For each stock in stocks table, compute metrics from price_history
    cur.execute("SELECT symbol FROM stocks")
    stocks = [r[0] for r in cur.fetchall()]

    print(f"Computing metrics for {len(stocks)} stocks...")

    for sym in stocks:
        cur.execute(
            "SELECT date, adj_close FROM price_history WHERE symbol = ? ORDER BY date ASC",
            (sym,)
        )
        history = cur.fetchall()

        if not history:
            continue

        latest = history[-1]
        last_price = round(latest[1], 2)

        # Today's change (vs previous trading day)
        if len(history) >= 2:
            prev = history[-2]
            prev_price = prev[1]
            today_change_amount = round(last_price - prev_price, 2)
            today_change_pct = round(((last_price - prev_price) / prev_price) * 100.0, 2) if prev_price > 0 else 0.0
        else:
            today_change_amount = 0.0
            today_change_pct = 0.0

        # 1-year window (~252 trading sessions)
        y1_history = history[-252:] if len(history) >= 252 else history
        closes = [r[1] for r in y1_history]

        fifty_two_week_high = round(max(closes), 2)
        fifty_two_week_low = round(min(closes), 2)

        # Best and worst day in the last year
        best_pct = 0.0
        best_date = ""
        worst_pct = 0.0
        worst_date = ""

        if len(y1_history) >= 2:
            daily_returns = []
            for i in range(1, len(y1_history)):
                d = y1_history[i][0]
                p_c = y1_history[i][1]
                p_p = y1_history[i - 1][1]
                if p_p > 0:
                    ret = ((p_c - p_p) / p_p) * 100.0
                    daily_returns.append((ret, d))

            if daily_returns:
                daily_returns.sort(key=lambda x: x[0])
                worst_pct = round(daily_returns[0][0], 2)
                worst_date = daily_returns[0][1]
                best_pct = round(daily_returns[-1][0], 2)
                best_date = daily_returns[-1][1]

        # Sparkline: 16 evenly sampled points across 1 year
        step = max(1, len(closes) // 16)
        sparkline = [round(closes[i], 2) for i in range(0, len(closes), step)][:16]
        if closes[-1] != sparkline[-1]:
            sparkline.append(round(closes[-1], 2))
        sparkline_json = json.dumps(sparkline)

        # Update stocks table
        cur.execute("""
            UPDATE stocks SET
                last_price = ?,
                fifty_two_week_high = ?,
                fifty_two_week_low = ?,
                today_change_pct = ?,
                today_change_amount = ?,
                best_day_pct = ?,
                best_day_date = ?,
                worst_day_pct = ?,
                worst_day_date = ?,
                sparkline_json = ?
            WHERE symbol = ?
        """, (
            last_price,
            fifty_two_week_high,
            fifty_two_week_low,
            today_change_pct,
            today_change_amount,
            best_pct,
            best_date,
            worst_pct,
            worst_date,
            sparkline_json,
            sym
        ))

    conn.commit()
    conn.close()
    print("Stock metrics computation completed successfully.")

if __name__ == "__main__":
    compute_metrics()
