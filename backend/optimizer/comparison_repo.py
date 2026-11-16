import json
from typing import Dict, Any, List, Optional
from database import db, RLSPolicy, auth_uid

class ComparisonRepository:
    def save_comparison(self, comparison_result: Dict[str, Any], selected_symbols: List[str], user_id: int) -> int:
        """
        Saves comparison data across:
        1. optimization_comparisons (with user_id = auth.uid())
        2. optimization_runs (one for greedy, one for knapsack)
        3. optimization_weights (stocks for each run)
        Enforces write policy and rejects demo role.
        """
        RLSPolicy.enforce_write("optimization_comparisons", user_id)
        conn = db.get_connection()
        ph = "%s" if db.is_mysql else "?"
        try:
            cur = conn.cursor()

            # 1. Insert into optimization_comparisons with user_id
            comp_sql = f"""
            INSERT INTO optimization_comparisons (user_id, budget, risk_aversion, risk_label, verdict, selected_symbols_json)
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            """
            cur.execute(comp_sql, (
                user_id,
                comparison_result["budget"],
                comparison_result["risk_aversion"],
                comparison_result["risk_label"],
                comparison_result["verdict"],
                json.dumps(selected_symbols)
            ))

            comparison_id = cur.lastrowid
            if not comparison_id and hasattr(cur, "fetchone"):
                cur.execute("SELECT last_insert_rowid()")
                comparison_id = cur.fetchone()[0]

            # 2. Insert runs (Greedy and Knapsack)
            for algo_key, algo_name in [("greedy", "Greedy"), ("knapsack", "0/1 Knapsack")]:
                run_data = comparison_result[algo_key]
                run_sql = f"""
                INSERT INTO optimization_runs 
                (comparison_id, algorithm, budget_used, unallocated_budget, expected_return, volatility, sharpe_ratio, total_stocks_selected, execution_time_ms)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                """
                cur.execute(run_sql, (
                    comparison_id,
                    algo_name,
                    run_data["budget_used"],
                    run_data["unallocated_budget"],
                    run_data["expected_return_rupees"],
                    run_data["volatility_pct"],
                    run_data["sharpe_ratio"],
                    run_data["stocks_count"],
                    run_data["runtime_ms"]
                ))
                run_id = cur.lastrowid
                if not run_id and hasattr(cur, "fetchone"):
                    cur.execute("SELECT last_insert_rowid()")
                    run_id = cur.fetchone()[0]

                # 3. Insert weights
                for stock in run_data["stocks"]:
                    weight_sql = f"""
                    INSERT INTO optimization_weights 
                    (run_id, symbol, name, cost, shares, expected_profit, weight_pct, is_exclusive)
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    """
                    cur.execute(weight_sql, (
                        run_id,
                        stock["symbol"],
                        stock["name"],
                        stock["cost"],
                        stock.get("shares", 1),
                        stock["expected_profit"],
                        stock["weight_pct"],
                        1 if stock.get("is_exclusive") else 0
                    ))

            if not db.is_mysql:
                conn.commit()

            return comparison_id
        finally:
            conn.close()

    def get_history(self, user_id: int, limit: int = 15) -> List[Dict[str, Any]]:
        """Retrieves past optimization comparisons for the authenticated user only (user_id = auth.uid())."""
        RLSPolicy.enforce_read("optimization_comparisons", user_id)
        conn = db.get_connection()
        ph = "%s" if db.is_mysql else "?"
        try:
            cur = conn.cursor()
            sql = f"""
            SELECT id, user_id, budget, risk_aversion, risk_label, verdict, selected_symbols_json, created_at 
            FROM optimization_comparisons 
            WHERE user_id = {ph}
            ORDER BY id DESC LIMIT {limit}
            """
            cur.execute(sql, (user_id,))
            rows = cur.fetchall()

            history = []
            for r in rows:
                c_dict = dict(r) if hasattr(r, "keys") else {
                    "id": r[0], "user_id": r[1], "budget": r[2], "risk_aversion": r[3], "risk_label": r[4],
                    "verdict": r[5], "selected_symbols_json": r[6], "created_at": str(r[7])
                }

                # Get the 2 runs for each comparison
                runs_sql = f"""
                SELECT id, algorithm, budget_used, expected_return, volatility, sharpe_ratio, total_stocks_selected, execution_time_ms
                FROM optimization_runs WHERE comparison_id = {ph}
                """
                cur.execute(runs_sql, (c_dict["id"],))
                run_rows = cur.fetchall()
                runs = []
                for rr in run_rows:
                    r_dict = dict(rr) if hasattr(rr, "keys") else {
                        "id": rr[0], "algorithm": rr[1], "budget_used": rr[2],
                        "expected_return": rr[3], "volatility": rr[4],
                        "sharpe_ratio": rr[5], "total_stocks_selected": rr[6],
                        "execution_time_ms": rr[7]
                    }
                    runs.append(r_dict)

                history.append({
                    "id": c_dict["id"],
                    "budget": c_dict["budget"],
                    "risk_aversion": c_dict["risk_aversion"],
                    "risk_label": c_dict["risk_label"],
                    "verdict": c_dict["verdict"],
                    "selected_symbols": json.loads(c_dict["selected_symbols_json"]) if c_dict.get("selected_symbols_json") else [],
                    "created_at": str(c_dict["created_at"]),
                    "runs": runs
                })

            return history
        finally:
            conn.close()

    def get_comparison_by_id(self, comparison_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """Returns comparison if owned by user_id. If belongs to another user, returns None (404 and NO data)."""
        RLSPolicy.enforce_read("optimization_comparisons", user_id)
        conn = db.get_connection()
        ph = "%s" if db.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT id, user_id, budget, risk_aversion, risk_label, verdict, selected_symbols_json, created_at FROM optimization_comparisons WHERE id = {ph} AND user_id = {ph}", (comparison_id, user_id))
            row = cur.fetchone()
            if not row:
                return None
            c_dict = dict(row) if hasattr(row, "keys") else {
                "id": row[0], "user_id": row[1], "budget": row[2], "risk_aversion": row[3], "risk_label": row[4],
                "verdict": row[5], "selected_symbols_json": row[6], "created_at": str(row[7])
            }
            return c_dict
        finally:
            conn.close()

comparison_repo = ComparisonRepository()
