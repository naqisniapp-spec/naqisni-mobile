/**
 * A copy of naqisni-web src/lib/reports.ts (keep them the same).
 *
 * Numbers for the Reports page: stock value, fast movers and slow movers.
 * Pure functions (no database), so they are easy to test.
 *
 * 'Moved out' is every unit that left the stock: sales and 'Taken out'
 * (inventory_movements of type sale or adjustment with a negative quantity).
 * For Maximo items that is the issues: parts used by the company or handed to
 * another team, whose own sales are recorded in their own system.
 *
 * - Stock value: stock on hand x cost price (and x selling price), in the
 *   business's main currency. Products priced in another currency are
 *   converted with the exchange rates set on My account; without a rate they
 *   are counted apart.
 * - Fast movers: most units moved out in the period.
 * - Slow movers: products with stock that moved little or nothing in the
 *   period, most money tied up first. Products added during the period are
 *   left out (too new to judge).
 */

import { supabase } from '@/lib/supabase';

export type FxRates = Record<string, number>;

/** naqisni-web src/lib/currency.ts */
export function cleanRates(raw: unknown): FxRates {
  const out: FxRates = {};
  if (raw && typeof raw === 'object') {
    for (const [code, v] of Object.entries(raw as Record<string, unknown>)) {
      const rate = Number(v);
      if (/^[A-Z]{3,4}$/.test(code) && Number.isFinite(rate) && rate > 0) out[code] = rate;
    }
  }
  return out;
}

function productCurrency(own: string | null | undefined, main: string): string {
  return own?.trim() || main;
}

function toMain(amount: number, from: string, main: string, rates: FxRates): number | null {
  if (!from || from === main) return amount;
  const rate = rates[from];
  return rate ? amount * rate : null;
}

/** 'USD 1,234' (whole numbers above 100, otherwise up to 2 decimals). */
export function formatAmount(amount: number, currency: string): string {
  const digits = Math.abs(amount) >= 100 ? 0 : 2;
  return `${currency ? currency + ' ' : ''}${amount.toLocaleString('en-US', { maximumFractionDigits: digits })}`;
}


export type ReportProduct = {
  product_id: string;
  name: string;
  sku: string | null;
  unit: string | null;
  category: string | null;
  location: string | null;
  source?: string | null;
  currency?: string | null;
  current_stock: number | string | null;
  cost_price: number | string | null;
  sell_price: number | string | null;
  created_at: string;
};

export type ReportMovement = { product_id: string; type: string; quantity: number | string; occurred_at: string };

export type ValueGroup = { name: string; value: number; products: number };

export type Mover = {
  product: ReportProduct;
  units: number;
  /** units x cost price in the main currency; null without a cost price or rate. */
  value: number | null;
  /** Share of all units moved out in the period, 0-1. */
  share: number;
};

export type SlowMover = {
  product: ReportProduct;
  stock: number;
  unitsOut: number;
  /** stock x cost price in the main currency; null without a cost price or rate. */
  tiedUp: number | null;
  /** Months the stock would last at the period's pace; null when nothing moved. */
  monthsOfStock: number | null;
};

export type Report = {
  periodDays: number;
  currency: string;
  products: number;
  stockAtCost: number;
  stockAtSell: number;
  missingCost: number;
  missingSell: number;
  /** Products priced in a currency that has no exchange rate yet. */
  noRate: { currency: string; products: number }[];
  byCategory: ValueGroup[];
  byLocation: ValueGroup[];
  unitsOut: number;
  valueOut: number;
  productsMoved: number;
  fastMovers: Mover[];
  slowMovers: SlowMover[];
  slowTiedUp: number;
  /** Nothing moved out at all in the period: slow movers can't be judged. */
  noMovement: boolean;
};

const DAY = 86_400_000;
/** More than this many months of stock at the period's pace counts as slow. */
export const SLOW_MONTHS = 6;
const OUTFLOW_TYPES = new Set(['sale', 'adjustment', 'waste']);

