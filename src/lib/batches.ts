/**
 * Batches and expiry dates (naqisni-web migration 0040, src/lib/batches.ts,
 * src/components/batches/BatchesPanel.tsx, src/components/views/ExpiryView.tsx).
 * Sales come off the batch that expires first, automatically.
 */
import { supabase } from '@/lib/supabase';

export type Batch = {
  id: string;
  product_id: string;
  batch_code: string | null;
  expiry_date: string | null;
  received_quantity: number;
  quantity: number;
  received_at: string;
};

export type ExpiringBatch = Batch & { products: { name: string; unit: string | null; archived_at: string | null } | null };

/** Whole days from today (East Africa, UTC+3, like the website) to the expiry date; negative = expired. */
export function daysToExpiry(expiry: string | null, now = new Date()): number | null {
  if (!expiry) return null;
  const today = new Date(now.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
  return Math.round((Date.parse(`${expiry}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

const num = (b: Batch): Batch => ({ ...b, quantity: Number(b.quantity), received_quantity: Number(b.received_quantity) });

/** Every batch with an expiry date that still has stock, soonest first. */
export async function loadExpiring(businessId: string): Promise<ExpiringBatch[]> {
  const out: ExpiringBatch[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('product_batches')
      .select('id, product_id, batch_code, expiry_date, received_quantity, quantity, received_at, products(name, unit, archived_at)')
      .eq('business_id', businessId)
      .gt('quantity', 0)
      .not('expiry_date', 'is', null)
      .order('expiry_date')
      .order('id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data ?? []) as unknown as (ExpiringBatch & { products: ExpiringBatch['products'] | ExpiringBatch['products'][] })[]) {
      const products = Array.isArray(r.products) ? (r.products[0] ?? null) : r.products;
      if (products && !products.archived_at) out.push({ ...num(r), products });
    }
    if (!data || data.length < 1000) return out;
  }
}

/** The product's batches that still have stock. */
export async function loadProductBatches(productId: string): Promise<Batch[]> {
  const { data, error } = await supabase
    .from('product_batches')
    .select('id, product_id, batch_code, expiry_date, received_quantity, quantity, received_at')
    .eq('product_id', productId)
    .gt('quantity', 0)
    .order('expiry_date', { ascending: true, nullsFirst: false })
    .order('received_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Batch[]).map(num);
}

/** Adds a batch; with addToStock the stock also goes up by it (like recording a delivery). */
export async function addBatch(opts: {
  businessId: string;
  productId: string;
  quantity: number;
  expiry: string | null;
  code: string | null;
  addToStock: boolean;
}) {
  const { error } = await supabase.from('product_batches').insert({
    business_id: opts.businessId,
    product_id: opts.productId,
    received_quantity: opts.quantity,
    quantity: opts.quantity,
    expiry_date: opts.expiry,
    batch_code: opts.code?.trim().slice(0, 60) || null,
  });
  if (error) throw new Error(error.message);
  if (!opts.addToStock) return;
  const { data: latest } = await supabase.from('products').select('current_stock').eq('product_id', opts.productId).maybeSingle();
  const { error: moveError } = await supabase
    .from('inventory_movements')
    .insert({ business_id: opts.businessId, product_id: opts.productId, type: 'restock', quantity: opts.quantity, source: 'manual' });
  if (moveError) throw new Error(moveError.message);
  await supabase
    .from('products')
    .update({ current_stock: Number(latest?.current_stock ?? 0) + opts.quantity })
    .eq('product_id', opts.productId);
}

/** Throws an expired batch away: its quantity leaves the stock as waste ("expired"). */
export async function discardBatch(batchId: string) {
  const { error } = await supabase.rpc('discard_batch', { p_batch_id: batchId });
  if (error) throw new Error(error.message);
}

/** "31/12/2026" (or 31-12-2026, 31.12.26) → "2026-12-31"; null when empty; throws when not a real date. */
export function parseDate(text: string): string | null {
  const v = text.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{2}|\d{4})$/);
  if (!m) throw new Error('date');
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const back = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(back.getTime()) || back.getUTCDate() !== d || back.getUTCMonth() + 1 !== mo) throw new Error('date');
  return iso;
}
