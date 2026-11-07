/**
 * Customer support — the same tickets and chats as naqisni.com's Customer
 * support page (naqisni-web src/lib/support.ts, migration 0058):
 * one ticket per problem, plus the General chat (messages without a ticket).
 */
import { supabase, webApi } from '@/lib/supabase';

export type Ticket = {
  id: string;
  number: number;
  title: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at: string | null;
  close_note: string | null;
  last_message_at: string | null;
  last_sender: 'customer' | 'admin' | null;
  last_preview: string | null;
  customer_last_read_at: string | null;
};

export type Message = {
  id: string;
  business_id: string;
  sender: 'customer' | 'admin';
  body: string;
  attachment_path: string | null;
  created_at: string;
  channel?: 'web' | 'whatsapp' | null;
  ticket_id?: string | null;
};

const TICKET_FIELDS = 'id, number, title, status, opened_at, closed_at, close_note, last_message_at, last_sender, last_preview, customer_last_read_at';
const MESSAGE_FIELDS = 'id, business_id, sender, body, attachment_path, created_at, channel, ticket_id';
const BUCKET = 'support-attachments';
export const MAX_MESSAGE_LENGTH = 4000;

/** "14:05" today, otherwise "7 Nov". */
export function shortWhen(iso: string, lang: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return d.toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', sameDay ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' });
}

/** True when Naqisni wrote last and the customer hasn't opened it since. */
export function ticketUnread(t: Ticket) {
  if (!t.last_message_at || t.last_sender !== 'admin') return false;
  return !t.customer_last_read_at || t.customer_last_read_at < t.last_message_at;
}

export async function loadSupport(businessId: string) {
  const [{ data: tickets, error }, { data: general }, { data: thread }] = await Promise.all([
    supabase.from('admin_tickets').select(TICKET_FIELDS).eq('business_id', businessId).eq('source', 'customer').order('opened_at', { ascending: false }).limit(200),
    supabase
      .from('support_messages')
      .select('body, sender, created_at, attachment_path')
      .eq('business_id', businessId)
      .is('ticket_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('support_threads').select('last_sender, last_message_at, customer_last_read_at').eq('business_id', businessId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  const list = (tickets ?? []) as Ticket[];
  list.sort((a, b) => (a.status === b.status ? 0 : a.status === 'open' ? -1 : 1));
  const generalUnread = Boolean(
    thread?.last_sender === 'admin' && thread.last_message_at && (!thread.customer_last_read_at || thread.customer_last_read_at < thread.last_message_at)
  );
  return { tickets: list, general, generalUnread };
}

/** How many tickets/chats have a reply the customer hasn't read (for the More tab). */
export async function unreadCount(businessId: string) {
  const { tickets, generalUnread } = await loadSupport(businessId);
  return tickets.filter(ticketUnread).length + (generalUnread ? 1 : 0);
}

export async function loadTicket(id: string) {
  const { data } = await supabase.from('admin_tickets').select(TICKET_FIELDS).eq('id', id).eq('source', 'customer').maybeSingle();
  return (data as Ticket | null) ?? null;
}

/** A chat's newest messages, oldest first. ticketId null = General chat. */
export async function loadMessages(businessId: string, ticketId: string | null) {
  let q = supabase.from('support_messages').select(MESSAGE_FIELDS).eq('business_id', businessId);
  q = ticketId ? q.eq('ticket_id', ticketId) : q.is('ticket_id', null);
  const { data, error } = await q.order('created_at', { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  const messages = ((data ?? []) as Message[]).reverse();
  const paths = messages.map((m) => m.attachment_path).filter((p): p is string => Boolean(p));
  const pictures: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) pictures[s.path] = s.signedUrl;
  }
  return { messages, pictures };
}

export async function markRead(ticketId: string | null) {
  await supabase.rpc('support_mark_read');
  if (ticketId) await supabase.rpc('support_ticket_mark_read', { t_id: ticketId });
}

/** Lets naqisni.com email Naqisni later if nobody reads the message (same as the website). */
function notify(messageId: string) {
  webApi('/api/support/notify', { messageId }).catch(() => undefined);
}

export async function sendMessage(businessId: string, ticketId: string | null, body: string): Promise<Message> {
  const { data, error } = await supabase
    .from('support_messages')
    .insert({ business_id: businessId, sender: 'customer', body, ...(ticketId ? { ticket_id: ticketId } : {}) })
    .select(MESSAGE_FIELDS)
    .single();
  if (error) throw new Error(error.message.includes('Too many messages') ? 'too_many' : 'not_sent');
  notify((data as Message).id);
  return data as Message;
}

export async function openTicket(title: string, body: string): Promise<string> {
  const { data, error } = await supabase.rpc('support_open_ticket', { p_title: title, p_body: body });
  if (error || typeof data !== 'string') {
    const known = ['Too many new tickets', '20 open tickets', 'too long', 'short title'];
    throw new Error(error && known.some((k) => error.message.includes(k)) ? error.message : 'not_opened');
  }
  const { data: first } = await supabase.from('support_messages').select('id').eq('ticket_id', data).limit(1).maybeSingle();
  if (first?.id) notify(first.id);
  return data;
}

export async function setTicketStatus(id: string, status: 'open' | 'closed') {
  const { error } = await supabase.rpc('support_ticket_set_status', { t_id: id, p_status: status });
  if (error) throw new Error(error.message);
}

/** New messages in one chat as they arrive. Returns the unsubscribe function. */
export function watchMessages(businessId: string, ticketId: string | null, onMessage: (m: Message) => void) {
  const channel = supabase
    .channel(`support:${businessId}:${ticketId ?? 'general'}:mobile`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `business_id=eq.${businessId}` }, (payload) => {
      const m = payload.new as Message;
      if ((m.ticket_id ?? null) === ticketId) onMessage(m);
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
