/**
 * Indian Market Currency & Number Formatters
 * Uses strict en-IN standard: ₹12,34,567.00 (Lakhs & Crores grouping)
 */

export function formatINR(val: number, includeDecimals = true): string {
  if (isNaN(val) || val === null || val === undefined) return '₹0.00';
  
  const absVal = Math.abs(val);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(absVal);

  const sign = val < 0 ? '-' : '';
  return `${sign}₹${formatted}`;
}

export function formatIndianCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 10000000) {
    // 1 Crore = 10,000,000
    return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  } else if (abs >= 100000) {
    // 1 Lakh = 100,000
    return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  } else if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)} K`;
  }
  return formatINR(val);
}

export function formatPercent(val: number, includeSign = true): string {
  if (isNaN(val)) return '0.00%';
  const prefix = includeSign && val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(2)}%`;
}
