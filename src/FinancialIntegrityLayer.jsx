import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const CLOSED_MONTHS_KEY = 'closed-months';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const GOALS_KEY = 'premium-savings-goals';
const EXPENSES_KEY = 'expenses';
const INCOME_KEYS = new Set(['monthly-incomes', 'incomes']);
const DATE_ARRAY_KEYS = new Set(['expenses', 'monthly-incomes', 'incomes', 'loan-capital-payments']);
const MONTHLY_OBJECT_KEYS = new Set(['monthly-budgets', 'monthlyBudgets']);

const MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

function safeParse(raw, fallback) {
  try {
    const value = JSON.parse(raw);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function localMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function localDateForMonth(month) {
  const now = new Date();
  const [year, monthNumber] = String(month).split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const day = month === localMonthKey() ? now.getDate() : Math.min(now.getDate(), lastDay);
  return `${month}-${String(Math.max(1, day)).padStart(2, '0')}`;
}

function parseMonthLabel(label) {
  const normalized = String(label || '').trim().toLocaleLowerCase('es-GT');
  const match = normalized.match(/([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (!month) return null;
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}

function selectedMonth() {
  const fromDom = parseMonthLabel(document.querySelector('.month-selector-copy strong')?.textContent);
  return fromDom || localStorage.getItem(SELECTED_MONTH_KEY) || localMonthKey();
}

function formatMonth(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function makeId(prefix = 'integrity') {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function fingerprint(items) {
  return JSON.stringify(
    [...items].sort((a, b) => {
      const aKey = `${a?.date || ''}|${a?.id || ''}|${a?.amount || ''}`;
      const bKey = `${b?.date || ''}|${b?.id || ''}|${b?.amount || ''}`;
      return aKey.localeCompare(bKey);
    })
  );
}

function calculateMonthSnapshot(month) {
  const incomesRaw = localStorage.getItem('monthly-incomes') || localStorage.getItem('incomes');
  const incomes = safeParse(incomesRaw, []);
  const expenses = safeParse(localStorage.getItem(EXPENSES_KEY), []);
  const monthIncomes = Array.isArray(incomes)
    ? incomes.filter((item) => String(item?.date || '').startsWith(month))
    : [];
  const monthExpenses = Array.isArray(expenses)
    ? expenses.filter((item) => String(item?.date || '').startsWith(month))
    : [];
  const income = monthIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expense = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    income,
    expense,
    balance: income - expense,
    incomeCount: monthIncomes.length,
    expenseCount: monthExpenses.length
  };
}

function readClosedMonths() {
  const value = safeParse(localStorage.getItem(CLOSED_MONTHS_KEY), {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function emitBlocked(month, reason = 'Ese mes está cerrado.') {
  window.dispatchEvent(new CustomEvent('month-write-blocked', {
    detail: { month, reason }
  }));
}

function changedClosedMonthInArray(oldValue, nextValue, closedMonths) {
  const before = Array.isArray(oldValue) ? oldValue : [];
  const after = Array.isArray(nextValue) ? nextValue : [];
  return Object.keys(closedMonths).find((month) => {
    const beforeMonth = before.filter((item) => String(item?.date || '').startsWith(month));
    const afterMonth = after.filter((item) => String(item?.date || '').startsWith(month));
    return fingerprint(beforeMonth) !== fingerprint(afterMonth);
  });
}

function changedClosedMonthInObject(oldValue, nextValue, closedMonths) {
  const before = oldValue && typeof oldValue === 'object' ? oldValue : {};
  const after = nextValue && typeof nextValue === 'object' ? nextValue : {};
  return Object.keys(closedMonths).find(
    (month) => JSON.stringify(before[month] ?? null) !== JSON.stringify(after[month] ?? null)
  );
}

function installStorageIntegrityGuard() {
  if (window.__MI_PRESUPUESTO_INTEGRITY_INSTALLED__) return;
  window.__MI_PRESUPUESTO_INTEGRITY_INSTALLED__ = true;

  const nativeSetItem = Storage.prototype.setItem;
  const nativeGetItem = Storage.prototype.getItem;

  Storage.prototype.setItem = function integritySetItem(key, value) {
    if (this !== window.localStorage || window.__MI_PRESUPUESTO_STORAGE_BYPASS__) {
      return nativeSetItem.call(this, key, value);
    }

    const storageKey = String(key);
    if (storageKey === CLOSED_MONTHS_KEY) {
      return nativeSetItem.call(this, storageKey, value);
    }

    const closedMonths = safeParse(nativeGetItem.call(this, CLOSED_MONTHS_KEY), {});
    const validClosedMonths = closedMonths && typeof closedMonths === 'object' ? closedMonths : {};
    const oldRaw = nativeGetItem.call(this, storageKey);
    const oldValue = safeParse(oldRaw, DATE_ARRAY_KEYS.has(storageKey) ? [] : {});
    const nextValue = safeParse(value, DATE_ARRAY_KEYS.has(storageKey) ? [] : {});

    if (DATE_ARRAY_KEYS.has(storageKey)) {
      const blockedMonth = changedClosedMonthInArray(oldValue, nextValue, validClosedMonths);
      if (blockedMonth) {
        emitBlocked(blockedMonth, 'Los movimientos de un mes cerrado son de solo lectura.');
        window.setTimeout(() => window.location.reload(), 220);
        return undefined;
      }
    }

    if (MONTHLY_OBJECT_KEYS.has(storageKey)) {
      const blockedMonth = changedClosedMonthInObject(oldValue, nextValue, validClosedMonths);
      if (blockedMonth) {
        emitBlocked(blockedMonth, 'El presupuesto de un mes cerrado ya no puede modificarse.');
        window.setTimeout(() => window.location.reload(), 220);
        return undefined;
      }
    }

    if (storageKey === 'budgets') {
      const month = selectedMonth();
      if (validClosedMonths[month] && oldRaw !== String(value)) {
        emitBlocked(month, 'El presupuesto de un mes cerrado ya no puede modificarse.');
        window.setTimeout(() => window.location.reload(), 220);
        return undefined;
      }
    }

    if (storageKey === GOALS_KEY) {
      const month = selectedMonth();
      const oldGoals = Array.isArray(oldValue) ? oldValue : safeParse(oldRaw, []);
      const nextGoals = Array.isArray(nextValue) ? nextValue : safeParse(value, []);
      const oldById = new Map(oldGoals.map((goal) => [String(goal.id), goal]));
      const contributions = [];

      for (const goal of nextGoals) {
        const previous = oldById.get(String(goal.id));
        if (!previous) continue;
        const delta = Number(goal.saved || 0) - Number(previous.saved || 0);
        if (delta > 0.001) contributions.push({ goal, delta });
      }

      if (contributions.length && validClosedMonths[month]) {
        emitBlocked(month, 'No puedes agregar aportes a metas dentro de un mes cerrado.');
        window.setTimeout(() => window.location.reload(), 220);
        return undefined;
      }

      const result = nativeSetItem.call(this, storageKey, value);

      if (contributions.length) {
        const expenses = safeParse(nativeGetItem.call(this, EXPENSES_KEY), []);
        const newExpenses = contributions.map(({ goal, delta }) => ({
          id: makeId('goal-contribution'),
          category: 'Ahorro',
          amount: Number(delta.toFixed(2)),
          date: localDateForMonth(month),
          note: `Aporte a meta · ${goal.name || 'Meta de ahorro'}`,
          savingsGoalId: goal.id,
          savingsTransfer: true,
          createdAt: new Date().toISOString()
        }));
        nativeSetItem.call(this, EXPENSES_KEY, JSON.stringify([...newExpenses, ...(Array.isArray(expenses) ? expenses : [])]));
        window.dispatchEvent(new CustomEvent('budget-data-changed'));
        window.dispatchEvent(new CustomEvent('goal-contribution-recorded', {
          detail: { month, total: contributions.reduce((sum, item) => sum + item.delta, 0) }
        }));
        window.setTimeout(() => window.location.reload(), 260);
      }

      return result;
    }

    return nativeSetItem.call(this, storageKey, value);
  };
}

export default function FinancialIntegrityLayer() {
  const [host, setHost] = useState(null);
  const [month, setMonth] = useState(selectedMonth);
  const [closedMonths, setClosedMonths] = useState(readClosedMonths);
  const [message, setMessage] = useState('');

  useEffect(() => {
    installStorageIntegrityGuard();

    let mountedHost = document.getElementById('month-close-host');
    if (!mountedHost) {
      mountedHost = document.createElement('div');
      mountedHost.id = 'month-close-host';
      const selector = document.querySelector('.month-selector');
      if (selector?.parentNode) selector.parentNode.insertBefore(mountedHost, selector.nextSibling);
      else document.body.appendChild(mountedHost);
    }
    setHost(mountedHost);

    const refresh = () => {
      setMonth(selectedMonth());
      setClosedMonths(readClosedMonths());
    };

    const handleBlocked = (event) => {
      const blockedMonth = event.detail?.month || selectedMonth();
      setMessage(`${formatMonth(blockedMonth)} está cerrado. Reábrelo para modificar registros.`);
      window.setTimeout(() => setMessage(''), 3600);
    };

    const handleContribution = (event) => {
      setMessage(`Aporte a meta registrado y descontado del disponible: ${currency.format(event.detail?.total || 0)}.`);
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener('month-write-blocked', handleBlocked);
    window.addEventListener('goal-contribution-recorded', handleContribution);

    const monthNode = document.querySelector('.month-selector-copy strong');
    const observer = monthNode ? new MutationObserver(() => window.setTimeout(refresh, 0)) : null;
    observer?.observe(monthNode, { childList: true, characterData: true, subtree: true });

    const captureSubmit = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.matches('.capital-payment-form')) {
        const paymentDate = form.querySelector('input[type="date"]')?.value;
        const paymentMonth = String(paymentDate || '').slice(0, 7);
        if (paymentMonth && readClosedMonths()[paymentMonth]) {
          event.preventDefault();
          event.stopImmediatePropagation();
          emitBlocked(paymentMonth, 'No puedes registrar un abono a capital en un mes cerrado.');
        }
      }
    };

    const captureClick = (event) => {
      const button = event.target?.closest?.('button');
      if (!button) return;

      if (button.matches('.capital-history-heading .secondary-button')) {
        const latest = safeParse(localStorage.getItem('loan-capital-payments'), [])[0];
        const paymentMonth = String(latest?.date || '').slice(0, 7);
        if (paymentMonth && readClosedMonths()[paymentMonth]) {
          event.preventDefault();
          event.stopImmediatePropagation();
          emitBlocked(paymentMonth, 'No puedes deshacer un abono perteneciente a un mes cerrado.');
          return;
        }
      }

      if (button.matches('.finance-apply-button')) {
        const selected = selectedMonth();
        if (readClosedMonths()[selected]) {
          event.preventDefault();
          event.stopImmediatePropagation();
          emitBlocked(selected, 'No puedes registrar recurrentes dentro de un mes cerrado.');
        }
      }
    };

    document.addEventListener('submit', captureSubmit, true);
    document.addEventListener('click', captureClick, true);

    refresh();
    return () => {
      observer?.disconnect();
      document.removeEventListener('submit', captureSubmit, true);
      document.removeEventListener('click', captureClick, true);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
      window.removeEventListener('month-write-blocked', handleBlocked);
      window.removeEventListener('goal-contribution-recorded', handleContribution);
    };
  }, []);

  const closed = Boolean(closedMonths[month]);
  const snapshot = useMemo(() => calculateMonthSnapshot(month), [month, closedMonths]);
  const closedSnapshot = closedMonths[month]?.snapshot || null;

  function closeMonth() {
    const latestSnapshot = calculateMonthSnapshot(month);
    const confirmed = window.confirm(
      `¿Cerrar ${formatMonth(month)}?\n\nIngresos: ${currency.format(latestSnapshot.income)}\nSalidas: ${currency.format(latestSnapshot.expense)}\nBalance: ${currency.format(latestSnapshot.balance)}\n\nDespués de cerrarlo, los movimientos y el presupuesto de este mes quedarán en modo lectura.`
    );
    if (!confirmed) return;

    const next = {
      ...readClosedMonths(),
      [month]: {
        closedAt: new Date().toISOString(),
        snapshot: latestSnapshot
      }
    };
    localStorage.setItem(CLOSED_MONTHS_KEY, JSON.stringify(next));
    setClosedMonths(next);
    setMessage(`${formatMonth(month)} cerrado correctamente.`);
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
  }

  function reopenMonth() {
    const confirmed = window.confirm(
      `¿Reabrir ${formatMonth(month)}? Podrás volver a agregar, editar o eliminar movimientos de ese mes.`
    );
    if (!confirmed) return;

    const next = { ...readClosedMonths() };
    delete next[month];
    localStorage.setItem(CLOSED_MONTHS_KEY, JSON.stringify(next));
    setClosedMonths(next);
    setMessage(`${formatMonth(month)} volvió a estar abierto.`);
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
  }

  if (!host) return null;

  return createPortal(
    <>
      <section className={`month-close-control ${closed ? 'is-closed' : 'is-open'}`} aria-label="Control de cierre mensual">
        <div className="month-close-copy">
          <span>{closed ? 'MES CERRADO' : 'CONTROL MENSUAL'}</span>
          <strong>{closed ? `${formatMonth(month)} · solo lectura` : `${formatMonth(month)} · abierto`}</strong>
          <small>
            {closed && closedSnapshot
              ? `Cierre: ${currency.format(closedSnapshot.income)} ingresos · ${currency.format(closedSnapshot.expense)} salidas · ${currency.format(closedSnapshot.balance)} balance`
              : `Actual: ${currency.format(snapshot.income)} ingresos · ${currency.format(snapshot.expense)} salidas · ${currency.format(snapshot.balance)} disponible neto`}
          </small>
        </div>
        <button type="button" className={closed ? 'month-reopen-button' : 'month-close-button'} onClick={closed ? reopenMonth : closeMonth}>
          {closed ? 'Reabrir mes' : 'Cerrar mes'}
        </button>
      </section>
      {message && <div className="month-integrity-toast" role="status">{message}</div>}
    </>,
    host
  );
}
