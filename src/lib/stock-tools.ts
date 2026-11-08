/**
 * Waste, transfers, stock counts and stock history — the same database
 * functions naqisni.com uses (naqisni-web migrations 0041 stock counts,
 * 0042 transfers, 0043 waste; src/app/dashboard/record/history).
 * Every function works in the store picked in the app (x-naqisni-store).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

export const WASTE_REASONS = ['expired', 'damaged', 'spoiled', 'missing', 'other'] as const;
export type WasteReason = (typeof WASTE_REASONS)[number];

/** Takes damaged or lost stock out (one product). */
export async function recordWaste(productId: string, quantity: number, reason: WasteReason, note?: string) {
  const { error } = await supabase.rpc('record_waste', {
    p_lines: [{ product_id: productId, quantity }],
    p_reason: reason,
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

/** Moves stock from the store being worked in to another store (one product). */
export async function transferStock(productId: string, toStore: string, quantity: number, note?: string) {
  const { error } = await supabase.rpc('transfer_stock', {
    p_to_store: toStore,
    p_lines: [{ product_id: productId, quantity }],
    p_note: note || null,
  });
  if (error) throw new Error(error.message);
}

// --- Stock count ----------------------------------------------------------------

export type CountProduct = {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  current_stock: number;
  location: string | null;
};

/** Products that can be counted here: added in Naqisni (connected systems own their stock). */
export async function loadCountProducts(businessId: string): Promise<CountProduct[]> {
  const out: CountProduct[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('products')
      .select('product_id, name, sku, barcode, unit, current_stock, location')
      .eq('business_id', businessId)
      .eq('source', 'manual')
      .is('archived_at', null)
      .order('name')
      .order('product_id')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as CountProduct[]).map((p) => ({ ...p, current_stock: Number(p.current_stock ?? 0) })));
    if (!data || data.length < 1000) return out;
  }
}

/** Saves the count: the stock of every product whose count differs is corrected. */
export async function saveStockCount(lines: { product_id: string; counted: number }[], note?: string) {
  const { error } = await supabase.rpc('save_stock_count', { p_lines: lines, p_note: note || null });
  if (error) throw new Error(error.message);
}

/** The count in progress is kept on the phone until it is saved (like the website keeps it in the browser). */
const draftKey = (businessId: string, storeId: string) => `naqisni_count_${businessId}_${storeId}`;

export async function loadCountDraft(businessId: string, storeId: string): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(draftKey(businessId, storeId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function saveCountDraft(businessId: string, storeId: string, draft: Record<string, string>) {
  try {
    if (Object.keys(draft).length) await AsyncStorage.setItem(draftKey(businessId, storeId), JSON.stringify(draft));
    else await AsyncStorage.removeItem(draftKey(businessId, storeId));
  } catch {
    // The count still works; it just isn't kept if the app closes.
  }
}

// --- Stock history ----------------------------------------------------------------

export const MOVE_TYPES = ['sale', 'restock', 'return', 'adjustment', 'transfer', 'waste'] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export type HistoryMove = {
  id: string;
  product_id: string;
  type: string;
  quantity: number;
  occurred_at: string;
  source: string | null;
  reason: string | null;
  note: string | null;
  products: { name: string; unit: string | null } | null;
};

export const HISTORY_PAGE = 50;

export async function loadHistory(
  businessId: string,
  opts: { type: MoveType | null; days: number | null; query: string; page: number }
): Promise<{ moves: HistoryMove[]; more: boolean }> {
  let productIds: string[] | null = null;
  const q = opts.query.trim().slice(0, 80).replace(/[%,()]/g, ' ');
  if (q) {
    const { data } = await supabase
      .from('products')
      .select('product_id')
      .eq('business_id', businessId)
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.eq.${q.replace(/\s+/g, '')}`)
      .limit(500);
    productIds = (data ?? []).map((p) => p.product_id as string);
    if (!productIds.length) return { moves: [], more: false };
  }

  const from = opts.page * HISTORY_PAGE;
  let query = supabase
    .from('inventory_movements')
    .select('id, product_id, type, quantity, occurred_at, source, reason, note, products!inventory_movements_product_id_fkey(name, unit)')
    .eq('business_id', businessId)
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, from + HISTORY_PAGE); // one extra row tells whether there is more
  if (opts.type) query = query.eq('type', opts.type);
  if (opts.days) query = query.gte('occurred_at', new Date(Date.now() - opts.days * 86_400_000).toISOString());
  if (productIds) query = query.in('product_id', productIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as (HistoryMove & { products: HistoryMove['products'] | HistoryMove['products'][] })[]).map((m) => ({
    ...m,
    quantity: Number(m.quantity),
    products: Array.isArray(m.products) ? (m.products[0] ?? null) : m.products,
  }));
  return { moves: rows.slice(0, HISTORY_PAGE), more: rows.length > HISTORY_PAGE };
}
