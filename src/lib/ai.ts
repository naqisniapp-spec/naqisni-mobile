/**
 * AI features (naqisni-web /api/ai/*), switched off until Naqisni launches
 * them. The app asks naqisni.com whether they are on for this business; when
 * the answer is anything but yes (off, or the website doesn't have them yet),
 * nothing AI is shown.
 */
import { webApi } from '@/lib/supabase';

export type Insight = { body: string; createdAt: string; cached?: boolean };

let status: Promise<boolean> | null = null;
let statusFor: string | null = null;

/** Asked once per business while the app is open. */
export function aiEnabled(businessId: string): Promise<boolean> {
  if (!status || statusFor !== businessId) {
    statusFor = businessId;
    status = webApi<{ enabled?: boolean }>('/api/ai/status')
      .then((r) => r.enabled === true)
      .catch(() => false);
  }
  return status;
}

export function productInsight(productId: string, lang: 'en' | 'ar', refresh = false): Promise<Insight> {
  return webApi<Insight>('/api/ai/product-insight', { productId, lang, refresh });
}
