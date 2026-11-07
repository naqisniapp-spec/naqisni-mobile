/**
 * Data loaders — the same queries the website's dashboard runs
 * (naqisni-web src/lib/productRows.ts, src/lib/stores.ts, dashboard/page.tsx).
 */
import { riskLevel, riskOrder, type Risk } from '@/lib/stock';
import { supabase } from '@/lib/supabase';

export type Business = {
  id: string;
  name: string;
  currency: string | null;
  plan: string | null;
  logo_url: string | null;
  role: string;
};

export type Store = { id: string; name: string; city: string | null; isDefault: boolean };

export type Product = {
  product_id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  unit: string | null;
  brand: string | null;
  category: string | null;
  location: string | null;
  image_url: string | null;
  supplier_name: string | null;
  supplier_phone: string | null;
  current_stock: number;
  reorder_point: number | null;
  lead_time_days: number | null;
  sell_price: number | null;
  cost_price: number | null;
  currency: string | null;
  ext_on_order: number | null;
  ext_next_delivery: string | null;
};

export type ProductRow = Product & {
  days: number | null;
  reorderQty: number | null;
  orderBy: string | null;
  onOrder: number;
  risk: Risk;
};

export type Alert = {
  id: string;
  product_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  created_at: string;
  resolved_at: string | null;
  acknowledged: boolean | null;
  products: { name: string } | null;
};

export type Order = {
  id: string;
  supplier_name: string | null;
  status: string;
  auto: boolean | null;
  expected_at: string | null;
  sent_at: string | null;
  created_at: string;
  supplier_response: string | null;
  purchase_order_lines: { product_id: string; quantity: number; received_quantity: number | null; products: { name: string; unit: string | null } | null }[];
};

type Page<T> = (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Reads every row, 1000 at a time (PostgREST's page limit). */
async function allRows<T>(page: Page<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadBusiness(userId: string): Promise<Business | null> {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, currency, plan, logo_url, business_members!inner(role, user_id)')
    .eq('business_members.user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const members = data.business_members as unknown as { role: string }[];
  return {
    id: data.id,
    name: data.name,
    currency: data.currency,
    plan: data.plan,
    logo_url: data.logo_url,
    role: members[0]?.role ?? 'member',
  };
}

export async function loadStores(): Promise<Store[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id, name, city, is_default')
    .is('archived_at', null)
    .order('is_default', { ascending: false })
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, city: s.city, isDefault: Boolean(s.is_default) }));
}

const PRODUCT_COLUMNS =
  'product_id, name, sku, barcode, unit, brand, category, location, image_url, supplier_name, supplier_phone, current_stock, reorder_point, lead_time_days, sell_price, cost_price, currency, ext_on_order, ext_next_delivery';

type Prediction = {
  product_id: string;
  days_until_stockout: number | null;
  recommended_reorder_qty: number | null;
  reorder_at: number | null;
  order_by_date: string | null;
  delivery_late: boolean | null;
};

/** Every active product with its newest forecast, most urgent first. */
export async function loadProductRows(businessId: string): Promise<ProductRow[]> {
  const [products, predictions, { data: openOrders }] = await Promise.all([
    allRows<Product>((a, b) =>
      supabase.from('products').select(PRODUCT_COLUMNS).eq('business_id', businessId).is('archived_at', null).order('product_id').range(a, b)
    ),
    allRows<Prediction>((a, b) =>
      supabase
        .from('latest_predictions')
        .select('product_id, days_until_stockout, recommended_reorder_qty, reorder_at, order_by_date, delivery_late')
        .eq('business_id', businessId)
        .order('product_id')
        .range(a, b)
    ),
    supabase.from('purchase_orders').select('id').eq('business_id', businessId).eq('status', 'open'),
  ]);

  const onOrder = new Map<string, number>();
  const orderIds = (openOrders ?? []).map((o) => o.id as string);
  if (orderIds.length) {
    const { data: lines } = await supabase
      .from('purchase_order_lines')
      .select('product_id, quantity, received_quantity')
      .eq('business_id', businessId)
      .in('order_id', orderIds);
    for (const l of lines ?? []) {
      const left = Math.max(0, Number(l.quantity) - Number(l.received_quantity ?? 0));
      onOrder.set(l.product_id, (onOrder.get(l.product_id) ?? 0) + left);
    }
  }

  const latest = new Map(predictions.map((p) => [p.product_id, p]));
  return products
    .map((p) => {
      const pred = latest.get(p.product_id);
      const days = pred?.days_until_stockout == null ? null : Number(pred.days_until_stockout);
      const ordered = onOrder.get(p.product_id) ?? (Number(p.ext_on_order ?? 0) || 0);
      return {
        ...p,
        current_stock: Number(p.current_stock ?? 0),
        reorder_point: p.reorder_point == null ? null : Number(p.reorder_point),
        days,
        reorderQty: pred?.recommended_reorder_qty == null ? null : Number(pred.recommended_reorder_qty),
        orderBy: pred?.order_by_date ?? null,
        onOrder: ordered,
        risk: riskLevel(Number(p.current_stock ?? 0), p.reorder_point == null ? null : Number(p.reorder_point), days, {
          reorderAt: pred?.reorder_at ?? null,
          leadTimeDays: p.lead_time_days,
          orderByDate: pred?.order_by_date ?? null,
          onOrder: ordered,
          deliveryLate: pred?.delivery_late ?? false,
        }),
      };
    })
    .sort(
      (a, b) =>
        riskOrder[a.risk] - riskOrder[b.risk] || (a.days ?? Infinity) - (b.days ?? Infinity) || a.name.localeCompare(b.name)
    );
}

export async function loadAlerts(businessId: string, open: boolean): Promise<Alert[]> {
  // stock_alerts has two foreign keys to products, so an embedded products(name)
  // is ambiguous for PostgREST — read the names in a second query instead.
  let q = supabase
    .from('stock_alerts')
    .select('id, product_id, severity, message, created_at, resolved_at, acknowledged')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(100);
  q = open ? q.is('resolved_at', null) : q.not('resolved_at', 'is', null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((a) => a.product_id as string))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: products } = await supabase.from('products').select('product_id, name').in('product_id', ids);
    for (const p of products ?? []) names.set(p.product_id, p.name);
  }
  return rows.map((a) => ({ ...a, products: names.has(a.product_id) ? { name: names.get(a.product_id)! } : null })) as Alert[];
}