function n(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

export function buildReport(
  products: ReportProduct[],
  movements: ReportMovement[],
  periodDays: number,
  now = new Date(),
  {
    currency = 'USD',
    rates = {} as FxRates,
    fastLimit = 10,
    slowLimit = 20,
    groupLimit = 8,
  }: { currency?: string; rates?: FxRates; fastLimit?: number; slowLimit?: number; groupLimit?: number } = {}
): Report {
  const start = now.getTime() - periodDays * DAY;

  // A product's cost / selling price in the main currency (null = unknown).
  const noRate = new Map<string, number>();
  const unitCost = new Map<string, number | null>();
  const unitSell = new Map<string, number | null>();
  let missingCost = 0;
  let missingSell = 0;
  for (const p of products) {
    const cur = productCurrency(p.currency, currency);
    const cost = n(p.cost_price);
    const sell = n(p.sell_price);
    const costMain = cost === null ? null : toMain(cost, cur, currency, rates);
    const sellMain = sell === null ? null : toMain(sell, cur, currency, rates);
    if (cost === null) missingCost++;
    if (sell === null) missingSell++;
    if ((cost !== null && costMain === null) || (sell !== null && sellMain === null)) {
      noRate.set(cur, (noRate.get(cur) ?? 0) + 1);
    }
    unitCost.set(p.product_id, costMain);
    unitSell.set(p.product_id, sellMain);
  }

  let stockAtCost = 0;
  let stockAtSell = 0;
  const groups = { category: new Map<string, ValueGroup>(), location: new Map<string, ValueGroup>() };
  for (const p of products) {
    const stock = Math.max(0, n(p.current_stock) ?? 0);
    const cost = unitCost.get(p.product_id) ?? null;
    const sell = unitSell.get(p.product_id) ?? null;
    if (sell !== null) stockAtSell += stock * sell;
    if (cost === null || stock === 0) continue;
    stockAtCost += stock * cost;
    for (const [k, map] of Object.entries(groups) as ['category' | 'location', Map<string, ValueGroup>][]) {
      const name = p[k]?.trim() || 'Not set';
      const g = map.get(name) ?? { name, value: 0, products: 0 };
      g.value += stock * cost;
      g.products++;
      map.set(name, g);
    }
  }
  const top = (m: Map<string, ValueGroup>) => [...m.values()].sort((a, b) => b.value - a.value).slice(0, groupLimit);

  // Units moved out per product in the period.
  const out = new Map<string, number>();
  for (const m of movements) {
    const t = Date.parse(m.occurred_at);
    const q = n(m.quantity) ?? 0;
    if (!OUTFLOW_TYPES.has(m.type) || !Number.isFinite(t) || t < start || t > now.getTime() || q >= 0) continue;
    out.set(m.product_id, (out.get(m.product_id) ?? 0) - q);
  }
  const byId = new Map(products.map((p) => [p.product_id, p]));
  for (const id of [...out.keys()]) if (!byId.has(id)) out.delete(id);
  let unitsOut = 0;
  let valueOut = 0;
  for (const [id, units] of out) {
    unitsOut += units;
    const cost = unitCost.get(id);
    if (cost !== null && cost !== undefined) valueOut += units * cost;
  }

  const fastMovers: Mover[] = [...out.entries()]
    .map(([id, units]) => {
      const cost = unitCost.get(id) ?? null;
      return { product: byId.get(id) as ReportProduct, units, value: cost === null ? null : units * cost, share: unitsOut > 0 ? units / unitsOut : 0 };
    })
    .sort((a, b) => b.units - a.units || (b.value ?? 0) - (a.value ?? 0))
    .slice(0, fastLimit);

  const noMovement = out.size === 0;
  const months = periodDays / 30;
  const slow: SlowMover[] = [];
  if (!noMovement) {
    for (const p of products) {
      const stock = Math.max(0, n(p.current_stock) ?? 0);
      if (stock === 0) continue;
      if (Date.parse(p.created_at) > start) continue; // too new to judge
      const unitsOut = out.get(p.product_id) ?? 0;
      const monthsOfStock = unitsOut > 0 ? stock / (unitsOut / months) : null;
      if (monthsOfStock !== null && monthsOfStock <= SLOW_MONTHS) continue;
      const cost = unitCost.get(p.product_id) ?? null;
      slow.push({ product: p, stock, unitsOut, tiedUp: cost === null ? null : stock * cost, monthsOfStock });
    }
  }
  slow.sort(
    (a, b) =>
      (b.tiedUp ?? -1) - (a.tiedUp ?? -1) ||
      Number(a.unitsOut > 0) - Number(b.unitsOut > 0) ||
      b.stock - a.stock
  );

  return {
    periodDays,
    currency,
    products: products.length,
    stockAtCost,
    stockAtSell,
    missingCost,
    missingSell,
    noRate: [...noRate.entries()].map(([c, k]) => ({ currency: c, products: k })),
    byCategory: top(groups.category),
    byLocation: top(groups.location),
    unitsOut,
    valueOut,
    productsMoved: out.size,
    fastMovers,
    slowMovers: slow.slice(0, slowLimit),
    slowTiedUp: slow.reduce((s, m) => s + (m.tiedUp ?? 0), 0),
    noMovement,
  };
}

/** Loads the products and stock moved out in the period, and builds the report (the website's Reports page). */
export async function loadReport(businessId: string, periodDays: number, now: number): Promise<Report> {
  const { data: b } = await supabase.from('businesses').select('currency, fx_rates').eq('id', businessId).maybeSingle();
  const currency = (b?.currency as string | null) || 'USD';
  const since = new Date(now - periodDays * DAY).toISOString();
  const all = async <T>(page: (a: number, z: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
    const out: T[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await page(from, from + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) return out;
    }
  };
  const [products, movements] = await Promise.all([
    all<ReportProduct>((a, z) =>
      supabase
        .from('products')
        .select('product_id, name, sku, unit, category, location, source, currency, current_stock, cost_price, sell_price, created_at')
        .eq('business_id', businessId)
        .is('archived_at', null)
        .order('product_id')
        .range(a, z)
    ),
    all<ReportMovement>((a, z) =>
      supabase
        .from('inventory_movements')
        .select('product_id, type, quantity, occurred_at')
        .eq('business_id', businessId)
        .in('type', ['sale', 'adjustment', 'waste'])
        .lt('quantity', 0)
        .gte('occurred_at', since)
        .order('occurred_at')
        .order('id')
        .range(a, z)
    ),
  ]);
  return buildReport(products, movements, periodDays, new Date(now), { currency, rates: cleanRates(b?.fx_rates) });
}
