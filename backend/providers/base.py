from abc import ABC, abstractmethod
from typing import List, Dict, Any
import pandas as pd

class StockDataProvider(ABC):
    """
    Abstract interface for market data providers.
    Allows easy swapping between yfinance, Kite Connect, Upstox, or Alpha Vantage.
    """

    @abstractmethod
    def get_current_price(self, symbol: str) -> Dict[str, Any]:
        """Fetch latest tick/quote for a single stock."""
        pass

    @abstractmethod
    def get_historical_closes(self, symbols: List[str], period: str = "1y") -> pd.DataFrame:
        """Fetch historical close prices matrix for portfolio covariance computation."""
        pass

    @abstractmethod
    def search_stocks(self, query: str) -> List[Dict[str, Any]]:
        """Search Indian stock universe by symbol or company name."""
        pass
