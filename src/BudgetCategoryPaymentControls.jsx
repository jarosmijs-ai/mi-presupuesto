import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadLoanSettings } from './loanSettings';

const RECURRING_KEY = 'premium-recurring-expenses';
const EXPENSE_KEY = 'expenses';
const CLOSED_MONTHS_KEY = 'closed-months';
const SELECTED_MONTH_KEY = 'ux-selected-month';

const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
};

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency', currency: 'GTQ', maximumFractionDigits: 2
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

function normalizedText(value) {
  return String(value || '')
    .toLocaleLowerCase('es-GT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseMonthLabel(label) {
  const normalized = String(label || '').trim().toLocaleLowerCase('es-GT');
  const match = normalized.match(/([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1]];
  return month ? `${match[2]}-${String(month).padStart(2, '0')}` : null;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function selectedMonth() {
  const label = document.querySelector('.month-selector-copy strong')?.textContent;
  return parseMonthLabel(label) || localStorage.getItem(SELECTED_MONTH_KEY) || currentMonthKey();
}

function paymentDate(month, day) {
  const [year, monthNumber] = String(month).split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), lastDay);
  return `${month}-${String(safeDay).padStart(2, '0')}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `budget-payment-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isLoan(item) {
  const value = normalizedText(`${item?.category || ''} ${item?.name || ''} ${item?.title || ''}`);
  return value.includes('prestamo');
}

function loanInstallmentAmount() {
  const settings = loadLoanSettings();
  return Number((
    Number(settings.biweeklyPrincipalPayment || 0) +
    Number(settings.biweeklyAdminFee || 0) +
    Number(settings.biweeklyLifeInsurance || 0) +
    Number(settings.biweeklyOtherInsurance || 0)
  ).toFixed(2));
}

function loanFallbackRows(recurring) {
  const loanItems = recurring.filter(isLoan);
  const split = loanItems
    .filter((item) => item.loanSplit)
    .sort((a, b) => Number(a.loanInstallment || 1) - Number(b.loanInstallment || 1));
  if (split.length >= 2) return split.slice(0, 2);

  const source = loanItems[0];
  if (!source) return [];

  const sourceId = source.loanSourceId || source.id;
  const amount = loanInstallmentAmount() || Number((Number(source.amount || 0) / 2).toFixed(2));
  const baseDay = Number(source.loanBaseDay || source.day || 15);
  const firstDay = baseDay <= 15 ? baseDay : Math.max(1, baseDay - 15);
  const secondDay = baseDay <= 15 ? Math.min(31, baseDay + 15) : baseDay;

  return [1, 2].map((installment) => ({
    ...source,
    id: installment === 1 ? sourceId : `${sourceId}::payment-2`,
    name: `Préstamo · pago ${installment} de 2`,
    category: 'Préstamo',
    amount,
    day: installment === 1 ? firstDay : secondDay,
    active: source.active !== false,
    loanSplit: true,
    loanSourceId: sourceId,
    loanInstallment: installment,
    loanInstallmentCount: 2
  }));
}

function paymentsForCategory(category) {
  const recurring = safeArray(RECURRING_KEY).filter((item) => item.active !== false);
  if (normalizedText(category) === 'prestamo') return loanFallbackRows(recurring);

  const normalizedCategory = normalizedText(category);
  return recurring
    .filter((item) => normalizedText(item.category) === normalizedCategory && !isLoan(item))
    .sort((a, b) => Number(a.day || 1) - Number(b.day || 1));
}

function readCategorySnapshot(category) {
  const month = selectedMonth();
  const expenses = safeArray(EXPENSE_KEY);
  const payments = paymentsForCategory(category).map((item) => {
    const expense = expenses.find((candidate) =>
      String(candidate.date || '').startsWith(month) &&
      String(candidate.recurringId || '') === String(item.id)
    );
    return { item, expense, paid: Boolean(expense) };
  });

  return {
    month,
    payments,
    closed: Boolean(safeObject(CLOSED_MONTHS_KEY)[month])
  };
}

function CategoryPaymentActions({ category, host, refreshAll }) {
  const [version, setVersion] = useState(0);
  const [message, setMessage] = useState('');
  const snapshot = useMemo(() => readCategorySnapshot(category), [category, version]);
  const isLoanCategory = normalizedText(category) === 'prestamo';

  function markPaid(row) {
    if (snapshot.closed) {
      setMessage('Mes cerrado · reábrelo para registrar el pago.');
      return;
    }
    if (row.paid) return;

    const item = row.item;
    const expenses = safeArray(EXPENSE_KEY);
    const expense = {
      id: makeId(),
      amount: Number(item.amount || 0),
      category: item.category || category,
      note: item.loanSplit
        ? `${item.name} · cuota regular`
        : `${item.name || category} · pago programado`,
      date: paymentDate(snapshot.month, item.day),
      recurringId: item.id,
      recurringSourceId: item.loanSourceId || item.id,
      regularLoanPayment: Boolean(item.loanSplit),
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(EXPENSE_KEY, JSON.stringify([expense, ...expenses]));
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
    setMessage(`${item.name || category}: ${currency.format(item.amount)} registrado.`);
    setVersion((value) => value + 1);
    refreshAll();
    window.setTimeout(() => window.location.reload(), 260);
  }

  function undoPaid(row) {
    if (snapshot.closed) {
      setMessage('Mes cerrado · reábrelo para modificar el pago.');
      return;
    }
    if (!row.expense) return;

    const expenses = safeArray(EXPENSE_KEY).filter((item) => item.id !== row.expense.id);
    localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
    window.dispatchEvent(new CustomEvent('budget-data-changed'));
    setMessage('Pago deshecho.');
    setVersion((value) => value + 1);
    refreshAll();
    window.setTimeout(() => window.location.reload(), 260);
  }

  function toggleBudgetEdit() {
    const row = host.closest('.budget-row');
    row?.classList.toggle('budget-editing');
    const input = row?.querySelector('.budget-input');
    if (row?.classList.contains('budget-editing')) window.setTimeout(() => input?.focus(), 0);
  }

  const paidCount = snapshot.payments.filter((row) => row.paid).length;

  return (
    <div className={`budget-payment-actions ${isLoanCategory ? 'is-loan' : ''}`}>
      {snapshot.payments.length > 0 ? (
        <>
          <div className="budget-payment-summary">
            <span>{isLoanCategory ? 'CUOTAS REGULARES' : 'PAGO PROGRAMADO'}</span>
            <strong>{paidCount} de {snapshot.payments.length} realizado{snapshot.payments.length === 1 ? '' : 's'}</strong>
          </div>

          <div className="budget-payment-buttons">
            {snapshot.payments.map((row) => (
              <div className={`budget-payment-chip ${row.paid ? 'is-paid' : ''}`} key={row.item.id}>
                <div>
                  <strong>{isLoanCategory ? `Pago ${row.item.loanInstallment || 1} de 2` : (row.item.name || category)}</strong>
                  <small>{currency.format(row.item.amount)} · día {Number(row.item.day || 1)}</small>
                </div>
                {row.paid ? (
                  <div className="budget-payment-done">
                    <span>✓ Hecho</span>
                    <button type="button" onClick={() => undoPaid(row)} disabled={snapshot.closed}>Deshacer</button>
                  </div>
                ) : (
                  <button type="button" className="budget-payment-mark" onClick={() => markPaid(row)} disabled={snapshot.closed}>
                    ✓ Ya se hizo
                  </button>
                )}
              </div>
            ))}
          </div>

          {isLoanCategory && (
            <small className="budget-payment-explanation">
              Estas son únicamente las 2 cuotas normales del préstamo. Los abonos extra a capital siguen separados en Préstamo.
            </small>
          )}
        </>
      ) : (
        <div className="budget-no-fixed-payment">
          <span>Presupuesto de control</span>
          <small>Esta categoría no tiene un pago fijo configurado.</small>
        </div>
      )}

      <button type="button" className="budget-edit-toggle" onClick={toggleBudgetEdit}>
        Ajustar presupuesto
      </button>

      {snapshot.closed && <small className="budget-payment-closed">Mes cerrado · solo lectura</small>}
      {message && <small className="budget-payment-message">{message}</small>}
    </div>
  );
}

export default function BudgetCategoryPaymentControls() {
  const [hosts, setHosts] = useState([]);
  const [, setVersion] = useState(0);

  useEffect(() => {
    let lastSignature = '';

    const scan = () => {
      const rows = [...document.querySelectorAll('.app-view[aria-label="Gastos"] .budget-row')];
      const next = [];

      rows.forEach((row, index) => {
        const category = row.querySelector('.budget-title span:first-child')?.textContent?.trim();
        if (!category) return;

        row.classList.add('has-budget-actions');
        let host = row.querySelector(':scope > .budget-category-payment-host');
        if (!host) {
          host = document.createElement('div');
          host.className = 'budget-category-payment-host';
          host.dataset.category = category;
          row.appendChild(host);
        }
        next.push({ host, category, key: `${category}-${index}` });
      });

      const signature = next.map(({ category, host }) => `${category}:${host.isConnected}`).join('|');
      if (signature !== lastSignature) {
        lastSignature = signature;
        setHosts(next);
      }
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { childList: true, subtree: true });

    const refresh = () => setVersion((value) => value + 1);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener('recurring-payments-normalized', refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
      window.removeEventListener('recurring-payments-normalized', refresh);
    };
  }, []);

  const refreshAll = () => setVersion((value) => value + 1);

  return hosts.map(({ host, category, key }) => createPortal(
    <CategoryPaymentActions category={category} host={host} refreshAll={refreshAll} />,
    host,
    key
  ));
}
