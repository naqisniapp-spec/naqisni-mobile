/**
 * Alert settings — the same columns naqisni.com saves on My account
 * (alert_channels, notification_email, whatsapp_number; AccountForm.tsx) and
 * Alert settings (alert_level, quiet_start, quiet_end; AlertRulesForm.tsx).
 * Only the owner can change them (the database rules decide).
 */
import { supabase } from '@/lib/supabase';

export type AlertSettings = {
  channels: string[];
  email: boolean;
  notificationEmail: string;
  whatsapp: boolean;
  whatsappNumber: string;
  level: 'all' | 'critical';
  quietOn: boolean;
  quietStart: number;
  quietEnd: number;
};

export async function loadAlertSettings(businessId: string): Promise<AlertSettings> {
  const { data, error } = await supabase
    .from('businesses')
    .select('alert_channels, notification_email, whatsapp_number, alert_level, quiet_start, quiet_end')
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const channels: string[] = Array.isArray(data?.alert_channels) ? (data.alert_channels as string[]) : [];
  const quiet = data?.quiet_start !== null && data?.quiet_start !== undefined && data?.quiet_end !== null && data?.quiet_end !== undefined;
  return {
    channels,
    email: channels.includes('email'),
    notificationEmail: (data?.notification_email as string | null) ?? '',
    whatsapp: channels.includes('whatsapp'),
    whatsappNumber: data?.whatsapp_number ? `+${String(data.whatsapp_number).replace(/^\+/, '')}` : '',
    level: data?.alert_level === 'critical' ? 'critical' : 'all',
    quietOn: quiet,
    quietStart: quiet ? Number(data!.quiet_start) : 21,
    quietEnd: quiet ? Number(data!.quiet_end) : 7,
  };
}

/** The website's normalizeWhatsApp: digits with the country code, no plus. */
function normalizeWhatsApp(value: string): string {
  let digits = value.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) throw new Error('whatsappCode');
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) throw new Error('whatsappBad');
  return digits;
}

export async function saveAlertSettings(businessId: string, initial: AlertSettings, v: AlertSettings) {
  if (v.email && !v.notificationEmail.trim()) throw new Error('needEmail');
  let whatsapp: string | null = null;
  if (v.whatsappNumber.trim()) whatsapp = normalizeWhatsApp(v.whatsappNumber);
  else if (v.whatsapp) throw new Error('needWhatsApp');
  if (v.quietOn && v.quietStart === v.quietEnd) throw new Error('quietSame');

  // Keep any other channels already set; only add or remove these two.
  const channels = initial.channels.filter((c) => c !== 'email' && c !== 'whatsapp');
  if (v.email) channels.push('email');
  if (v.whatsapp) channels.push('whatsapp');

  const { error } = await supabase
    .from('businesses')
    .update({
      alert_channels: channels,
      notification_email: v.notificationEmail.trim() || null,
      whatsapp_number: whatsapp,
      alert_level: v.level,
      quiet_start: v.quietOn ? v.quietStart : null,
      quiet_end: v.quietOn ? v.quietEnd : null,
    })
    .eq('id', businessId);
  if (error) throw new Error(error.message);
}
