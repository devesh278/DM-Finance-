import { StockUniverseItem, ComparisonData, AlgoResult, PickedStock } from '../types/optimizer';

const RISK_FREE_RATE = 0.065; // 6.5% RBI 91D T-Bill

export function calculateRiskAdjustedProfit(
  cost: number,
  expReturnPct: number,
  volPct: number,
  riskAversion: number
): number {
  // Risk penalty: 0.15 (aggressive/take chance) to 1.5 (conservative/play it safe)
  const penalty = 0.15 + riskAversion * 1.35;
  const adjPct = Math.max(0.5, expReturnPct - penalty * volPct);
  return Math.round(cost * (adjPct / 100.0) * 100) / 100;
}

export function runClientComparison(
  selectedStocks: StockUniverseItem[],
  budget: number,
  riskAversion: number
): ComparisonData {
  const items = selectedStocks.map((s) => ({
    ...s,
    value: calculateRiskAdjustedProfit(s.cost, s.expected_return_pct, s.volatility_pct, riskAversion),
  }));

  const RUN_COUNT = 50;

  // 1. GREEDY ALGORITHM (50 runs average)
  const sortedGreedy = [...items].sort((a, b) => {
    const ratioA = a.value / a.cost;
    const ratioB = b.value / b.cost;
    if (Math.abs(ratioB - ratioA) > 0.00001) return ratioB - ratioA;
    if (Math.abs(b.value - a.value) > 0.01) return b.value - a.value;
    return a.cost - b.cost;
  });

  const runGreedyOnce = () => {
    const picked: Array<typeof items[0] & { pick_order?: number }> = [];
    let spent = 0;
    let remaining = budget;
    let order = 1;

    for (const it of sortedGreedy) {
      const ceilCost = Math.ceil(it.cost);
      if (ceilCost <= remaining) {
        picked.push({ ...it, pick_order: order });
        spent += it.cost;
        remaining -= ceilCost;
        order++;
      }
    }
    return { picked, spent };
  };

  const t0 = performance.now();
  let greedyRunResult = runGreedyOnce();
  for (let i = 1; i < RUN_COUNT; i++) {
    greedyRunResult = runGreedyOnce();
  }
  const greedyAvgMs = Math.round(((performance.now() - t0) / RUN_COUNT) * 1000) / 1000;

  // 2. 0/1 KNAPSACK DYNAMIC PROGRAMMING (Caps budget x stocks at 20 million cells)
  const n = items.length;
  let step = 1;
  let scaleNote: string | null = null;
  const rawCells = budget * n;

  if (rawCells > 20000000) {
    if ((budget / 10) * n <= 20000000) {
      step = 10;
      scaleNote = 'Dynamic programming memory capped under 20M cells using ₹10 units.';
    } else {
      step = 100;
      scaleNote = 'Dynamic programming memory capped under 20M cells using ₹100 units.';
    }
  } else if (n > 50 && budget > 100000) {
    step = 10;
  }

  const scaledBudget = Math.floor(budget / step);
  const weights = items.map((it) => Math.max(1, Math.ceil(it.cost / step)));
  const values = items.map((it) => Math.max(1, Math.round(it.value * 100)));

  const runKnapsackOnce = () => {
    // DP Matrix: dp[i][w]
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(scaledBudget + 1).fill(0));

    for (let i = 1; i <= n; i++) {
      const w_i = weights[i - 1];
      const v_i = values[i - 1];
      const prev = dp[i - 1];
      const curr = dp[i];

      for (let w = 0; w <= scaledBudget; w++) {
        if (w_i <= w) {
          const take = prev[w - w_i] + v_i;
          const leave = prev[w];
          curr[w] = take > leave ? take : leave;
        } else {
          curr[w] = prev[w];
        }
      }
    }

    // Backtrack
    const picked: typeof items = [];
    let currW = scaledBudget;
    let spent = 0;

    for (let i = n; i > 0; i--) {
      if (dp[i][currW] !== dp[i - 1][currW]) {
        const it = items[i - 1];
        picked.push(it);
        currW -= weights[i - 1];
        spent += it.cost;
      }
    }
    return { picked, spent };
  };

  const t1 = performance.now();
  const kRuns = n > 30 ? 1 : 10;
  let knapsackRunResult = runKnapsackOnce();
  for (let i = 1; i < kRuns; i++) {
    knapsackRunResult = runKnapsackOnce();
  }
  const knapsackAvgMs = Math.round(((performance.now() - t1) / kRuns) * 1000) / 1000;

  // Format Results
  const formatResult = (
    name: string,
    list: Array<typeof items[0] & { pick_order?: number }>,
    spent: number,
    ms: number
  ): AlgoResult => {
    const profit = list.reduce((acc, curr) => acc + curr.value, 0);
    const weightedRet = spent > 0 ? list.reduce((acc, curr) => acc + (curr.cost / spent) * curr.expected_return_pct, 0) : 0;
    const weightedVol = spent > 0 ? list.reduce((acc, curr) => acc + (curr.cost / spent) * curr.volatility_pct, 0) : 0;
    const sharpe = weightedVol > 0 ? (weightedRet - RISK_FREE_RATE * 100) / weightedVol : 0;

    const stocks: PickedStock[] = list.map((it) => ({
      symbol: it.symbol,
      name: it.name,
      sector: it.sector,
      cost: it.cost,
      expected_profit: it.value,
      expected_return_pct: it.expected_return_pct,
      volatility_pct: it.volatility_pct,
      weight_pct: spent > 0 ? (it.cost / spent) * 100 : 0,
      shares: 1,
      pick_order: it.pick_order,
    }));

    return {
      algorithm: name,
      budget_used: spent,
      unallocated_budget: Math.max(0, budget - spent),
      budget_utilization_pct: budget > 0 ? (spent / budget) * 100 : 0,
      expected_return_rupees: profit,
      expected_return_pct: weightedRet,
      volatility_pct: weightedVol,
      sharpe_ratio: Math.round(sharpe * 100) / 100,
      stocks_count: list.length,
      runtime_ms: Math.max(0.005, ms),
      stocks,
    };
  };

  const greedyRes = formatResult('Greedy', greedyRunResult.picked, greedyRunResult.spent, greedyAvgMs);
  const knapsackRes = formatResult('0/1 Knapsack', knapsackRunResult.picked, knapsackRunResult.spent, knapsackAvgMs);

  // Exclusive identification
  const greedySyms = new Set(greedyRes.stocks.map((s) => s.symbol));
  const knapsackSyms = new Set(knapsackRes.stocks.map((s) => s.symbol));

  const onlyGreedy = Array.from(greedySyms).filter((s) => !knapsackSyms.has(s));
  const onlyKnapsack = Array.from(knapsackSyms).filter((s) => !greedySyms.has(s));
  const common = Array.from(greedySyms).filter((s) => knapsackSyms.has(s));

  greedyRes.stocks.forEach((s) => {
    s.is_exclusive = onlyGreedy.includes(s.symbol);
  });
  knapsackRes.stocks.forEach((s) => {
    s.is_exclusive = onlyKnapsack.includes(s.symbol);
  });

  const profitDiff = knapsackRes.expected_return_rupees - greedyRes.expected_return_rupees;
  const timeDiff = knapsackRes.runtime_ms - greedyRes.runtime_ms;
  const timeNote = timeDiff > 1.0 ? 'Greedy was faster.' : 'Both finish instantly.';

  // Verdict according to specification
  const allSelectedCount = selectedStocks.length;
  let verdict = '';
  if (common.length === allSelectedCount && Math.abs(profitDiff) < 1.0) {
    verdict = `Both picked the same ${common.length} stocks and expect the same profit. Your budget covers every stock, so there was nothing to trade off.`;
  } else if (Math.abs(profitDiff) < 1.0 && onlyGreedy.length > 0) {
    verdict = `Both reach the same profit with different stocks. ${timeNote}`;
  } else if (profitDiff >= 1.0) {
    const formattedDiff = `₹${Math.round(profitDiff).toLocaleString('en-IN')}`;
    verdict = `Knapsack found ${formattedDiff} more expected profit. ${timeNote}`;
  } else if (profitDiff <= -1.0) {
    const formattedDiff = `₹${Math.round(Math.abs(profitDiff)).toLocaleString('en-IN')}`;
    verdict = `Greedy found ${formattedDiff} more expected profit. ${timeNote}`;
  } else {
    verdict = `Both picked the same ${common.length} stocks and expect the same profit. Your budget covers every stock, so there was nothing to trade off.`;
  }

  // Why results differ (data-driven explanation)
  let whyDiffer = '';
  if (onlyGreedy.length > 0 && onlyKnapsack.length > 0) {
    const gStock = greedyRes.stocks.find((s) => onlyGreedy.includes(s.symbol));
    const kStocks = knapsackRes.stocks.filter((s) => onlyKnapsack.includes(s.symbol));
    const gFirstName = gStock ? gStock.name.split(' ')[0] : 'a high-ranked stock';
    const kNames = kStocks.map((s) => s.name.split(' ')[0]).join(' and ') || 'other assets';
    const remCash = Math.round(greedyRes.unallocated_budget).toLocaleString('en-IN');

    whyDiffer = `Greedy took ${gFirstName} first because it had the best profit per rupee. That left ₹${remCash}, too little for ${kNames}. Knapsack skipped ${gFirstName} so both could fit.`;
  } else {
    whyDiffer = 'Both methods reached identical selections because the value-per-rupee ranking naturally packed the available budget without stranding cash.';
  }

  let riskLabel = 'Balanced';
  if (riskAversion >= 0.7) riskLabel = 'Play it safe';
  else if (riskAversion <= 0.3) riskLabel = 'Take the chance';

  return {
    budget,
    risk_aversion: riskAversion,
    risk_label: riskLabel,
    verdict,
    educational_note: whyDiffer,
    exclusive_picks: {
      only_greedy: onlyGreedy,
      only_knapsack: onlyKnapsack,
      common,
    },
    winners: {
      expected_return: profitDiff >= 1 ? 'knapsack' : profitDiff <= -1 ? 'greedy' : 'tie',
      sharpe_ratio: knapsackRes.sharpe_ratio - greedyRes.sharpe_ratio > 0.02 ? 'knapsack' : greedyRes.sharpe_ratio - knapsackRes.sharpe_ratio > 0.02 ? 'greedy' : 'tie',
      speed: greedyRes.runtime_ms < knapsackRes.runtime_ms ? 'greedy' : 'tie',
      budget_utilization: knapsackRes.budget_used > greedyRes.budget_used + 1 ? 'knapsack' : greedyRes.budget_used > knapsackRes.budget_used + 1 ? 'greedy' : 'tie',
      profit_diff_rupees: profitDiff,
      speed_ratio: Math.round((knapsackRes.runtime_ms / Math.max(0.001, greedyRes.runtime_ms)) * 10) / 10,
    },
    scale_note: scaleNote,
    unit_step: step,
    greedy: greedyRes,
    knapsack: knapsackRes,
  };
}
