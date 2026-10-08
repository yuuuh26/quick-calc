import { Decimal } from './engine.js';
export function formatValue(value) {
  const rounded = new Decimal(value).toSignificantDigits(15, Decimal.ROUND_HALF_UP);
  if (rounded.isZero()) return '0';
  if (rounded.e >= 15 || rounded.e <= -7) return rounded.toExponential();
  return rounded.toFixed();
}
