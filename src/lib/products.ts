/**
 * Add and edit products — the same rules as naqisni.com's product form
 * (naqisni-web src/components/ProductForm.tsx, src/lib/productValues.ts,
 * src/lib/sources.ts, src/lib/uploadImage.ts). The database does the rest:
 * the product goes to the store being worked in, a copy (stock 0) appears in
 * every other store, shared details stay in step, and plan limits apply.
 */
import type { Product } from '@/lib/data';
import { supabase } from '@/lib/supabase';

export type ProductValues = {
  name: string;
  sku: string;
  brand: string;
  category: string;
  barcode: string;
  unit: string;
  current_stock: string;
  reorder_point: string;
  cost_price: string;
  sell_price: string;
  /** Empty = the business's main currency. */
  currency: string;
  location: string;
  description: string;
  supplier_name: string;
  supplier_phone: string;
  lead_time_days: string;
  image_url: string;
};

export const emptyProduct: ProductValues = {
  name: '',
  sku: '',
  brand: '',
  category: '',
  barcode: '',
  unit: '',
  current_stock: '',
  reorder_point: '',
  cost_price: '',
  sell_price: '',
  currency: '',
  location: '',
  description: '',
  supplier_name: '',
  supplier_phone: '',
  lead_time_days: '',
  image_url: '',
};

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function productToValues(p: Product): ProductValues {
  return {
    name: str(p.name),
    sku: str(p.sku),
    brand: str(p.brand),
    category: str(p.category),
    barcode: str(p.barcode),
    unit: str(p.unit),
    current_stock: str(p.current_stock),
    reorder_point: str(p.reorder_point),
    cost_price: str(p.cost_price),
    sell_price: str(p.sell_price),
    currency: str(p.currency),
    location: str(p.location),
    description: str(p.description),
    supplier_name: str(p.supplier_name),
    supplier_phone: str(p.supplier_phone),
    lead_time_days: str(p.lead_time_days),
    image_url: str(p.image_url),
  };
}

/** The currencies naqisni.com offers (src/lib/currency.ts). */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'SLSH', 'SOS', 'ETB', 'DJF', 'KES', 'CNY', 'INR', 'TRY'];

// --- Connected systems (src/lib/sources.ts) ---------------------------------

const SYNCED = ['maximo', 'quickbooks', 'odoo', 'api'];

/** True for products copied from a connected system: their SKU and stock come from there. */
export const isSynced = (source: unknown) => SYNCED.includes(String(source));
/** Maximo also owns the reorder point and delivery time. */
export const ownsReorderPoint = (source: unknown) => source === 'maximo';
export const ownsLeadTime = (source: unknown) => source === 'maximo';

export function sourceName(source: unknown): string {
  switch (source) {
    case 'maximo':
      return 'Maximo';
    case 'quickbooks':
      return 'QuickBooks';
    case 'odoo':
      return 'Odoo';
    case 'api':
      return 'your system';
    default:
      return 'Naqisni';
  }
}

export function cleanBarcode(value: string): string {
  return value.replace(/\s+/g, '').slice(0, 64);
}

/** Errors the form shows in the person's language; `field` names the input to fix. */
export class ProductError extends Error {
  constructor(
    public code:
      | 'name'
      | 'sku'
      | 'unit'
      | 'stock'
      | 'number'
      | 'leadTime'
      | 'barcodeTaken'
      | 'photoType'
      | 'photoSize',
    public detail?: string
  ) {
    super(code);
  }
}

function clean(value: string): string | null {
  const v = value.trim();
  return v === '' ? null : v;
}

/** Accepts "1,5" as well as "1.5" (Arabic and European keyboards). */
function toNumber(value: string): number {
  return Number(value.trim().replace(',', '.'));
}

function optionalNumber(value: string, label: string): number | null {
  if (value.trim() === '') return null;
  const n = toNumber(value);
  if (Number.isNaN(n) || n < 0) throw new ProductError('number', label);
  return n;
}

// --- Photo --------------------------------------------------------------------

const MAX_BYTES = 5 * 1024 * 1024; // the product-images bucket limit

function uuid(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b); // react-native-get-random-values (imported in supabase.ts)
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Uploads a photo (a local file uri from the camera) to the public
 * `product-images` bucket, in the signed-in person's folder (the storage
 * policy requires that), and returns its public URL.
 */
export async function uploadPhoto(userId: string, uri: string): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new ProductError('photoSize');
  const path = `${userId}/${uuid()}.jpg`;
  const { error } = await supabase.storage.from('product-images').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message);
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}

// --- Save ---------------------------------------------------------------------

