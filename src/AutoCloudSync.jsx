import { useEffect, useRef, useState } from 'react';
import {
  AUTO_SYNC_KEY,
  STORAGE_KEYS,
  cloudConfigured,
  getSession,
  markLocalChange,
  onAuthStateChange,
  reconcileCloudData,
  subscribeToCloudChanges
} from './cloudSync';

const LOCAL_CHANGE_EVENT = 'mi-presupuesto-local-change';

function dispatchLocalChange(key) {
  if (!STORAGE_KEYS.includes(key)) return;
  markLocalChange();
  window.dispatchEvent(new CustomEvent(LOCAL_CHANGE_EVENT, { detail: { key } }));
}

export default function AutoCloudSync() {
  const [session, setSession] = useState(null);
  const syncingRef = useRef(false);
  const reloadPendingRef = useRef(false);

  useEffect(() => {
    if (!cloudConfigured) return undefined;

    getSession().then(setSession).catch(() => {});
    return onAuthStateChange(setSession);
  }, []);

  useEffect(() => {
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      originalSetItem.call(this, key, value);
      if (this === window.localStorage) dispatchLocalChange(key);
    };

    Storage.prototype.removeItem = function patchedRemoveItem(key) {
      originalRemoveItem.call(this, key);
      if (this === window.localStorage) dispatchLocalChange(key);
    };

    return () => {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    };
  }, []);

  useEffect(() => {
    if (!cloudConfigured || !session?.user || localStorage.getItem(AUTO_SYNC_KEY) !== 'true') {
      return undefined;
    }

    let debounceTimer;

    async function syncNow({ reloadOnDownload = true } = {}) {
      if (syncingRef.current || !navigator.onLine) return;
      syncingRef.current = true;

      try {
        const result = await reconcileCloudData();
        window.dispatchEvent(new CustomEvent('mi-presupuesto-sync-status', { detail: { result } }));

        if (result === 'downloaded' && reloadOnDownload && !reloadPendingRef.current) {
          reloadPendingRef.current = true;
          window.setTimeout(() => window.location.reload(), 250);
        }
      } catch (error) {
        window.dispatchEvent(new CustomEvent('mi-presupuesto-sync-status', {
          detail: { result: 'error', message: error.message }
        }));
      } finally {
        syncingRef.current = false;
      }
    }

    function scheduleUpload() {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => syncNow({ reloadOnDownload: false }), 1200);
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') syncNow();
    }

    const unsubscribeRealtime = subscribeToCloudChanges(session.user.id, () => syncNow());

    window.addEventListener(LOCAL_CHANGE_EVENT, scheduleUpload);
    window.addEventListener('online', syncNow);
    window.addEventListener('focus', syncNow);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(syncNow, 15000);
    syncNow();

    return () => {
      window.clearTimeout(debounceTimer);
      window.clearInterval(interval);
      unsubscribeRealtime();
      window.removeEventListener(LOCAL_CHANGE_EVENT, scheduleUpload);
      window.removeEventListener('online', syncNow);
      window.removeEventListener('focus', syncNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [session]);

  return null;
}
