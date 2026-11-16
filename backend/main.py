import os
import json
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

from config import Config
from database import (
    db,
    set_auth_context,
    clear_auth_context,
    auth_uid,
    auth_role,
    RLSPolicy,
    RLSAccessDenied,
    RLSReadOnlyViolation,
    RLSBypass
)
from providers.yfinance_provider import default_provider
from optimizer.comparison_engine import comparison_engine
from optimizer.comparison_repo import comparison_repo
from auth_jwt import (
    create_access_token,
    create_refresh_token,
    decode_jwt,
    TokenExpiredError,
    TokenInvalidError
)
from security import hash_password, verify_password
from rate_limiter import public_rate_limiter

app = FastAPI(
    title="D&M Finance API",
    description="Greedy Heuristic and 0/1 Knapsack Portfolio Optimization Engine for NSE / BSE Indian Equities",
    version="1.1.0"
)

# CORS configuration: allow frontend on port 3000 with credentials for httpOnly cookies
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Request & Response Models
# ============================================================================
class AuthRegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class AuthLoginRequest(BaseModel):
    email: str
    password: str

class AddHoldingRequest(BaseModel):
    symbol: str
    shares: int
    avg_buy_price: float

class ComparisonRequest(BaseModel):
    symbols: List[str] = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ITC.NS", "ICICIBANK.NS", "BHARTIARTL.NS"]
    budget: float = 50000.0
    risk_aversion: float = 0.5

class SaveComparisonRequest(BaseModel):
    comparison_data: Dict[str, Any]
    selected_symbols: List[str]

class WatchlistRequest(BaseModel):
    symbol: str

# ============================================================================
# Authentication Dependencies
# ============================================================================
def extract_token(request: Request) -> Optional[str]:
    """Extracts access token from cookie or Authorization header."""
    # 1. Try httpOnly cookie
    cookie_token = request.cookies.get("access_token")
    if cookie_token:
        return cookie_token

    # 2. Try Authorization: Bearer <token>
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:].strip()

    return None

async def get_current_user(request: Request) -> Dict[str, Any]:
    """
    Verifies access token.
    Returns 401 if missing, invalid, or expired.
    Sets thread/task auth context for Row Level Security (RLS).
    """
    token = extract_token(request)
    if not token:
        clear_auth_context()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Missing token or session cookie."
        )

    try:
        payload = decode_jwt(token)
    except TokenExpiredError:
        clear_auth_context()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session expired. Sign in again."
        )
    except TokenInvalidError:
        clear_auth_context()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

    user_id = int(payload.get("sub"))
    role = payload.get("role", "user")

    # Fetch fresh user details from DB
    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT id, email, name, role FROM users WHERE id = {ph}", (user_id,))
        row = cur.fetchone()
        if not row:
            clear_auth_context()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account no longer exists."
            )
        
        u_dict = dict(row) if hasattr(row, "keys") else {
            "id": row[0], "email": row[1], "name": row[2], "role": row[3]
        }
        
        # Activate RLS context
        set_auth_context(user_id=u_dict["id"], role=u_dict["role"])
        return {
            "id": u_dict["id"],
            "email": u_dict["email"],
            "name": u_dict["name"],
            "role": u_dict["role"],
            "isDemo": u_dict["role"] == "demo"
        }
    finally:
        conn.close()

def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    """Extracts authenticated user if valid token present, otherwise None."""
    token = extract_token(request)
    if not token:
        return None
    try:
        payload = decode_jwt(token)
        user_id = int(payload.get("sub"))
        conn = db.get_connection()
        ph = "%s" if db.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT id, email, name, role FROM users WHERE id = {ph}", (user_id,))
            row = cur.fetchone()
            if not row:
                return None
            u_dict = dict(row) if hasattr(row, "keys") else {"id": row[0], "email": row[1], "name": row[2], "role": row[3]}
            return {"id": u_dict["id"], "email": u_dict["email"], "name": u_dict["name"], "role": u_dict["role"], "isDemo": u_dict["role"] == "demo"}
        finally:
            conn.close()
    except Exception:
        return None

async def require_write_permission(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    """
    Enforces write permissions:
    Rejects demo role with 403 Forbidden.
    """
    if current_user.get("role") == "demo" or current_user.get("isDemo"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo account is read-only. Create an account to add stocks or save runs."
        )
    return current_user

# ============================================================================
# Cookie Helpers
# ============================================================================
def set_auth_cookies(response: Response, user_id: int, email: str, name: str, role: str):
    access_token = create_access_token(user_id, email, name, role, expires_in=900) # 15 mins
    refresh_token = create_refresh_token(user_id, expires_in=604800) # 7 days

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=False, # Set to True in production HTTPS
        max_age=900
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/api/auth",
        max_age=604800
    )
    return access_token, refresh_token