type SaveArgs = {
  businessId: string;
  userId: string;
  /** The business's main currency. */
  mainCurrency: string | null;
  values: ProductValues;
  /** A new photo taken on the phone (local uri), if any. */
  photoUri: string | null;
  labels: { reorderPoint: string; costPrice: string; sellPrice: string };
  /** Leave out to add a new product. */
  existing?: { productId: string; source: string | null; groupId: string | null; stock: number };
};

/** Saves the product and returns its id. */
export async function saveProduct({ businessId, userId, mainCurrency, values, photoUri, labels, existing }: SaveArgs): Promise<string> {
  const source = existing?.source ?? 'manual';
  const synced = isSynced(source);

  if (!values.name.trim()) throw new ProductError('name');
  if (!values.sku.trim()) throw new ProductError('sku');
  if (!values.unit.trim()) throw new ProductError('unit');

  const stock = toNumber(values.current_stock);
  if (values.current_stock.trim() === '' || Number.isNaN(stock) || stock < 0) throw new ProductError('stock');

  const reorderPoint = optionalNumber(values.reorder_point, labels.reorderPoint);
  const costPrice = optionalNumber(values.cost_price, labels.costPrice);
  const sellPrice = optionalNumber(values.sell_price, labels.sellPrice);
  const leadTime = values.lead_time_days.trim() === '' ? null : toNumber(values.lead_time_days);
  if (leadTime !== null && (Number.isNaN(leadTime) || !Number.isInteger(leadTime) || leadTime < 0 || leadTime > 365)) {
    throw new ProductError('leadTime');
  }

  // Each product needs its own barcode (its copies in other stores share it).
  const code = cleanBarcode(values.barcode);
  if (code) {
    const { data: same } = await supabase
      .from('products')
      .select('product_id, name, group_id')
      .eq('business_id', businessId)
      .eq('barcode', code)
      .is('archived_at', null)
      .limit(5);
    const other = (same ?? []).find(
      (p) => p.product_id !== existing?.productId && !(existing?.groupId && p.group_id === existing.groupId)
    );
    if (other) throw new ProductError('barcodeTaken', `${code}|${other.name}`);
  }

  let imageUrl = clean(values.image_url);
  if (photoUri) imageUrl = await uploadPhoto(userId, photoUri);

  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    sku: values.sku.trim(),
    unit: values.unit.trim(),
    current_stock: stock,
    reorder_point: reorderPoint,
    cost_price: costPrice,
    sell_price: sellPrice,
    currency: values.currency && values.currency !== mainCurrency ? values.currency : null,
    brand: clean(values.brand),
    category: clean(values.category),
    barcode: clean(code),
    location: clean(values.location),
    description: clean(values.description),
    supplier_name: clean(values.supplier_name),
    supplier_phone: clean(values.supplier_phone),
    lead_time_days: leadTime,
    image_url: imageUrl,
  };

  // Fields the connected system owns are never sent (the database refuses them).
  if (synced) {
    delete payload.sku;
    delete payload.current_stock;
    if (ownsReorderPoint(source)) delete payload.reorder_point;
    if (ownsLeadTime(source)) delete payload.lead_time_days;
  }

  if (!existing) {
    const { data, error } = await supabase.from('products').insert({ ...payload, business_id: businessId }).select('product_id').single();
    if (error) throw new Error(error.message);
    return data.product_id as string;
  }

  // A stock change made here is kept in the stock history as an adjustment.
  if (!synced && stock !== existing.stock) {
    const { data: latest } = await supabase.from('products').select('current_stock').eq('product_id', existing.productId).maybeSingle();
    const delta = stock - Number(latest?.current_stock ?? existing.stock);
    if (delta !== 0) {
      const { error } = await supabase.from('inventory_movements').insert({
        business_id: businessId,
        product_id: existing.productId,
        type: 'adjustment',
        quantity: delta,
        source: 'manual',
        note: 'Stock changed on Edit product',
      });
      if (error) throw new Error(error.message);
    }
  }

  const { error } = await supabase.from('products').update(payload).eq('product_id', existing.productId).eq('business_id', businessId);
  if (error) throw new Error(error.message);
  return existing.productId;
}

/** The product as stored (for the edit form). */
export async function loadProductForEdit(businessId: string, productId: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select(
      'product_id, name, sku, barcode, unit, brand, category, location, image_url, supplier_name, supplier_phone, current_stock, reorder_point, lead_time_days, sell_price, cost_price, currency, ext_on_order, ext_next_delivery, store_id, description, source, group_id'
    )
    .eq('business_id', businessId)
    .eq('product_id', productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Product | null) ?? null;
}
