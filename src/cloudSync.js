import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anonKey);
export const supabase = cloudConfigured ? createClient(url, anonKey) : null;

const STORAGE_KEYS = [
  'income',
  'expenses',
  'incomes',
  'monthlyBudgets',
  'premium-recurring-expenses',
  'premium-savings-goals',
  'app-settings'
];

export function collectLocalData() {
  const payload = {};
  for (const key of STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) payload[key] = value;
  }
  return payload;
}

export function restoreLocalData(payload = {}) {
  for (const [key, value] of Object.entries(payload)) {
    if (STORAGE_KEYS.includes(key) && typeof value === 'string') {
      localStorage.setItem(key, value);
    }
  }
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function pushBackup() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const session = await getSession();
  if (!session?.user) throw new Error('Inicia sesión primero.');

  const { error } = await supabase
    .from('user_backups')
    .upsert({
      user_id: session.user.id,
      payload: collectLocalData(),
      updated_at: new Date().toISOString()
    });

  if (error) throw error;
}

export async function pullBackup() {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const session = await getSession();
  if (!session?.user) throw new Error('Inicia sesión primero.');

  const { data, error } = await supabase
    .from('user_backups')
    .select('payload, updated_at')
    .eq('user_id', session.user.id)
    .single();

  if (error) throw error;
  restoreLocalData(data.payload);
  return data.updated_at;
}
