import time
import math
import numpy as np
from typing import List, Dict, Any, Tuple
from config import Config

class ComparisonOptimizerEngine:
    def __init__(self, risk_free_rate: float = Config.RISK_FREE_RATE):
        self.rf = risk_free_rate
        self.MAX_CELL_CAP = 20_000_000 # Cap budget x stocks at 20 million cells

    def calculate_risk_adjusted_value(
        self, cost: float, exp_return_pct: float, vol_pct: float, risk_aversion: float
    ) -> float:
        """
        Calculates risk-adjusted expected profit in rupees.
        risk_aversion: 0.0 ("Take the chance") to 1.0 ("Play it safe").
        """
        risk_penalty = 0.15 + (risk_aversion * 1.35)
        risk_adjusted_pct = exp_return_pct - (risk_penalty * vol_pct)
        adjusted_pct = max(0.5, risk_adjusted_pct)
        profit = cost * (adjusted_pct / 100.0)
        return round(profit, 2)

    def _execute_greedy(self, candidates: List[Dict[str, Any]], budget: float) -> Tuple[List[Dict[str, Any]], float]:
        selected = []
        spent = 0.0
        remaining = budget
        pick_order = 1

        for it in candidates:
            cost_ceil = math.ceil(it["cost"])
            if cost_ceil <= remaining:
                item_copy = dict(it)
                item_copy["pick_order"] = pick_order
                selected.append(item_copy)
                spent += it["cost"]
                remaining -= cost_ceil
                pick_order += 1

        return selected, spent

    def _execute_knapsack_numpy(
        self, items: List[Dict[str, Any]], budget: float, step: int
    ) -> Tuple[List[Dict[str, Any]], float]:
        n = len(items)
        if n == 0 or budget <= 0:
            return [], 0.0

        scaled_budget = int(math.floor(budget / step))
        scaled_weights = [max(1, int(math.ceil(it["cost"] / step))) for it in items]
        scaled_values = [max(1, int(round(it["value"] * 100))) for it in items]

        # Allocate 2D NumPy array
        dp = np.zeros((n + 1, scaled_budget + 1), dtype=np.int32)

        for i in range(1, n + 1):
            w_i = scaled_weights[i - 1]
            v_i = scaled_values[i - 1]

            # Vectorized leave
            dp[i] = dp[i - 1]

            # Vectorized take
            if w_i <= scaled_budget:
                takes = dp[i - 1, :-w_i] + v_i
                mask = takes > dp[i, w_i:]
                dp[i, w_i:][mask] = takes[mask]

        # Backtrack to reconstruct chosen items
        selected = []
        curr_w = scaled_budget
        spent = 0.0

        for i in range(n, 0, -1):
            if dp[i, curr_w] != dp[i - 1, curr_w]:
                it = items[i - 1]
                selected.append(it)
                curr_w -= scaled_weights[i - 1]
                spent += it["cost"]

        return selected, spent

    def run_greedy(self, items: List[Dict[str, Any]], budget: float) -> Dict[str, Any]:
        """Greedy selection with timing measurement."""
        candidates = []
        for it in items:
            cost = it["cost"]
            val = it["value"]
            ratio = val / cost if cost > 0 else 0
            candidates.append({
                **it,
                "ratio": ratio,
            })

        # Sort descending by value per rupee
        candidates.sort(key=lambda x: (x["ratio"], x["value"], -x["cost"]), reverse=True)

        start = time.perf_counter()
        selected, spent = self._execute_greedy(candidates, budget)
        runtime_ms = (time.perf_counter() - start) * 1000.0

        return {
            "stocks": selected,
            "stocks_count": len(selected),
            "budget_used": round(spent, 2),
            "unallocated_budget": round(budget - spent, 2),
            "runtime_ms": max(0.01, round(runtime_ms, 3)),
        }

    def run_knapsack(self, items: List[Dict[str, Any]], budget: float) -> Tuple[Dict[str, Any], int, str]:
        """
        0/1 Knapsack dynamic programming with automatic memory-capping step.
        Caps budget x stocks at 20 million cells.
        """
        n = len(items)
        total_cells_1 = budget * n

        if total_cells_1 > self.MAX_CELL_CAP:
            if (budget / 10.0) * n <= self.MAX_CELL_CAP:
                step = 10
                scale_note = "Dynamic programming memory capped under 20M cells using ₹10 units."
            else:
                step = 100
                scale_note = "Dynamic programming memory capped under 20M cells using ₹100 units."
        else:
            step = 1
            scale_note = None

        start = time.perf_counter()
        selected, spent = self._execute_knapsack_numpy(items, budget, step)
        runtime_ms = (time.perf_counter() - start) * 1000.0

        result = {
            "stocks": selected,
            "stocks_count": len(selected),
            "budget_used": round(spent, 2),
            "unallocated_budget": round(budget - spent, 2),
            "runtime_ms": max(0.01, round(runtime_ms, 3)),
            "unit_step": step,
            "scale_note": scale_note,
        }
        return result, step, scale_note

    def compare(
        self,
        universe_items: List[Dict[str, Any]],
        budget: float,
        risk_aversion: float = 0.5
    ) -> Dict[str, Any]:
        """
        Runs Greedy and Knapsack on candidate pool, computes metrics and returns verdict.
        """
        # 1. Compute risk-adjusted value for each item
        items = []
        for stock in universe_items:
            cost = float(stock["cost"])
            exp_ret = float(stock["expected_return_pct"])
            vol = float(stock["volatility_pct"])
            val = self.calculate_risk_adjusted_value(cost, exp_ret, vol, risk_aversion)

            items.append({
                "symbol": stock["symbol"],
                "name": stock["name"],
                "sector": stock.get("sector", "NSE Equity"),
                "cost": cost,
                "expected_return_pct": exp_ret,
                "volatility_pct": vol,
                "value": val,
            })

        # 2. Run Greedy
        greedy_res = self.run_greedy(items, budget)

        # 3. Run Knapsack
        knapsack_res, step_used, scale_note = self.run_knapsack(items, budget)

        # 4. Compute metrics for both
        greedy_stocks = greedy_res["stocks"]
        knapsack_stocks = knapsack_res["stocks"]

        greedy_symbols = {s["symbol"] for s in greedy_stocks}
        knapsack_symbols = {s["symbol"] for s in knapsack_stocks}

        # Calculate portfolio returns, volatility, Sharpe
        def compute_metrics(stocks: List[Dict[str, Any]], total_spent: float):
            if total_spent <= 0 or not stocks:
                return 0.0, 0.0, 0.0

            total_profit = sum(s["value"] for s in stocks)
            weighted_ret = sum(s["expected_return_pct"] * (s["cost"] / total_spent) for s in stocks)
            weighted_vol = math.sqrt(sum((s["volatility_pct"] ** 2) * ((s["cost"] / total_spent) ** 2) for s in stocks))
            
            excess_return = (weighted_ret / 100.0) - self.rf
            sharpe = (excess_return / (weighted_vol / 100.0)) if weighted_vol > 0 else 0.0

            return round(total_profit, 2), round(weighted_vol, 2), round(sharpe, 2)

        g_profit, g_vol, g_sharpe = compute_metrics(greedy_stocks, greedy_res["budget_used"])
        k_profit, k_vol, k_sharpe = compute_metrics(knapsack_stocks, knapsack_res["budget_used"])

        # Attach weights & exclusivity flag
        for s in greedy_stocks:
            s["weight_pct"] = round((s["cost"] / greedy_res["budget_used"]) * 100.0, 2) if greedy_res["budget_used"] > 0 else 0.0
            s["expected_profit"] = s["value"]
            s["is_exclusive"] = s["symbol"] not in knapsack_symbols

        for s in knapsack_stocks:
            s["weight_pct"] = round((s["cost"] / knapsack_res["budget_used"]) * 100.0, 2) if knapsack_res["budget_used"] > 0 else 0.0
            s["expected_profit"] = s["value"]
            s["is_exclusive"] = s["symbol"] not in greedy_symbols

        greedy_res["expected_return_rupees"] = g_profit
        greedy_res["volatility_pct"] = g_vol
        greedy_res["sharpe_ratio"] = g_sharpe

        knapsack_res["expected_return_rupees"] = k_profit
        knapsack_res["volatility_pct"] = k_vol
        knapsack_res["sharpe_ratio"] = k_sharpe

        # Plain language verdict
        profit_diff = k_profit - g_profit
        time_ratio = (knapsack_res["runtime_ms"] / greedy_res["runtime_ms"]) if greedy_res["runtime_ms"] > 0 else 1.0

        if profit_diff > 50:
            if time_ratio >= 1.5:
                verdict = f"Knapsack found ₹{profit_diff:,.0f} more expected profit; greedy was {time_ratio:.1f}x faster."
            else:
                verdict = f"Knapsack found ₹{profit_diff:,.0f} more expected profit within your budget."
        elif profit_diff < -50:
            verdict = f"Greedy found ₹{abs(profit_diff):,.0f} more expected profit within budget constraints."
        else:
            if greedy_symbols == knapsack_symbols:
                verdict = f"Both algorithms selected the exact same {len(greedy_symbols)} stocks. Greedy finished in {greedy_res['runtime_ms']:.2f} ms."
            else:
                verdict = f"Both methods achieved similar profit (~₹{k_profit:,.0f}), but chose different stock combinations."

        risk_label = "Play it safe" if risk_aversion >= 0.7 else ("Take the chance" if risk_aversion <= 0.3 else "Balanced")

        return {
            "budget": budget,
            "risk_aversion": risk_aversion,
            "risk_label": risk_label,
            "verdict": verdict,
            "unit_step": step_used,
            "scale_note": scale_note,
            "greedy": greedy_res,
            "knapsack": knapsack_res,
        }

comparison_engine = ComparisonOptimizerEngine()