def clear_auth_cookies(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/auth")

# ============================================================================
# Auth Endpoints
# ============================================================================
@app.post("/api/auth/register")
def register_user(req: AuthRegisterRequest, response: Response):
    if not req.name:
        req.name = req.email.split("@")[0].capitalize()

    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    try:
        cur = conn.cursor()
        hashed = hash_password(req.password)
        query = f"INSERT INTO users (email, name, password_hash, role) VALUES ({ph}, {ph}, {ph}, {ph})"
        cur.execute(query, (req.email, req.name, hashed, "user"))

        user_id = cur.lastrowid
        if not user_id and hasattr(cur, "fetchone"):
            cur.execute("SELECT last_insert_rowid()")
            user_id = cur.fetchone()[0]

        if not db.is_mysql:
            conn.commit()

        # Set up default portfolio with RLS context
        set_auth_context(user_id, "user")
        db.get_or_create_user_portfolio(user_id)

        access_token, _ = set_auth_cookies(response, user_id, req.email, req.name, "user")

        return {
            "status": "success",
            "message": "Account created successfully.",
            "user": {
                "id": user_id,
                "email": req.email,
                "name": req.name,
                "role": "user",
                "isDemo": False
            },
            "access_token": access_token
        }
    except Exception as e:
        if "UNIQUE" in str(e).upper() or "DUPLICATE" in str(e).upper():
            raise HTTPException(status_code=400, detail="This email is already registered. Sign in instead.")
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")
    finally:
        conn.close()

@app.post("/api/auth/login")
def login_user(req: AuthLoginRequest, response: Response):
    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT id, email, name, password_hash, role FROM users WHERE email = {ph}", (req.email,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        u_dict = dict(row) if hasattr(row, "keys") else {
            "id": row[0], "email": row[1], "name": row[2], "password_hash": row[3], "role": row[4]
        }

        if not verify_password(req.password, u_dict["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password.")

        role = u_dict.get("role") or "user"
        access_token, _ = set_auth_cookies(response, u_dict["id"], u_dict["email"], u_dict["name"], role)

        return {
            "status": "success",
            "user": {
                "id": u_dict["id"],
                "email": u_dict["email"],
                "name": u_dict["name"],
                "role": role,
                "isDemo": role == "demo"
            },
            "access_token": access_token
        }
    finally:
        conn.close()

@app.post("/api/auth/demo")
def login_demo_user(response: Response):
    """Logs into or creates the sandbox read-only demo account."""
    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    demo_email = "demo@dalalstreet.internal"
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT id, email, name, role FROM users WHERE email = {ph}", (demo_email,))
        row = cur.fetchone()

        if not row:
            # Seed demo user
            hashed = hash_password("demo12345")
            cur.execute(f"INSERT INTO users (email, name, password_hash, role) VALUES ({ph}, {ph}, {ph}, {ph})",
                        (demo_email, "Demo Investor", hashed, "demo"))
            demo_id = cur.lastrowid
            if not demo_id and hasattr(cur, "fetchone"):
                cur.execute("SELECT last_insert_rowid()")
                demo_id = cur.fetchone()[0]

            if not db.is_mysql:
                conn.commit()

            # Seed demo portfolio & holdings with bypass
            with RLSBypass():
                cur.execute(f"INSERT INTO portfolios (user_id, name, total_value) VALUES ({ph}, {ph}, {ph})",
                            (demo_id, "Demo Portfolio", 284560.00))
                port_id = cur.lastrowid
                if not port_id and hasattr(cur, "fetchone"):
                    cur.execute("SELECT last_insert_rowid()")
                    port_id = cur.fetchone()[0]

                demo_holdings = [
                    ("RELIANCE.NS", 240, 2740.00),
                    ("TCS.NS", 180, 3920.00),
                    ("HDFCBANK.NS", 320, 1620.00),
                    ("INFY.NS", 150, 1780.00),
                    ("ITC.NS", 450, 440.00),
                ]
                for sym, sh, price in demo_holdings:
                    cur.execute(f"INSERT INTO holdings (portfolio_id, symbol, shares, avg_buy_price) VALUES ({ph}, {ph}, {ph}, {ph})",
                                (port_id, sym, sh, price))

                if not db.is_mysql:
                    conn.commit()
        else:
            demo_dict = dict(row) if hasattr(row, "keys") else {"id": row[0], "email": row[1], "name": row[2], "role": row[3]}
            demo_id = demo_dict["id"]

        access_token, _ = set_auth_cookies(response, demo_id, demo_email, "Demo Investor", "demo")

        return {
            "status": "success",
            "user": {
                "id": demo_id,
                "email": demo_email,
                "name": "Demo Investor",
                "role": "demo",
                "isDemo": True
            },
            "access_token": access_token
        }
    finally:
        conn.close()

@app.post("/api/auth/refresh")
def refresh_session(request: Request, response: Response):
    """Quietly refreshes access token using refresh_token cookie or header."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        # Also check Authorization header
        auth_h = request.headers.get("Authorization")
        if auth_h and auth_h.startswith("Bearer "):
            refresh_token = auth_h[7:].strip()

    if not refresh_token:
        raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")

    try:
        payload = decode_jwt(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")

        user_id = int(payload.get("sub"))
        conn = db.get_connection()
        ph = "%s" if db.is_mysql else "?"
        try:
            cur = conn.cursor()
            cur.execute(f"SELECT id, email, name, role FROM users WHERE id = {ph}", (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")
            u_dict = dict(row) if hasattr(row, "keys") else {"id": row[0], "email": row[1], "name": row[2], "role": row[3]}
            role = u_dict.get("role") or "user"
            access_token, _ = set_auth_cookies(response, u_dict["id"], u_dict["email"], u_dict["name"], role)
            return {
                "status": "success",
                "user": {
                    "id": u_dict["id"],
                    "email": u_dict["email"],
                    "name": u_dict["name"],
                    "role": role,
                    "isDemo": role == "demo"
                },
                "access_token": access_token
            }
        finally:
            conn.close()
    except Exception:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Your session expired. Sign in again.")

@app.post("/api/auth/logout")
def logout_user(response: Response):
    clear_auth_cookies(response)
    clear_auth_context()
    return {"status": "success", "message": "Logged out successfully."}

@app.get("/api/auth/me")
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    return {"status": "success", "user": user}

# ============================================================================
# RLS-Protected Portfolio Endpoints
# ============================================================================
@app.get("/api/portfolios")
def list_portfolios(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns the authenticated user's portfolio. Enforces user_id = auth.uid()."""
    portfolio = db.get_or_create_user_portfolio(user["id"])
    full = db.get_portfolio_by_id(portfolio["id"], user["id"])
    return {"status": "success", "portfolio": full}

@app.get("/api/portfolios/{portfolio_id}")
def get_portfolio_details(portfolio_id: int, user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns portfolio if owned by user.
    If requested portfolio belongs to another user, returns 404 Not Found (and NO data).
    """
    portfolio = db.get_portfolio_by_id(portfolio_id, user["id"])
    if not portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found."
        )
    return {"status": "success", "portfolio": portfolio}

@app.post("/api/portfolios/{portfolio_id}/holdings")
def add_holding_to_portfolio(
    portfolio_id: int,
    req: AddHoldingRequest,
    user: Dict[str, Any] = Depends(require_write_permission)
):
    """
    Rejects demo user with 403 Forbidden.
    Verifies portfolio belongs to auth.uid(). If not, returns 404 Not Found.
    """
    holding = db.add_or_update_holding(
        portfolio_id=portfolio_id,
        user_id=user["id"],
        symbol=req.symbol,
        shares=req.shares,
        avg_buy_price=req.avg_buy_price
    )
    if not holding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Portfolio not found.")
    return {"status": "success", "holding": holding}

@app.delete("/api/portfolios/{portfolio_id}/holdings/{holding_id}")
def remove_holding_from_portfolio(
    portfolio_id: int,
    holding_id: int,
    user: Dict[str, Any] = Depends(require_write_permission)
):
    """
    Rejects demo user with 403 Forbidden.
    Verifies portfolio belongs to auth.uid(). If not, returns 404 Not Found.
    """
    ok = db.delete_holding(holding_id=holding_id, portfolio_id=portfolio_id, user_id=user["id"])
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Holding or portfolio not found.")
    return {"status": "success", "message": "Holding removed."}

# ============================================================================
# RLS-Protected Transactions & Watchlists Endpoints
# ============================================================================
@app.get("/api/transactions")
def get_user_transactions(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns transactions for the authenticated user only (user_id = auth.uid())."""
    conn = db.get_connection()
    ph = "%s" if db.is_mysql else "?"
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT id, portfolio_id, symbol, type, shares, price, created_at FROM transactions WHERE user_id = {ph} ORDER BY id DESC LIMIT 50", (user["id"],))
        rows = cur.fetchall()
        txs = [dict(r) if hasattr(r, "keys") else {"id": r[0], "portfolio_id": r[1], "symbol": r[2], "type": r[3], "shares": r[4], "price": r[5], "created_at": str(r[6])} for r in rows]
        return {"status": "success", "transactions": txs}
    finally:
        conn.close()

@app.get("/api/watchlist")
def get_user_watchlist(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns watchlist symbols for the authenticated user only (user_id = auth.uid())."""
    symbols = db.get_user_watchlist(user["id"])
    return {"status": "success", "symbols": symbols}

@app.post("/api/watchlist")
def add_to_watchlist(req: WatchlistRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Adds a symbol to the authenticated user's watchlist."""
    clean_sym = req.symbol.upper().replace(".NS", "")
    db.add_to_watchlist(user["id"], clean_sym)
    symbols = db.get_user_watchlist(user["id"])
    return {"status": "success", "symbol": clean_sym, "symbols": symbols}

@app.delete("/api/watchlist/{symbol}")
def remove_from_watchlist(symbol: str, user: Dict[str, Any] = Depends(get_current_user)):
    """Removes a symbol from the authenticated user's watchlist."""
    clean_sym = symbol.upper().replace(".NS", "")
    db.remove_from_watchlist(user["id"], clean_sym)
    symbols = db.get_user_watchlist(user["id"])
    return {"status": "success", "symbol": clean_sym, "symbols": symbols}

@app.get("/api/watchlists")
def get_user_watchlists(user: Dict[str, Any] = Depends(get_current_user)):
    """Legacy compatibility endpoint."""
    symbols = db.get_user_watchlist(user["id"])
    return {"status": "success", "watchlist": [{"symbol": s} for s in symbols]}

# ============================================================================
# Stocks & Universe Endpoints (Reads directly from our database, never yfinance)
# ============================================================================
@app.get("/api/stocks")
def get_stocks(request: Request, index_group: Optional[str] = None):
    """
    Returns active stocks from the local database in a single fast query.
    Never calls yfinance during page view.
    Rate limited per IP.
    """
    public_rate_limiter.check(request)
    stocks = db.get_all_stocks(index_group=index_group)
    return {
        "status": "success",
        "count": len(stocks),
        "stocks": stocks
    }

@app.get("/api/stocks/{symbol}")
def get_stock_detail(symbol: str, request: Request):
    """
    Returns complete single stock details and key numbers from local database.
    Checks user holdings if session token is provided.
    Never calls yfinance during page view.
    """
    public_rate_limiter.check(request)
    stock = db.get_stock_by_symbol(symbol)
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Optional auth: check if user holds any shares
    user_shares = 0
    opt_user = get_optional_user(request)
    if opt_user:
        user_shares = db.get_user_stock_shares(opt_user["id"], symbol)

    key_numbers = {
        "one_year_return_pct": stock.get("one_year_return_pct", 0.0),
        "volatility_pct": stock.get("volatility_pct", 0.0),
        "fifty_two_week_high": stock.get("fifty_two_week_high", 0.0),
        "fifty_two_week_low": stock.get("fifty_two_week_low", 0.0),
        "best_day_pct": stock.get("best_day_pct", 0.0),
        "best_day_date": stock.get("best_day_date", ""),
        "worst_day_pct": stock.get("worst_day_pct", 0.0),
        "worst_day_date": stock.get("worst_day_date", ""),
    }

    return {
        "status": "success",
        "stock": stock,
        "key_numbers": key_numbers,
        "user_shares": user_shares
    }

@app.get("/api/stocks/{symbol}/history")
def get_stock_history(symbol: str, request: Request, range: str = "1Y"):
    """
    Returns historical daily adjusted prices for line chart (1M, 6M, 1Y, 2Y).
    Reads strictly from our price_history database table.
    """
    public_rate_limiter.check(request)
    history = db.get_stock_price_history(symbol, range_str=range)
    if not history:
        # Check if stock exists
        stock = db.get_stock_by_symbol(symbol)
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
    return {
        "status": "success",
        "symbol": symbol.upper().replace(".NS", ""),
        "range": range.upper(),
        "count": len(history),
        "history": history
    }

# ============================================================================
# Optimizer Endpoints
# ============================================================================
@app.post("/api/optimizer/compare")
def compare_algorithms(req: ComparisonRequest, request: Request):
    """
    Server-side algorithm execution for up to 100 stocks.
    Loads current prices and metrics from our database in one single query.
    Caps dynamic programming memory under 20M cells using NumPy.
    Rate limited per IP.
    """
    public_rate_limiter.check(request)

    if len(req.symbols) < 2:
        raise HTTPException(status_code=400, detail="Please select at least 2 stocks for comparison.")
    if len(req.symbols) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 stocks can be selected for optimization.")
    if req.budget <= 0:
        raise HTTPException(status_code=400, detail="Budget must be greater than ₹0.")

    # Read selected stocks from database in a single fast query
    db_stocks = db.get_stocks_by_symbols(req.symbols)
    stock_map = {s["symbol"]: s for s in db_stocks}

    items = []
    for s in req.symbols:
        stk = stock_map.get(s)
        if stk:
            items.append({
                "symbol": stk["symbol"],
                "name": stk["company_name"],
                "sector": stk["sector"],
                "cost": float(stk["last_price"]),
                "expected_return_pct": float(stk["expected_return_pct"]),
                "volatility_pct": float(stk["volatility_pct"]),
            })
        else:
            items.append({
                "symbol": s,
                "name": s.replace(".NS", ""),
                "sector": "NSE Equity",
                "cost": 1500.0,
                "expected_return_pct": 18.0,
                "volatility_pct": 16.0,
            })

    comparison_res = comparison_engine.compare(items, budget=req.budget, risk_aversion=req.risk_aversion)
    return comparison_res

@app.post("/api/optimizer/save")
def save_optimizer_run(
    req: SaveComparisonRequest,
    user: Dict[str, Any] = Depends(require_write_permission)
):
    """
    Saves optimization comparison to user's history in the database.
    Requires authentication (401 if missing).
    Rejects demo user (403 Forbidden).
    Enforces user_id = auth.uid().
    """
    try:
        comp_id = comparison_repo.save_comparison(
            comparison_result=req.comparison_data,
            selected_symbols=req.selected_symbols,
            user_id=user["id"]
        )
        return {"status": "success", "comparison_id": comp_id, "message": "Optimization run saved."}
    except RLSReadOnlyViolation:
        raise HTTPException(status_code=403, detail="Demo account is read-only. Create an account to save runs.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save run: {str(e)}")

@app.get("/api/optimizer/history")
def get_optimizer_history(
    limit: int = 15,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns saved comparison history for the authenticated user only.
    Requires authentication (401 if missing).
    Enforces user_id = auth.uid().
    """
    try:
        history = comparison_repo.get_history(user_id=user["id"], limit=limit)
        return {"status": "success", "history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")

@app.get("/api/optimizer/runs/{comparison_id}")
def get_optimizer_run(
    comparison_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns a specific run if owned by user.
    If belongs to another user, returns 404 Not Found (and NO data).
    """
    comp = comparison_repo.get_comparison_by_id(comparison_id=comparison_id, user_id=user["id"])
    if not comp:
        raise HTTPException(status_code=404, detail="Run not found.")
    return {"status": "success", "run": comp}

# ============================================================================
# Public Market Data Endpoints (Rate Limited per IP)
# ============================================================================
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "MySQL" if db.is_mysql else "SQLite",
        "engine": "Greedy & 0/1 Knapsack DP",
        "market": "NSE / BSE India",
        "risk_free_rate": f"{Config.RISK_FREE_RATE * 100}% (RBI 91D T-Bill)"
    }

@app.get("/api/stocks/benchmark")
def get_benchmark_stocks(request: Request):
    public_rate_limiter.check(request)
    symbols = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ITC.NS"]
    stocks = [default_provider.get_current_price(sym) for sym in symbols]
    return {
        "market": "NSE",
        "count": len(stocks),
        "stocks": stocks
    }

@app.get("/api/stocks/search")
def search_stocks(q: str, request: Request):
    public_rate_limiter.check(request)
    return {"results": default_provider.search_stocks(q)}

@app.get("/api/optimizer/universe")
def get_optimizer_universe(request: Request):
    """Returns the full 200 NSE stock universe directly from database in one query."""
    public_rate_limiter.check(request)
    stocks = db.get_all_stocks()
    catalog_list = []
    for s in stocks:
        catalog_list.append({
            "symbol": s["symbol"],
            "name": s["company_name"],
            "sector": s["sector"],
            "index_group": s["index_group"],
            "cost": float(s["last_price"]),
            "expected_return_pct": float(s["expected_return_pct"]),
            "volatility_pct": float(s["volatility_pct"]),
            "one_year_return_pct": float(s["one_year_return_pct"]),
            "trading_days_count": int(s["trading_days_count"]),
            "has_missing_days": bool(s["has_missing_days"]),
        })
    return {"status": "success", "count": len(catalog_list), "stocks": catalog_list}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=Config.HOST, port=Config.PORT, reload=True)
