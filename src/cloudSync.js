import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const cloudConfigured = Boolean(url && anonKey);
export const supabase = cloudConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const AUTO_SYNC_KEY = 'cloud-auto-sync-enabled';
export const LAST_LOCAL_CHANGE_KEY = 'cloud-last-local-change';
export const LAST_APPLIED_REMOTE_KEY = 'cloud-last-applied-remote';

const DEVICE_ID_KEY = 'cloud-device-id';

export const STORAGE_KEYS = [
  'income',
  'expenses',
  'incomes',
  'monthly-incomes',
  'budgets',
  'monthlyBudgets',
  'premium-recurring-expenses',
  'premium-savings-goals',
  'premium-onboarding-complete',
  'app-settings',
  'ux-selected-month',
  'financial-history-baseline',
  'loan-calculator-state'
];

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = createId();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function markLocalChange() {
  localStorage.setItem(LAST_LOCAL_CHANGE_KEY, new Date().toISOString());
}

export function hasMeaningfulLocalData() {
  const expenses = localStorage.getItem('expenses');
  const incomes = localStorage.getItem('monthly-incomes') || localStorage.getItem('incomes');
  const budgets = localStorage.getItem('monthlyBudgets') || localStorage.getItem('budgets');

  return [expenses, incomes, budgets].some((raw) => {
    if (!raw) return false;
    try {
      const value = JSON.parse(raw);
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === 'object') return Object.keys(value).length > 0;
      return Boolean(value);
    } catch {
      return true;
    }
  });
}

export function collectLocalData() {
  const payload = {};
  for (const key of STORAGE_KEYS) {
    const value = localStorage.getItem(key);
    if (value !== null) payload[key] = value;
  }

  payload.__sync = {
    deviceId: getDeviceId(),
    savedAt: new Date().toISOString(),
    version: 2
  };

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
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('La sincronización en la nube todavía no está configurada.');
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('La sincronización en la nube todavía no está configurada.');
  return supabase.auth.signInWithPassword({ email, password });
}

export async function sendMagicLink(email) {
  if (!supabase) throw new Error('La sincronización en la nube todavía no está configurada.');
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });
}

export async function signOut() {
  localStorage.removeItem(AUTO_SYNC_KEY);
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getCloudSnapshot() {
  if (!supabase) throw new Error('La sincronización en la nube todavía no está configurada.');
  const session = await getSession();
  if (!session?.user) throw new Error('Inicia sesión primero.');

  const { data, error } = await supabase
    .from('user_backups')
    .select('payload, updated_at')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function pushBackup() {
  if (!supabase) throw new Error('La sincronización en la nube todavía no está configurada.');
  const session = await getSession();
  if (!session?.user) throw new Error('Inicia sesión primero.');

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('user_backups')
    .upsert(
      {
        user_id: session.user.id,
        payload: collectLocalData(),
        updated_at: updatedAt
      },
      { onConflict: 'user_id' }
    );

  if (error) throw error;
  localStorage.setItem(LAST_APPLIED_REMOTE_KEY, updatedAt);
  localStorage.setItem(AUTO_SYNC_KEY, 'true');
  return updatedAt;
}

export async function pullBackup() {
  const data = await getCloudSnapshot();
  if (!data?.payload) throw new Error('Todavía no existe información sincronizada para esta cuenta.');

  restoreLocalData(data.payload);
  localStorage.setItem(LAST_APPLIED_REMOTE_KEY, data.updated_at || new Date().toISOString());
  localStorage.setItem(AUTO_SYNC_KEY, 'true');
  return data.updated_at;
}

export async function enableAutoSyncUsingLocalData() {
  await pushBackup();
  return true;
}

export async function enableAutoSyncUsingCloudData() {
  await pullBackup();
  return true;
}

export function disableAutoSync() {
  localStorage.removeItem(AUTO_SYNC_KEY);
}

export async function reconcileCloudData() {
  if (!cloudConfigured || localStorage.getItem(AUTO_SYNC_KEY) !== 'true') return 'disabled';

  const session = await getSession();
  if (!session?.user) return 'signed-out';

  const remote = await getCloudSnapshot();
  if (!remote) {
    await pushBackup();
    return 'uploaded';
  }

  const remoteTime = Date.parse(remote.updated_at || '') || 0;
  const localTime = Date.parse(localStorage.getItem(LAST_LOCAL_CHANGE_KEY) || '') || 0;
  const appliedTime = Date.parse(localStorage.getItem(LAST_APPLIED_REMOTE_KEY) || '') || 0;
  const remoteDevice = remote.payload?.__sync?.deviceId;

  if (localTime > remoteTime && localTime > appliedTime) {
    await pushBackup();
    return 'uploaded';
  }

  if (remoteTime > appliedTime && remoteDevice !== getDeviceId()) {
    restoreLocalData(remote.payload);
    localStorage.setItem(LAST_APPLIED_REMOTE_KEY, remote.updated_at);
    return 'downloaded';
  }

  return 'current';
}

export function subscribeToCloudChanges(userId, callback) {
  if (!supabase || !userId) return () => {};

  const channel = supabase
    .channel(`budget-sync-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_backups',
        filter: `user_id=eq.${userId}`
      },
      (change) => callback(change)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
