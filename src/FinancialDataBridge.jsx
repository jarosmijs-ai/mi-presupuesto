import { useEffect } from 'react';

const PRIMARY_INCOME_KEY = 'monthly-incomes';
const LEGACY_INCOME_KEY = 'incomes';

function readArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function writeInternalStorage(key, value) {
  const previousBypass = window.__MI_PRESUPUESTO_STORAGE_BYPASS__;
  window.__MI_PRESUPUESTO_STORAGE_BYPASS__ = true;

  try {
    localStorage.setItem(key, value);
  } finally {
    window.__MI_PRESUPUESTO_STORAGE_BYPASS__ = previousBypass;
  }
}

function syncIncomeKeys() {
  const primaryIncomes = readArray(PRIMARY_INCOME_KEY);
  const legacyRaw = localStorage.getItem(LEGACY_INCOME_KEY);
  const nextRaw = JSON.stringify(primaryIncomes);

  if (legacyRaw !== nextRaw) {
    // `monthly-incomes` is the canonical source used by the main app. This is an
    // internal compatibility mirror, not a user edit, so it must not be blocked
    // after a month has been closed.
    writeInternalStorage(LEGACY_INCOME_KEY, nextRaw);
    window.dispatchEvent(new CustomEvent('financial-data-synced'));
  }
}

export default function FinancialDataBridge() {
  useEffect(() => {
    syncIncomeKeys();

    const refresh = () => syncIncomeKeys();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
    };
  }, []);

  return null;
}
