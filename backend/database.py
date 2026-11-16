import sqlite3
import pymysql
from pymysql.cursors import DictCursor
from typing import Optional, Dict, Any, List
from contextvars import ContextVar
import os
import json
from config import Config

# ============================================================================
# Row Level Security (RLS) Context & Policies
# ============================================================================
_auth_uid: ContextVar[Optional[int]] = ContextVar("auth_uid", default=None)
_auth_role: ContextVar[Optional[str]] = ContextVar("auth_role", default=None)
_rls_bypass: ContextVar[bool] = ContextVar("rls_bypass", default=False)

def auth_uid() -> Optional[int]:
    """Returns the authenticated user's ID for RLS filtering (equivalent to auth.uid())."""
    return _auth_uid.get()

def auth_role() -> Optional[str]:
    """Returns the authenticated user's role (e.g. 'user', 'demo', 'admin')."""
    return _auth_role.get()

def set_auth_context(user_id: Optional[int], role: Optional[str] = "user"):
    _auth_uid.set(user_id)
    _auth_role.set(role)

def clear_auth_context():
    _auth_uid.set(None)
    _auth_role.set(None)

class RLSBypass:
    """Context manager for internal migrations or system initialization."""
    def __enter__(self):
        self.token = _rls_bypass.set(True)
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        _rls_bypass.reset(self.token)

class RLSAccessDenied(Exception):
    pass

class RLSReadOnlyViolation(Exception):
    pass

class RLSPolicy:
    """Enforces database row level security policies: user_id = auth.uid()."""
    @staticmethod
    def enforce_read(table: str, row_user_id: Optional[int]):
        if _rls_bypass.get():
            return
        uid = auth_uid()
        if uid is None:
            raise RLSAccessDenied(f"RLS Policy Denied: Unauthenticated access to table '{table}'")
        if row_user_id is not None and row_user_id != uid:
            raise RLSAccessDenied(f"RLS Policy Violation: Access denied on '{table}'. Row user_id ({row_user_id}) != auth.uid() ({uid})")

    @staticmethod
    def enforce_write(table: str, row_user_id: Optional[int]):
        if _rls_bypass.get():
            return
        role = auth_role()
        if role == "demo":
            raise RLSReadOnlyViolation("Demo account is read-only. Modification not allowed on user tables.")
        uid = auth_uid()
        if uid is None:
            raise RLSAccessDenied(f"RLS Policy Denied: Unauthenticated write to table '{table}'")
        if row_user_id is not None and row_user_id != uid:
            raise RLSAccessDenied(f"RLS Policy Violation: Write denied on '{table}'. Row user_id ({row_user_id}) != auth.uid() ({uid})")

