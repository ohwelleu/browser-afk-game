const SUFFIXES = ['', 'K', 'M', 'B', 'T'];

/** `999`, `1.2K`, `3.4M`, `5.6B`, `7.8T`, then `1.2e15`. Never shows NaN. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a < 1000) return sign + String(Math.floor(a));
  if (a >= 1e15) return sign + a.toExponential(1).replace('+', '');
  const tier = Math.floor(Math.log10(a) / 3);
  const v = Math.floor((a / 1000 ** tier) * 10) / 10;
  return sign + (v >= 100 ? Math.floor(v) : v) + SUFFIXES[tier];
}
