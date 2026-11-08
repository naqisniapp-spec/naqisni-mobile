/**
 * Orders made by hand and sent to the supplier on WhatsApp — the same as
 * naqisni.com's Orders page (naqisni-web src/components/orders/OrderBuilder.tsx,
 * src/lib/supplierOrder.ts, create_purchase_order in migration 0012).
 */
import { loadProductRows, type ProductRow } from '@/lib/data';
import { supabase } from '@/lib/supabase';

export const DEFAULT_LEAD_TIME_DAYS = 7;

// --- WhatsApp numbers (src/lib/supplierOrder.ts) ------------------------------

const BY_COUNTRY: Record<string, string> = {
  somaliland: '252',
  somalia: '252',
  'united arab emirates': '971',
  uae: '971',
  ethiopia: '251',
  djibouti: '253',
  kenya: '254',
  'saudi arabia': '966',
};
const BY_CURRENCY: Record<string, string> = { SLSH: '252', SOS: '252', AED: '971', ETB: '251', DJF: '253', KES: '254', SAR: '966' };
const KNOWN_CODES = ['252', '971', '251', '253', '254', '966'];

export type OrderBusiness = { name: string; country: string | null; currency: string | null; whatsapp_number: string | null };

/** The country calling code for local numbers: from the country, the currency, or the business's own WhatsApp number. */
export function callingCode(b: OrderBusiness | null): string | null {
  if (!b) return null;
  const country = b.country?.trim().toLowerCase();
  if (country && BY_COUNTRY[country]) return BY_COUNTRY[country];
  const currency = b.currency?.trim().toUpperCase();
  if (currency && BY_CURRENCY[currency]) return BY_CURRENCY[currency];
  const own = (b.whatsapp_number ?? '').replace(/\D/g, '');
  return KNOWN_CODES.find((c) => own.startsWith(c)) ?? null;
}

