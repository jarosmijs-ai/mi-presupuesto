import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const RECURRING_KEY = 'premium-recurring-expenses';
const EXPENSE_KEY = 'expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const CLOSED_MONTHS_KEY = 'closed-months';

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

function safeArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function currentMonthKey() {
  return localToday().slice(0, 7);
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
  const domLabel = document.querySelector('.month-selector-copy strong')?.textContent;
  return parseMonthLabel(domLabel) || localStorage.getItem(SELECTED_MONTH_KEY) || currentMonthKey();
}

function paymentDate(month, day) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), lastDay);
  return `${month}-${String(safeDay).padStart(2, '0')}`;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatMonth(month) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  return new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function paymentStatus(item, month, paid) {
  if (paid) return { key: 'paid', label: 'Pagado' };
  if (month !== currentMonthKey()) return { key: 'pending', label: 'Pendiente' };
  const today = new Date().getDate();
  const dueDay = Number(item.day || 1);
  if (dueDay < today) return { key: 'overdue', label: 'Vencido' };
  if (dueDay === today) return { key: 'today', label: 'Vence hoy' };
  return { key: 'upcoming', label: 'Próximo' };
}

function getSnapshot() {
  const month = selectedMonth();
  const recurring = safeArray(RECURRING_KEY)
    .filter((item) => item.active !== false)
    .sort((a, b) => Number(a.day || 1) - Number(b.day || 1));
  const expenses = safeArray(EXPENSE_KEY);
  const paidByRecurringId = new Map();

  expenses
    .filter((item) => String(item.date || '').startsWith(month) && item.recurringId)
    .forEach((item) => paidByRecurringId.set(String(item.recurringId), item));

  const rows = recurring.map((item) => {
    const expense = paidByRecurringId.get(String(item.id));
    return {
      item,
      expense,
      status: paymentStatus(item, month, Boolean(expense))
    };
  });

  return {
    month,
    rows,
    closed: Boolean(safeObject(CLOSED_MONTHS_KEY)[month])
  };
}

export default function QuickPaymentsPanel() {
  const [host, setHost] = useState(null);
  const [snapshot, setSnapshot] = useState(getSnapshot);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mountedHost = null;

    const refresh = () => setSnapshot(getSnapshot());

    const ensureHost = () => {
      const form = document.querySelector('.ux-sheet .ux-quick-form');
      if (!form) {
        if (mountedHost && !mountedHost.isConnected) {
          mountedHost = null;
          setHost(null);
        }
        return;
      }

      const existing = document.getElementById('quick-payments-host');
      if (existing) {
        if (mountedHost !== existing) {
          mountedHost = existing;
          setHost(existing);
          refresh();
        }
        return;
      }

      const node = document.createElement('div');
      node.id = 'quick-payments-host';
      form.parentNode?.insertBefore(node, form);
      mountedHost = node;
      setHost(node);
      refresh();
    };

    ensureHost();
    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener('recurring-payments-normalized', refresh);

    const monthNode = document.querySelector('.month-selector-copy strong');
    const monthObserver = monthNode
      ? new MutationObserver(() => window.setTimeout(refresh, 0))
      : null;
    monthObserver?.observe(monthNode, { childList: true, characterData: true, subtree: true });

    return () => {
      observer.disconnect();
      monthObserver?.disconnect();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
      window.removeEventListener('recurring-payments-normalized', refresh);
    };
  }, []);

  const remainingTotal = useMemo(
    () => snapshot.rows
      .filter((row) => row.status.key !== 'paid')
      .reduce((sum, row) => sum + Number(row.item.amount || 0), 0),
    [snapshot]
  );

  const paidCount = snapshot.rows.filter((row) => row.status.key === 'paid').length;

  function refresh() {
    setSnapshot(getSnapshot());
  }

  function markPaid(row) {
    if (snapshot.closed) {
      setMessage(`${formatMonth(snapshot.month)} está cerrado. Reábrelo para registrar pagos.`);
      return;
    }
    if (row.status.key === 'paid') return;

    const item = row.item;
    const expenses = safeArray(EXPENSE_KEY);
    const expense = {
      id: createId(),
      amount: Number(item.amount || 0),
      category: item.category || 'Recurrente',
      note: item.loanSplit
        ? `${item.name} · cuota regular`
        : item.name || item.title || item.description || 'Pago recurrente',
      date: paymentDate(snapshot.month, item.day),
      recurringId: item.id,
      recurringSourceId: item.loanSourceId || item.id,
      regularLoanPayment: Boolean(item.loanSplit),
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(EXPENSE_KEY, JSON.stringify([expense, ...expenses]));
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
    setMessage(`${item.name || 'Pago'} marcado como pagado por ${currency.format(item.amount)}.`);
    refresh();
  }

  function undoPaid(row) {
    if (snapshot.closed) {
      setMessage(`${formatMonth(snapshot.month)} está cerrado. Reábrelo para modificar pagos.`);
      return;
    }
    if (!row.expense) return;

    const expenses = safeArray(EXPENSE_KEY).filter((expense) => expense.id !== row.expense.id);
    localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
    setMessage(`Se deshizo ${row.item.name || 'el pago'}.`);
    refresh();
  }

  if (!host) return null;

  return createPortal(
    <>
      <section className="smart-payments-card" aria-label="Pagos programados del mes">
        <div className="smart-payments-heading">
          <div>
            <span>PAGOS DEL MES</span>
            <h3>Solo confirma lo que ya pagaste</h3>
            <small>{paidCount} de {snapshot.rows.length} confirmado{snapshot.rows.length === 1 ? '' : 's'}</small>
          </div>
          <div className="smart-payments-total">
            <span>Pendiente</span>
            <strong>{currency.format(remainingTotal)}</strong>
          </div>
        </div>

        {snapshot.closed && (
          <div className="smart-payments-closed">{formatMonth(snapshot.month)} está cerrado y estos pagos son de solo lectura.</div>
        )}

        <div className="smart-payments-list">
          {snapshot.rows.length ? snapshot.rows.map((row) => (
            <article key={row.item.id} className={`smart-payment-row is-${row.status.key}`}>
              <div className="smart-payment-main">
                <div>
                  <strong>{row.item.name || row.item.title || 'Pago recurrente'}</strong>
                  <small>
                    {row.item.category || 'Recurrente'} · día {Number(row.item.day || 1)}
                    {row.item.loanSplit ? ' · cuota regular' : ''}
                  </small>
                </div>
                <strong>{currency.format(row.item.amount)}</strong>
              </div>
              <div className="smart-payment-actions">
                <span className={`smart-payment-status is-${row.status.key}`}>{row.status.label}</span>
                {row.status.key === 'paid'
                  ? <button type="button" className="smart-payment-undo" onClick={() => undoPaid(row)} disabled={snapshot.closed}>Deshacer</button>
                  : <button type="button" className="smart-payment-confirm" onClick={() => markPaid(row)} disabled={snapshot.closed}>✓ Ya se pagó</button>}
              </div>
            </article>
          )) : (
            <p className="smart-payments-empty">No hay pagos recurrentes activos. Puedes configurarlos desde Plan y metas.</p>
          )}
        </div>

        {snapshot.rows.some((row) => row.item.loanSplit) && (
          <p className="smart-loan-note">El préstamo muestra únicamente las 2 cuotas regulares. Los abonos extra a capital continúan registrándose en la sección Préstamo.</p>
        )}

        {message && <div className="smart-payment-message">{message}</div>}
      </section>

      <div className="smart-payments-divider"><span>OTRO GASTO NO PROGRAMADO</span></div>
    </>,
    host
  );
}