export async function acknowledgeAlert(id: string) {
  const { error } = await supabase.from('stock_alerts').update({ acknowledged: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function loadOrders(businessId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(
      'id, supplier_name, status, auto, expected_at, sent_at, created_at, supplier_response, purchase_order_lines(product_id, quantity, received_quantity, products(name, unit))'
    )
    .eq('business_id', businessId)
    .in('status', ['draft', 'open'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Order[];
}

export async function loadOrder(id: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(
      'id, supplier_name, status, auto, expected_at, sent_at, created_at, supplier_response, purchase_order_lines(product_id, quantity, received_quantity, products(name, unit))'
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Order | null;
}

export type MovementType = 'sale' | 'restock' | 'return' | 'adjustment';

/**
 * Records a stock change the same way the website's RecordMovementForm does:
 * read the latest stock, insert the movement, then update the stock.
 * `amount` is always positive except for adjustments (type the sign).
 */
export async function recordMovement(businessId: string, productId: string, type: MovementType, amount: number, note?: string) {
  let signed = amount;
  if (type === 'sale') signed = -Math.abs(amount);
  if (type === 'restock' || type === 'return') signed = Math.abs(amount);

  const { data: latest, error: readError } = await supabase
    .from('products')
    .select('current_stock')
    .eq('product_id', productId)
    .eq('business_id', businessId)
    .maybeSingle();
  if (readError || !latest) throw new Error(readError?.message ?? 'Product not found.');

  const newStock = Number(latest.current_stock ?? 0) + signed;
  if (newStock < 0) throw Object.assign(new Error('not_enough'), { current: Number(latest.current_stock ?? 0) });

  const { error: insertError } = await supabase.from('inventory_movements').insert({
    business_id: businessId,
    product_id: productId,
    type,
    quantity: signed,
    source: 'manual', // the database allows manual for hand-entered changes
    note: note || null,
  });
  if (insertError) throw new Error(insertError.message);

  const { error: updateError } = await supabase
    .from('products')
    .update({ current_stock: newStock })
    .eq('product_id', productId)
    .eq('business_id', businessId);
  if (updateError) throw new Error(updateError.message);
  return newStock;
}

export async function findByBarcode(businessId: string, code: string): Promise<string | null> {
  const { data } = await supabase
    .from('products')
    .select('product_id')
    .eq('business_id', businessId)
    .is('archived_at', null)
    .or(`barcode.eq.${code.replace(/[,()]/g, '')},sku.eq.${code.replace(/[,()]/g, '')}`)
    .limit(1);
  return data?.[0]?.product_id ?? null;
}

export type Movement = { id: string; type: string; quantity: number; occurred_at: string; note: string | null };

/** One product with its newest forecast, stock on order and latest stock changes. */
export async function loadProduct(businessId: string, productId: string) {
  const [{ data: p, error }, { data: pred }, { data: moves }, { data: lines }] = await Promise.all([
    supabase.from('products').select(PRODUCT_COLUMNS).eq('business_id', businessId).eq('product_id', productId).maybeSingle(),
    supabase
      .from('latest_predictions')
      .select('product_id, days_until_stockout, recommended_reorder_qty, reorder_at, order_by_date, delivery_late')
      .eq('business_id', businessId)
      .eq('product_id', productId)
      .maybeSingle(),
    supabase
      .from('inventory_movements')
      .select('id, type, quantity, occurred_at, note')
      .eq('business_id', businessId)
      .eq('product_id', productId)
      .order('occurred_at', { ascending: false })
      .limit(15),
    supabase
      .from('purchase_order_lines')
      .select('quantity, received_quantity, purchase_orders!inner(status)')
      .eq('business_id', businessId)
      .eq('product_id', productId)
      .eq('purchase_orders.status', 'open'),
  ]);
  if (error) throw new Error(error.message);
  if (!p) return null;
  const prediction = pred as Prediction | null;
  const fromOrders = (lines ?? []).reduce((s, l) => s + Math.max(0, Number(l.quantity) - Number(l.received_quantity ?? 0)), 0);
  const onOrder = fromOrders || Number(p.ext_on_order ?? 0) || 0;
  const days = prediction?.days_until_stockout == null ? null : Number(prediction.days_until_stockout);
  const stock = Number(p.current_stock ?? 0);
  const rp = p.reorder_point == null ? null : Number(p.reorder_point);
  const row: ProductRow = {
    ...(p as Product),
    current_stock: stock,
    reorder_point: rp,
    days,
    reorderQty: prediction?.recommended_reorder_qty == null ? null : Number(prediction.recommended_reorder_qty),
    orderBy: prediction?.order_by_date ?? null,
    onOrder,
    risk: riskLevel(stock, rp, days, {
      reorderAt: prediction?.reorder_at ?? null,
      leadTimeDays: p.lead_time_days,
      orderByDate: prediction?.order_by_date ?? null,
      onOrder,
      deliveryLate: prediction?.delivery_late ?? false,
    }),
  };
  return { product: row, movements: (moves ?? []) as Movement[] };
}
