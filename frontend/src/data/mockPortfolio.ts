export interface StockHolding {
  symbol: string;
  name: string;
  sector: string;
  shares: number;
  avgBuyPrice: number;
  currentPrice: number;
  dayChange: number;
  dayChangePercent: number;
  currentWeight: number;      // Current allocation %
  optimizedWeight: number;    // 0/1 Knapsack optimal allocation %
}

// Single canonical shared sample portfolio across Front Page and Dashboard
export const DEMO_STOCKS: StockHolding[] = [
  {
    symbol: 'RELIANCE.NS',
    name: 'Reliance Industries Ltd.',
    sector: 'Energy & Telecom',
    shares: 240,
    avgBuyPrice: 2840.50,
    currentPrice: 3012.40,
    dayChange: 54.20,
    dayChangePercent: 1.83,
    currentWeight: 35.5,
    optimizedWeight: 26.5,
  },
  {
    symbol: 'TCS.NS',
    name: 'Tata Consultancy Services Ltd.',
    sector: 'Information Technology',
    shares: 110,
    avgBuyPrice: 3880.00,
    currentPrice: 4185.30,
    dayChange: 48.60,
    dayChangePercent: 1.17,
    currentWeight: 22.6,
    optimizedWeight: 31.0,
  },
  {
    symbol: 'HDFCBANK.NS',
    name: 'HDFC Bank Ltd.',
    sector: 'Banking & Financials',
    shares: 220,
    avgBuyPrice: 1690.00,
    currentPrice: 1742.60,
    dayChange: -6.40,
    dayChangePercent: -0.37,
    currentWeight: 18.8,
    optimizedWeight: 14.5,
  },
  {
    symbol: 'INFY.NS',
    name: 'Infosys Ltd.',
    sector: 'Information Technology',
    shares: 130,
    avgBuyPrice: 1720.00,
    currentPrice: 1895.80,
    dayChange: 14.20,
    dayChangePercent: 0.75,
    currentWeight: 12.1,
    optimizedWeight: 8.0,
  },
  {
    symbol: 'ITC.NS',
    name: 'ITC Ltd.',
    sector: 'FMCG & Conglomerates',
    shares: 480,
    avgBuyPrice: 425.00,
    currentPrice: 468.90,
    dayChange: 0.8125,
    dayChangePercent: 0.17,
    currentWeight: 11.0,
    optimizedWeight: 20.0,
  },
];

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  totalPnLPercent: number;
  todayPnL: number;
  todayPnLPercent: number;
  sharpeRatioCurrent: number;
  sharpeRatioOptimized: number;
  annualizedVolatilityCurrent: number;
  annualizedVolatilityOptimized: number;
  expectedAnnualReturnCurrent: number;
  expectedAnnualReturnOptimized: number;
}

export const DEMO_PORTFOLIO_SUMMARY: PortfolioSummary = {
  totalValue: 2038257,          // ₹20,38,257
  totalInvested: 1907920,       // ₹19,07,920
  totalPnL: 130337,             // +₹1,30,337 (+6.83%)
  totalPnLPercent: 6.83,
  todayPnL: 19182,              // +₹19,182 (+0.95%)
  todayPnLPercent: 0.95,
  sharpeRatioCurrent: 1.18,
  sharpeRatioOptimized: 1.64,
  annualizedVolatilityCurrent: 18.4,
  annualizedVolatilityOptimized: 14.1,
  expectedAnnualReturnCurrent: 17.8,
  expectedAnnualReturnOptimized: 20.2,
};

export interface ComputedPortfolioMetrics {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPct: number;
  todayGain: number;
  todayGainPct: number;
  volatility: number;
  sharpeRatio: number;
  holdingsWithWeights: StockHolding[];
  friendlyPnLSentence: string;
  largestHoldingSentence: string;
}

export function computePortfolioMetrics(holdings: StockHolding[]): ComputedPortfolioMetrics {
  let totalVal = 0;
  let totalCost = 0;
  let todayGain = 0;

  holdings.forEach((h) => {
    const val = h.shares * h.currentPrice;
    const cost = h.shares * h.avgBuyPrice;
    const dayGain = h.shares * h.dayChange;

    totalVal += val;
    totalCost += cost;
    todayGain += dayGain;
  });

  const totalGain = totalVal - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const prevDayVal = totalVal - todayGain;
  const todayGainPct = prevDayVal > 0 ? (todayGain / prevDayVal) * 100 : 0;

  const holdingsWithWeights = holdings.map((h) => ({
    ...h,
    currentWeight: totalVal > 0 ? ((h.shares * h.currentPrice) / totalVal) * 100 : 0,
  }));

  // Friendly sentence computed from data
  let friendlyPnLSentence = '';
  if (holdings.length === 0) {
    friendlyPnLSentence = 'No holdings recorded yet.';
  } else {
    // Sort by rupee contribution to today's gain
    const sorted = [...holdings].sort((a, b) => (b.shares * b.dayChange) - (a.shares * a.dayChange));
    const top1 = sorted[0];
    const top2 = sorted.length > 1 ? sorted[1] : null;
    const worst = sorted[sorted.length - 1];

    if (todayGain >= 0) {
      if (top1 && top2 && (top1.shares * top1.dayChange) > 0 && (top2.shares * top2.dayChange) > 0) {
        const top1Name = top1.name.split(' ')[0];
        const top2Name = top2.name.split(' ')[0];
        const flatOrDip = worst && (worst.shares * worst.dayChange) <= 0
          ? `; ${worst.name.split(' ')[0]} was flat.`
          : '.';
        friendlyPnLSentence = `${top1Name} and ${top2Name} drove most of today's gains${flatOrDip}`;
      } else if (top1) {
        friendlyPnLSentence = `${top1.name.split(' ')[0]} drove today's positive performance.`;
      } else {
        friendlyPnLSentence = 'Your portfolio closed flat today.';
      }
    } else {
      if (worst) {
        friendlyPnLSentence = `${worst.name.split(' ')[0]} weighed most on performance today.`;
      } else {
        friendlyPnLSentence = 'Market consolidation lowered today\'s performance.';
      }
    }
  }

  // Neutral largest position sentence
  let largestHoldingSentence = '';
  if (holdingsWithWeights.length > 0) {
    const largest = [...holdingsWithWeights].sort((a, b) => b.currentWeight - a.currentWeight)[0];
    const firstName = largest.name.split(' ')[0];
    largestHoldingSentence = `${firstName} is your largest position at ${largest.currentWeight.toFixed(1)}%.`;
  }

  return {
    totalValue: totalVal,
    totalCost: totalCost,
    totalGain: totalGain,
    totalGainPct: totalGainPct,
    todayGain: todayGain,
    todayGainPct: todayGainPct,
    volatility: DEMO_PORTFOLIO_SUMMARY.annualizedVolatilityCurrent,
    sharpeRatio: DEMO_PORTFOLIO_SUMMARY.sharpeRatioCurrent,
    holdingsWithWeights,
    friendlyPnLSentence,
    largestHoldingSentence,
  };
}
