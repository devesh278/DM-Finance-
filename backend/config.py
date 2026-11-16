import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Server configuration
    PORT = int(os.getenv("PORT", 8000))
    HOST = os.getenv("HOST", "0.0.0.0")

    # MySQL Database configuration
    MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
    MYSQL_USER = os.getenv("MYSQL_USER", "root")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB = os.getenv("MYSQL_DB", "dalal_portfolio_optimizer")

    # SQLite Fallback path
    SQLITE_PATH = os.path.join(os.path.dirname(__file__), "portfolio.db")

    # RBI 91-day Treasury Bill Yield benchmark (Risk-Free Rate for India)
    RISK_FREE_RATE = float(os.getenv("RISK_FREE_RATE", 0.065))
