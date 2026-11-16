# D&M Finance

> Quantitative Portfolio Optimization for NSE & BSE Indian Equities

D&M Finance provides real-time portfolio tracking and comparison between the Greedy Heuristic and 0/1 Knapsack Dynamic Programming optimization algorithms across 200 NSE securities.

## Features

- **Portfolio Dashboard**: Track NSE equity positions, capital outlay, current valuation, and performance metrics.
- **Algorithmic Optimizer**: Compare Greedy heuristic vs 0/1 Knapsack DP side-by-side with budget constraints and risk aversion controls.
- **NSE Stock Universe**: Searchable catalog of 200 NSE stocks with price history, 1-year sparklines, key metrics, and personal watchlist.
- **Access Control & Row Level Security (RLS)**: Scoped authentication and token verification protecting all portfolios and watchlists.

## Quick Start

```bash
# Start backend and frontend servers
./start.sh
```

Frontend runs on `http://localhost:3000` and API backend on `http://127.0.0.1:8000`.
