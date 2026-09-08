import type { Money } from './types';

const cache = new Map<string, Intl.NumberFormat>();

function fmt(currency: string): Intl.NumberFormat {
  let f = cache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      // Whole-dollar prices read cleaner on a product grid; cents show when present.
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    cache.set(currency, f);
  }
  return f;
}

export function money(m: Money | null | undefined): string {
  if (!m) return '';
  const n = Number(m.amount);
  if (Number.isNaN(n)) return '';
  return fmt(m.currencyCode || 'USD').format(n);
}

export function priceRange(min: Money, max: Money): string {
  if (min.amount === max.amount) return money(min);
  return `${money(min)} – ${money(max)}`;
}