/** Digits for a wa.me link, or null when the number can't be used (needsCode: local number, no country code known). */
export function whatsappNumber(phone: string | null | undefined, code: string | null): { digits: string | null; needsCode: boolean } {
  const raw = (phone ?? '').trim();
  if (!raw) return { digits: null, needsCode: false };
  let digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) {
    // Already international.
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0')) {
    if (!code) return { digits: null, needsCode: true };
    digits = code + digits.replace(/^0+/, '');
  } else if (code && digits.length <= 9 && !digits.startsWith(code)) {
    digits = code + digits;
  }
  if (digits.length < 8 || digits.length > 15) return { digits: null, needsCode: false };
  return { digits, needsCode: false };
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function dayLabel(iso: string): string {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** The order as a WhatsApp message (the same words as the website), which the owner can still edit in WhatsApp. */
export function orderMessage(opts: {
  businessName: string;
  supplierName: string | null;
  lines: { name: string; quantity: number; unit: string | null }[];
  expected: string | null;
  note: string | null;
}): string {
  const out: string[] = [];
  out.push(opts.supplierName ? `Salaam ${opts.supplierName},` : 'Salaam,');
  out.push(`This is ${opts.businessName}. Please send us:`);
  for (const l of opts.lines) out.push(`• ${l.name}: ${fmt(l.quantity)}${l.unit ? ` ${l.unit}` : ''}`);
  if (opts.expected) out.push(`Delivery by ${dayLabel(opts.expected)}, please.`);
  if (opts.note) out.push(opts.note);
  out.push('Thank you.');
  return out.join('\n');
}

export function whatsappLink(digits: string | null, message: string): string {
  return `https://wa.me/${digits ?? ''}?text=${encodeURIComponent(message)}`;
}

// --- What to order, by supplier ------------------------------------------------

export type SupplierGroup = {
  key: string;
  supplierName: string | null;
  supplierPhone: string | null;
  /** Days until delivery, for the expected date. */
  leadDays: number;
  /** Products needing ordering now (Reorder now / Running low). */
  needed: number;
  rows: (ProductRow & { flagged: boolean })[];
};

const supplierKey = (name: string | null) => (name ? name.trim().toLowerCase().replace(/\s+/g, ' ') : 'none');

export async function loadOrderPlanner(businessId: string): Promise<{ groups: SupplierGroup[]; business: OrderBusiness | null }> {
  const [products, { data: drafts }, { data: b }] = await Promise.all([
    loadProductRows(businessId),
    supabase.from('purchase_orders').select('id').eq('business_id', businessId).eq('status', 'draft'),
    supabase.from('businesses').select('name, country, currency, whatsapp_number').eq('id', businessId).maybeSingle(),
  ]);

  // Products on a draft are handled on that draft, not here.
  const inDraft = new Set<string>();
  const draftIds = (drafts ?? []).map((d) => d.id as string);
  if (draftIds.length) {
    const { data: lines } = await supabase.from('purchase_order_lines').select('product_id').eq('business_id', businessId).in('order_id', draftIds);
    for (const l of lines ?? []) inDraft.add(l.product_id as string);
  }

  const groups = new Map<string, SupplierGroup>();
  for (const p of products) {
    if (inDraft.has(p.product_id)) continue;
    const key = supplierKey(p.supplier_name?.trim() || null);
    const flagged = p.risk === 'critical' || p.risk === 'warning';
    // Products without a supplier are only listed when they need ordering.
    if (key === 'none' && !flagged) continue;
    const g = groups.get(key) ?? { key, supplierName: null, supplierPhone: null, leadDays: 0, needed: 0, rows: [] };
    g.supplierName ??= p.supplier_name?.trim() || null;
    g.supplierPhone ??= p.supplier_phone?.trim() || null;
    if (flagged) {
      g.needed += 1;
      g.leadDays = Math.max(g.leadDays, p.lead_time_days ?? DEFAULT_LEAD_TIME_DAYS);
    }
    g.rows.push({ ...p, flagged });
    groups.set(key, g);
  }

  const list = [...groups.values()]
    .map((g) => ({
      ...g,
      leadDays: g.leadDays || Math.max(0, ...g.rows.map((r) => r.lead_time_days ?? DEFAULT_LEAD_TIME_DAYS)),
      rows: g.rows.sort((a, z) => Number(z.flagged) - Number(a.flagged) || (a.days ?? Infinity) - (z.days ?? Infinity) || a.name.localeCompare(z.name)),
    }))
    .sort(
      (a, z) =>
        Number(z.needed > 0) - Number(a.needed > 0) ||
        (a.supplierName === null ? 1 : 0) - (z.supplierName === null ? 1 : 0) ||
        (a.supplierName ?? '').localeCompare(z.supplierName ?? '')
    );
  return {
    groups: list,
    business: b ? { name: b.name as string, country: b.country as string | null, currency: b.currency as string | null, whatsapp_number: b.whatsapp_number as string | null } : null,
  };
}

// --- Create and send -----------------------------------------------------------

/** Creates the order (it goes to the store being worked in) and returns its id. */
export async function createOrder(opts: {
  supplierName: string | null;
  supplierPhone: string | null;
  expected: string;
  note: string | null;
  lines: { product_id: string; quantity: number }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_supplier_name: opts.supplierName,
    p_supplier_phone: opts.supplierPhone,
    p_expected: opts.expected,
    p_note: opts.note,
    p_lines: opts.lines,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function markSent(orderId: string) {
  await supabase.from('purchase_orders').update({ sent_at: new Date().toISOString() }).eq('id', orderId);
}

/** yyyy-mm-dd in the phone's time zone. */
export function localDay(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The business details a WhatsApp order needs (name, and the country code for local numbers). */
export async function loadOrderBusiness(businessId: string): Promise<OrderBusiness | null> {
  const { data } = await supabase.from('businesses').select('name, country, currency, whatsapp_number').eq('id', businessId).maybeSingle();
  return data ? { name: data.name as string, country: data.country as string | null, currency: data.currency as string | null, whatsapp_number: data.whatsapp_number as string | null } : null;
}
