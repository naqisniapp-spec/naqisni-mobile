/**
 * Notifications inbox: every message Naqisni sent from
 * naqisni.com/admin/mobile → Notifications to this customer
 * (naqisni-web migration 0069). Read state is kept per person.
 */
import type { Href } from 'expo-router';

import type { Lang } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export type InboxMessage = {
  id: string;
  title: string;
  body: string;
  title_ar: string | null;
  body_ar: string | null;
  open_url: string | null;
  created_at: string;
  read: boolean;
};

export async function loadInbox(): Promise<InboxMessage[]> {
  const { data, error } = await supabase.rpc('my_mobile_inbox', { p_limit: 100 });
  if (error) throw new Error(error.message);
  return (data ?? []) as InboxMessage[];
}

export async function inboxUnread(): Promise<number> {
  const { data, error } = await supabase.rpc('my_mobile_inbox_unread');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

/** `ids` empty = every message. */
export async function markInboxRead(ids?: string[]) {
  await supabase.rpc('mark_mobile_inbox_read', { p_ids: ids?.length ? ids : null });
}

export function messageTitle(m: InboxMessage, lang: Lang) {
  return (lang === 'ar' && m.title_ar?.trim()) || m.title;
}

export function messageBody(m: InboxMessage, lang: Lang) {
  return (lang === 'ar' && m.body_ar?.trim()) || m.body;
}

/** The page the admin chose for "Tapping it opens"; null for the Overview. */
export function messageTarget(m: InboxMessage): Href | null {
  switch (m.open_url) {
    case '/alerts':
      return '/alerts';
    case '/products':
      return '/products';
    case '/orders':
      return '/orders';
    case '/support':
      return '/support';
    case '/more':
      return '/more';
    default:
      return null;
  }
}