# ============================================================================
# Database Manager
# ============================================================================
class DatabaseManager:
    def __init__(self):
        self.is_mysql = False
        with RLSBypass():
            self._detect_and_init()

    def _detect_and_init(self):
        """Try connecting to MySQL; fallback to SQLite if MySQL is offline."""
        try:
            conn = pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                connect_timeout=2
            )
            with conn.cursor() as cur:
                cur.execute(f"CREATE DATABASE IF NOT EXISTS `{Config.MYSQL_DB}`")
            conn.close()

            test_conn = pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                database=Config.MYSQL_DB,
                cursorclass=DictCursor,
                connect_timeout=2
            )
            test_conn.close()
            self.is_mysql = True
            print(f"[DATABASE] Connected to MySQL database '{Config.MYSQL_DB}' at {Config.MYSQL_HOST}:{Config.MYSQL_PORT}")
            self._init_schema_mysql()
        except Exception as e:
            self.is_mysql = False
            print(f"[DATABASE] MySQL not reachable ({e}). Initializing SQLite fallback at: {Config.SQLITE_PATH}")
            self._init_schema_sqlite()

    def get_connection(self):
        if self.is_mysql:
            return pymysql.connect(
                host=Config.MYSQL_HOST,
                port=Config.MYSQL_PORT,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                database=Config.MYSQL_DB,
                cursorclass=DictCursor,
                autocommit=True
            )
        else:
            conn = sqlite3.connect(Config.SQLITE_PATH)
            conn.row_factory = sqlite3.Row
            return conn

    def _init_schema_mysql(self):
        schema = """
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(32) DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS portfolios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            total_value DECIMAL(15,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS holdings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            portfolio_id INT NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            shares INT NOT NULL,
            avg_buy_price DECIMAL(10,2) NOT NULL,
            current_weight DECIMAL(5,2) DEFAULT 0.00,
            optimized_weight DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            portfolio_id INT NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            type VARCHAR(10) NOT NULL,
            shares INT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS watchlists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS optimization_comparisons (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            budget DECIMAL(15,2) NOT NULL,
            risk_aversion FLOAT NOT NULL,
            risk_label VARCHAR(100) NOT NULL,
            verdict TEXT NOT NULL,
            selected_symbols_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS optimization_runs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            comparison_id INT NOT NULL,
            algorithm VARCHAR(50) NOT NULL,
            budget_used DECIMAL(15,2) NOT NULL,
            unallocated_budget DECIMAL(15,2) NOT NULL,
            expected_return DECIMAL(15,2) NOT NULL,
            volatility DECIMAL(8,2) NOT NULL,
            sharpe_ratio DECIMAL(8,2) NOT NULL,
            total_stocks_selected INT NOT NULL,
            execution_time_ms FLOAT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (comparison_id) REFERENCES optimization_comparisons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS optimization_weights (
            id INT AUTO_INCREMENT PRIMARY KEY,
            run_id INT NOT NULL,
            symbol VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            cost DECIMAL(12,2) NOT NULL,
            shares INT NOT NULL DEFAULT 1,
            expected_profit DECIMAL(12,2) NOT NULL,
            weight_pct DECIMAL(6,2) NOT NULL,
            is_exclusive TINYINT(1) DEFAULT 0,
            FOREIGN KEY (run_id) REFERENCES optimization_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stocks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(50) UNIQUE NOT NULL,
            exchange VARCHAR(10) DEFAULT 'NSE',
            company_name VARCHAR(255) NOT NULL,
            sector VARCHAR(100) NOT NULL,
            is_active TINYINT(1) DEFAULT 1,
            index_group VARCHAR(50) NOT NULL,
            last_price DECIMAL(12,2) DEFAULT 0.00,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            expected_return_pct DECIMAL(8,2) DEFAULT 18.00,
            volatility_pct DECIMAL(8,2) DEFAULT 18.00,
            one_year_return_pct DECIMAL(8,2) DEFAULT 18.00,
            trading_days_count INT DEFAULT 0,
            has_missing_days TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS price_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(50) NOT NULL,
            date VARCHAR(20) NOT NULL,
            adj_close DECIMAL(12,2) NOT NULL,
            volume BIGINT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uk_symbol_date (symbol, date)
        );
        """
        conn = self.get_connection()
        try:
            with conn.cursor() as cur:
                for statement in schema.strip().split(";"):
                    if statement.strip():
                        cur.execute(statement)
        finally:
            conn.close()

    def _init_schema_sqlite(self):
        conn = self.get_connection()
        try:
            cur = conn.cursor()
            cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS portfolios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                total_value REAL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS holdings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                portfolio_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                shares INTEGER NOT NULL,
                avg_buy_price REAL NOT NULL,
                current_weight REAL DEFAULT 0.00,
                optimized_weight REAL DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                portfolio_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                type TEXT NOT NULL,
                shares INTEGER NOT NULL,
                price REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS watchlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
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
            cur.execute("""
            CREATE TABLE IF NOT EXISTS optimization_comparisons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL DEFAULT 1,
                budget REAL NOT NULL,
                risk_aversion REAL NOT NULL,
                risk_label TEXT NOT NULL,
                verdict TEXT NOT NULL,
                selected_symbols_json TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS optimization_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                comparison_id INTEGER NOT NULL,
                algorithm TEXT NOT NULL,
                budget_used REAL NOT NULL,
                unallocated_budget REAL NOT NULL,
                expected_return REAL NOT NULL,
                volatility REAL NOT NULL,
                sharpe_ratio REAL NOT NULL,
                total_stocks_selected INTEGER NOT NULL,
                execution_time_ms REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (comparison_id) REFERENCES optimization_comparisons(id) ON DELETE CASCADE
            );
            """)
            cur.execute("""
            CREATE TABLE IF NOT EXISTS optimization_weights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                symbol TEXT NOT NULL,
                name TEXT NOT NULL,
                cost REAL NOT NULL,
                shares INTEGER NOT NULL DEFAULT 1,
                expected_profit REAL NOT NULL,
                weight_pct REAL NOT NULL,
                is_exclusive INTEGER DEFAULT 0,
                FOREIGN KEY (run_id) REFERENCES optimization_runs(id) ON DELETE CASCADE
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS stocks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT UNIQUE NOT NULL,
                exchange TEXT DEFAULT 'NSE',
                company_name TEXT NOT NULL,
                sector TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                index_group TEXT NOT NULL,
                last_price REAL DEFAULT 0.00,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expected_return_pct REAL DEFAULT 18.00,
                volatility_pct REAL DEFAULT 18.00,
                one_year_return_pct REAL DEFAULT 18.00,
                trading_days_count INTEGER DEFAULT 0,
                has_missing_days INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS price_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                adj_close REAL NOT NULL,
                volume INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(symbol, date)
            );
            """)
            cur.execute("CREATE INDEX IF NOT EXISTS idx_price_history_symbol_date ON price_history(symbol, date);")
            cur.execute("CREATE INDEX IF NOT EXISTS idx_stocks_index_group ON stocks(index_group);")

            # Run safe column additions if migrating an existing SQLite database
            try:
                cur.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
            except Exception:
                pass

            try:
                cur.execute("ALTER TABLE optimization_comparisons ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")
            except Exception:
                pass

            conn.commit()
        finally:
            conn.close()

    # ========================================================================
    # RLS-Protected Portfolio Queries
    # ========================================================================
    def get_or_create_user_portfolio(self, user_id: int) -> Dict[str, Any]:
        """Enforces user_id = auth.uid(). Returns primary portfolio or creates one."""
        RLSPolicy.enforce_read("portfolios", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT id, user_id, name, total_value, created_at FROM portfolios WHERE user_id = {ph} LIMIT 1", (user_id,))
            row = cur.fetchone()
            if not row:
                # Create primary portfolio
                cur.execute(f"INSERT INTO portfolios (user_id, name, total_value) VALUES ({ph}, {ph}, {ph})", (user_id, "Primary Portfolio", 0.0))
                if not self.is_mysql:
                    conn.commit()
                cur.execute(f"SELECT id, user_id, name, total_value, created_at FROM portfolios WHERE user_id = {ph} LIMIT 1", (user_id,))
                row = cur.fetchone()

            p_dict = dict(row) if hasattr(row, "keys") else {
                "id": row[0], "user_id": row[1], "name": row[2], "total_value": row[3], "created_at": str(row[4])
            }
            return p_dict
        finally:
            conn.close()

    def get_portfolio_by_id(self, portfolio_id: int, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Enforces user_id = auth.uid().
        If portfolio belongs to another user, returns None (404 and NO data).
        """
        RLSPolicy.enforce_read("portfolios", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            # Strict RLS filter: portfolio_id AND user_id
            cur.execute(f"SELECT id, user_id, name, total_value, created_at FROM portfolios WHERE id = {ph} AND user_id = {ph}", (portfolio_id, user_id))
            row = cur.fetchone()
            if not row:
                return None

            p_dict = dict(row) if hasattr(row, "keys") else {
                "id": row[0], "user_id": row[1], "name": row[2], "total_value": row[3], "created_at": str(row[4])
            }

            # Fetch holdings
            cur.execute(f"SELECT id, portfolio_id, symbol, shares, avg_buy_price, current_weight, optimized_weight FROM holdings WHERE portfolio_id = {ph}", (portfolio_id,))
            h_rows = cur.fetchall()
            holdings = []
            for h in h_rows:
                h_dict = dict(h) if hasattr(h, "keys") else {
                    "id": h[0], "portfolio_id": h[1], "symbol": h[2], "shares": h[3], "avg_buy_price": h[4],
                    "current_weight": h[5], "optimized_weight": h[6]
                }
                holdings.append(h_dict)

            p_dict["holdings"] = holdings
            return p_dict
        finally:
            conn.close()

    def add_or_update_holding(self, portfolio_id: int, user_id: int, symbol: str, shares: int, avg_buy_price: float) -> Optional[Dict[str, Any]]:
        """
        RLS write policy enforced. Demo user rejected.
        Checks portfolio belongs to user. If not, returns None.
        """
        RLSPolicy.enforce_write("holdings", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            # Verify portfolio ownership
            cur.execute(f"SELECT id FROM portfolios WHERE id = {ph} AND user_id = {ph}", (portfolio_id, user_id))
            if not cur.fetchone():
                return None

            # Check if stock already exists in this portfolio
            cur.execute(f"SELECT id, shares, avg_buy_price FROM holdings WHERE portfolio_id = {ph} AND symbol = {ph}", (portfolio_id, symbol))
            existing = cur.fetchone()
            if existing:
                e_dict = dict(existing) if hasattr(existing, "keys") else {"id": existing[0], "shares": existing[1], "avg_buy_price": existing[2]}
                old_shares = e_dict["shares"]
                old_avg = float(e_dict["avg_buy_price"])
                total_shares = old_shares + shares
                new_avg = ((old_shares * old_avg) + (shares * avg_buy_price)) / total_shares if total_shares > 0 else avg_buy_price

                cur.execute(f"UPDATE holdings SET shares = {ph}, avg_buy_price = {ph} WHERE id = {ph}", (total_shares, round(new_avg, 2), e_dict["id"]))
                holding_id = e_dict["id"]
            else:
                cur.execute(f"INSERT INTO holdings (portfolio_id, symbol, shares, avg_buy_price) VALUES ({ph}, {ph}, {ph}, {ph})", (portfolio_id, symbol, shares, round(avg_buy_price, 2)))
                holding_id = cur.lastrowid
                if not holding_id and hasattr(cur, "fetchone"):
                    cur.execute("SELECT last_insert_rowid()")
                    holding_id = cur.fetchone()[0]

            # Record transaction
            cur.execute(f"INSERT INTO transactions (user_id, portfolio_id, symbol, type, shares, price) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})",
                        (user_id, portfolio_id, symbol, "BUY", shares, avg_buy_price))

            if not self.is_mysql:
                conn.commit()

            cur.execute(f"SELECT id, portfolio_id, symbol, shares, avg_buy_price FROM holdings WHERE id = {ph}", (holding_id,))
            res = cur.fetchone()
            return dict(res) if hasattr(res, "keys") else {"id": res[0], "portfolio_id": res[1], "symbol": res[2], "shares": res[3], "avg_buy_price": res[4]}
        finally:
            conn.close()

    def delete_holding(self, holding_id: int, portfolio_id: int, user_id: int) -> bool:
        """RLS write policy: deletes holding only if portfolio belongs to auth.uid()."""
        RLSPolicy.enforce_write("holdings", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT h.id FROM holdings h JOIN portfolios p ON h.portfolio_id = p.id WHERE h.id = {ph} AND p.id = {ph} AND p.user_id = {ph}",
                        (holding_id, portfolio_id, user_id))
            if not cur.fetchone():
                return False

            cur.execute(f"DELETE FROM holdings WHERE id = {ph}", (holding_id,))
            if not self.is_mysql:
                conn.commit()
            return True
        finally:
            conn.close()

    # ========================================================================
    # Stock Universe, Search & Pricing Queries
    # ========================================================================
    def get_all_stocks(self, index_group: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns active stocks from the local database in a single fast query."""
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            cols = """id, symbol, exchange, company_name, sector, is_active, index_group,
                      last_price, last_updated, expected_return_pct, volatility_pct,
                      one_year_return_pct, trading_days_count, has_missing_days,
                      fifty_two_week_high, fifty_two_week_low, today_change_pct, today_change_amount,
                      best_day_pct, best_day_date, worst_day_pct, worst_day_date, sparkline_json"""
            if index_group and index_group != "all":
                cur.execute(f"SELECT {cols} FROM stocks WHERE is_active = 1 AND index_group = {ph} ORDER BY company_name ASC", (index_group,))
            else:
                cur.execute(f"SELECT {cols} FROM stocks WHERE is_active = 1 ORDER BY company_name ASC")

            rows = cur.fetchall()
            stocks = []
            for r in rows:
                if hasattr(r, "keys"):
                    d = dict(r)
                else:
                    d = {
                        "id": r[0], "symbol": r[1], "exchange": r[2], "company_name": r[3],
                        "sector": r[4], "is_active": bool(r[5]), "index_group": r[6],
                        "last_price": float(r[7] or 0), "last_updated": str(r[8] or ""),
                        "expected_return_pct": float(r[9] or 0), "volatility_pct": float(r[10] or 0),
                        "one_year_return_pct": float(r[11] or 0), "trading_days_count": int(r[12] or 0),
                        "has_missing_days": bool(r[13]),
                        "fifty_two_week_high": float(r[14] or 0), "fifty_two_week_low": float(r[15] or 0),
                        "today_change_pct": float(r[16] or 0), "today_change_amount": float(r[17] or 0),
                        "best_day_pct": float(r[18] or 0), "best_day_date": str(r[19] or ""),
                        "worst_day_pct": float(r[20] or 0), "worst_day_date": str(r[21] or ""),
                        "sparkline_json": str(r[22] or "[]"),
                    }
                d["clean_symbol"] = d["symbol"].replace(".NS", "")
                try:
                    d["sparkline"] = json.loads(d.get("sparkline_json") or "[]")
                except:
                    d["sparkline"] = []
                stocks.append(d)
            return stocks
        finally:
            conn.close()

    def get_stock_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Finds a stock by either RELIANCE or RELIANCE.NS."""
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        sym_clean = symbol.upper().replace(".NS", "")
        sym_ns = f"{sym_clean}.NS"
        try:
            cur = conn.cursor()
            cols = """id, symbol, exchange, company_name, sector, is_active, index_group,
                      last_price, last_updated, expected_return_pct, volatility_pct,
                      one_year_return_pct, trading_days_count, has_missing_days,
                      fifty_two_week_high, fifty_two_week_low, today_change_pct, today_change_amount,
                      best_day_pct, best_day_date, worst_day_pct, worst_day_date, sparkline_json"""
            cur.execute(f"SELECT {cols} FROM stocks WHERE symbol = {ph} OR symbol = {ph} LIMIT 1", (sym_ns, sym_clean))
            r = cur.fetchone()
            if not r:
                return None
            if hasattr(r, "keys"):
                d = dict(r)
            else:
                d = {
                    "id": r[0], "symbol": r[1], "exchange": r[2], "company_name": r[3],
                    "sector": r[4], "is_active": bool(r[5]), "index_group": r[6],
                    "last_price": float(r[7] or 0), "last_updated": str(r[8] or ""),
                    "expected_return_pct": float(r[9] or 0), "volatility_pct": float(r[10] or 0),
                    "one_year_return_pct": float(r[11] or 0), "trading_days_count": int(r[12] or 0),
                    "has_missing_days": bool(r[13]),
                    "fifty_two_week_high": float(r[14] or 0), "fifty_two_week_low": float(r[15] or 0),
                    "today_change_pct": float(r[16] or 0), "today_change_amount": float(r[17] or 0),
                    "best_day_pct": float(r[18] or 0), "best_day_date": str(r[19] or ""),
                    "worst_day_pct": float(r[20] or 0), "worst_day_date": str(r[21] or ""),
                    "sparkline_json": str(r[22] or "[]"),
                }
            d["clean_symbol"] = d["symbol"].replace(".NS", "")
            try:
                d["sparkline"] = json.loads(d.get("sparkline_json") or "[]")
            except:
                d["sparkline"] = []
            return d
        finally:
            conn.close()

    def get_stock_price_history(self, symbol: str, range_str: str = "1Y") -> List[Dict[str, Any]]:
        """Returns daily historical prices for range: 1M, 6M, 1Y, 2Y."""
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        sym_clean = symbol.upper().replace(".NS", "")
        sym_ns = f"{sym_clean}.NS"

        limit_map = {
            "1M": 22,
            "6M": 126,
            "1Y": 252,
            "2Y": 600,
        }
        limit = limit_map.get(range_str.upper(), 252)

        try:
            cur = conn.cursor()
            cur.execute(f"""
            SELECT date, adj_close
            FROM price_history
            WHERE symbol = {ph} OR symbol = {ph}
            ORDER BY date DESC
            LIMIT {limit}
            """, (sym_ns, sym_clean))
            rows = cur.fetchall()
            # Reverse so it is chronological (oldest to newest)
            rows = list(reversed(rows))
            return [{"date": str(r[0]), "adj_close": round(float(r[1]), 2)} for r in rows]
        finally:
            conn.close()

    def get_user_stock_shares(self, user_id: int, symbol: str) -> int:
        """Returns total shares owned by user for a given stock symbol."""
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        sym_clean = symbol.upper().replace(".NS", "")
        sym_ns = f"{sym_clean}.NS"
        try:
            cur = conn.cursor()
            cur.execute(f"""
            SELECT SUM(h.shares)
            FROM holdings h
            JOIN portfolios p ON h.portfolio_id = p.id
            WHERE p.user_id = {ph} AND (h.symbol = {ph} OR h.symbol = {ph})
            """, (user_id, sym_ns, sym_clean))
            res = cur.fetchone()
            return int(res[0]) if res and res[0] is not None else 0
        finally:
            conn.close()

    # ========================================================================
    # Watchlist Queries with Row Level Security
    # ========================================================================
    def get_user_watchlist(self, user_id: int) -> List[str]:
        """RLS read policy: returns watchlist symbols scoped to auth.uid()."""
        RLSPolicy.enforce_read("watchlist_items", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT symbol FROM watchlist_items WHERE user_id = {ph} ORDER BY created_at DESC", (user_id,))
            rows = cur.fetchall()
            return [r[0].replace(".NS", "") for r in rows]
        finally:
            conn.close()

    def add_to_watchlist(self, user_id: int, symbol: str) -> bool:
        """RLS write policy: adds symbol to watchlist_items for auth.uid()."""
        RLSPolicy.enforce_write("watchlist_items", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        clean_sym = symbol.upper().replace(".NS", "")
        try:
            cur = conn.cursor()
            cur.execute(f"INSERT OR IGNORE INTO watchlist_items (user_id, symbol) VALUES ({ph}, {ph})", (user_id, clean_sym))
            if not self.is_mysql:
                conn.commit()
            return True
        finally:
            conn.close()

    def remove_from_watchlist(self, user_id: int, symbol: str) -> bool:
        """RLS write policy: removes symbol from watchlist_items for auth.uid()."""
        RLSPolicy.enforce_write("watchlist_items", user_id)
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        clean_sym = symbol.upper().replace(".NS", "")
        try:
            cur = conn.cursor()
            cur.execute(f"DELETE FROM watchlist_items WHERE user_id = {ph} AND (symbol = {ph} OR symbol = {ph})",
                        (user_id, clean_sym, f"{clean_sym}.NS"))
            if not self.is_mysql:
                conn.commit()
            return True
        finally:
            conn.close()

    def get_stocks_by_symbols(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Fetches multiple stocks by their symbols in one query."""
        if not symbols:
            return []
        conn = self.get_connection()
        ph = "%s" if self.is_mysql else "?"
        placeholders = ", ".join([ph] * len(symbols))
        try:
            cur = conn.cursor()
            cur.execute(f"""
            SELECT id, symbol, exchange, company_name, sector, is_active, index_group,
                   last_price, last_updated, expected_return_pct, volatility_pct,
                   one_year_return_pct, trading_days_count, has_missing_days
            FROM stocks
            WHERE symbol IN ({placeholders})
            """, tuple(symbols))
            rows = cur.fetchall()
            stocks = []
            for r in rows:
                s_dict = dict(r) if hasattr(r, "keys") else {
                    "id": r[0], "symbol": r[1], "exchange": r[2], "company_name": r[3],
                    "sector": r[4], "is_active": bool(r[5]), "index_group": r[6],
                    "last_price": float(r[7]), "last_updated": str(r[8]),
                    "expected_return_pct": float(r[9]), "volatility_pct": float(r[10]),
                    "one_year_return_pct": float(r[11]), "trading_days_count": int(r[12]),
                    "has_missing_days": bool(r[13])
                }
                stocks.append(s_dict)
            return stocks
        finally:
            conn.close()

db = DatabaseManager()
