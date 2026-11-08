/**
 * Suppliers, as Naqisni knows them: the supplier name and phone saved on
 * products, plus the supplier orders and the order settings (email, WhatsApp,
 * auto-reorder). The same as naqisni-web src/lib/suppliers.ts and
 * src/components/suppliers/SupplierEditor.tsx.
 */
import { loadProductRows, type ProductRow } from '@/lib/data';
import { loadOrderBusiness, type OrderBusiness } from '@/lib/orders';
import { supabase } from '@/lib/supabase';

export type SupplierOrder = {
  id: string;
  supplier_name: string | null;
  supplier_phone: string | null;
  status: string;
  ordered_at: string;
  expected_at: string | null;
  received_at: string | null;
};

export type Supplier = {
  key: string;
  name: string;
  phone: string | null;
  products: ProductRow[];
  low: number;
  /** Usual delivery time of its products (days), if set. */
  leadDays: number | null;
  orders: SupplierOrder[];
  openOrders: number;
  lateDeliveries: number;
  received: number;
};

export function supplierKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function buildSuppliers(products: ProductRow[], orders: SupplierOrder[]): Supplier[] {
  const map = new Map<string, Supplier>();
  const get = (name: string) => {
    const key = supplierKey(name);
    let s = map.get(key);
    if (!s) {
      s = { key, name: name.trim(), phone: null, products: [], low: 0, leadDays: null, orders: [], openOrders: 0, lateDeliveries: 0, received: 0 };
      map.set(key, s);
    }
    return s;
  };
  for (const p of products) {
    const name = (p.supplier_name ?? '').trim();
    if (!name) continue;
    const s = get(name);
    s.products.push(p);
    if (!s.phone && p.supplier_phone) s.phone = p.supplier_phone.trim() || null;
    if (p.risk === 'critical' || p.risk === 'warning') s.low++;
  }
  for (const o of orders) {
    const name = (o.supplier_name ?? '').trim();
    if (!name) continue;
    const s = get(name);
    s.orders.push(o);
    if (!s.phone && o.supplier_phone) s.phone = o.supplier_phone.trim() || null;
    if (o.status === 'open') s.openOrders++;
    if (o.status === 'received' && o.received_at) {
      s.received++;
      if (o.expected_at && o.received_at.slice(0, 10) > o.expected_at.slice(0, 10)) s.lateDeliveries++;
    }
  }
  for (const s of map.values()) {
    s.leadDays = median(s.products.map((p) => p.lead_time_days).filter((d): d is number => typeof d === 'number' && d > 0));
    s.orders.sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));
    s.products.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...map.values()].sort((a, b) => b.low - a.low || a.name.localeCompare(b.name));
}

export async function loadSuppliers(businessId: string): Promise<Supplier[]> {
  const [products, { data: orders, error }] = await Promise.all([
    loadProductRows(businessId),
    supabase
      .from('purchase_orders')
      .select('id, supplier_name, supplier_phone, status, ordered_at, expected_at, received_at')
      .eq('business_id', businessId)
      .order('ordered_at', { ascending: false })
      .limit(2000),
  ]);
  if (error) throw new Error(error.message);
  return buildSuppliers(products, (orders ?? []) as SupplierOrder[]);
}

export type SupplierSettings = { email: string | null; whatsapp: string | null; auto_reorder: boolean };

export async function loadSupplier(
  businessId: string,
  key: string
): Promise<{ supplier: Supplier; settings: SupplierSettings | null; business: OrderBusiness | null } | null> {
  const [suppliers, { data: settings }, business] = await Promise.all([
    loadSuppliers(businessId),
    supabase.from('suppliers').select('email, whatsapp, auto_reorder').eq('business_id', businessId).eq('key', key).maybeSingle(),
    loadOrderBusiness(businessId),
  ]);
  const supplier = suppliers.find((s) => s.key === key);
  if (!supplier) return null;
  return { supplier, settings: (settings as SupplierSettings | null) ?? null, business };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class SupplierError extends Error {
  constructor(public code: 'name' | 'email' | 'autoNeedsContact' | 'settings', detail?: string) {
    super(detail ?? code);
  }
}

/**
 * Saves the name and phone on every product from this supplier (added in
 * Naqisni) and on its open orders, and the order settings under the
 * supplier's key (a rename moves them). Returns the new key.
 */
export async function saveSupplier(
  businessId: string,
  oldName: string,
  values: { name: string; phone: string; email: string; autoReorder: boolean }
): Promise<string> {
  const n = values.name.trim().slice(0, 120);
  const ph = values.phone.trim().slice(0, 40) || null;
  const em = values.email.trim().slice(0, 200) || null;
  if (!n) throw new SupplierError('name');
  if (em && !EMAIL_RE.test(em)) throw new SupplierError('email');
  if (values.autoReorder && !em && !ph) throw new SupplierError('autoNeedsContact');

  // An exact, case-insensitive match (escape % and _).
  const pattern = oldName.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { error } = await supabase
    .from('products')
    .update({ supplier_name: n, supplier_phone: ph })
    .eq('business_id', businessId)
    .eq('source', 'manual')
    .ilike('supplier_name', pattern);
  if (error) throw new Error(error.message);

  await supabase
    .from('purchase_orders')
    .update({ supplier_name: n, supplier_phone: ph })
    .eq('business_id', businessId)
    .in('status', ['draft', 'open'])
    .ilike('supplier_name', pattern);

  const oldKey = supplierKey(oldName);
  const newKey = supplierKey(n);
  if (oldKey !== newKey) await supabase.from('suppliers').delete().eq('business_id', businessId).eq('key', oldKey);
  const { error: upsertError } = await supabase
    .from('suppliers')
    .upsert(
      { business_id: businessId, key: newKey, email: em, whatsapp: ph, auto_reorder: values.autoReorder, updated_at: new Date().toISOString() },
      { onConflict: 'business_id,key' }
    );
  if (upsertError) throw new SupplierError('settings', upsertError.message);
  return newKey;
}
