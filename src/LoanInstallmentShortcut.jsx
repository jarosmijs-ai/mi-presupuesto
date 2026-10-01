import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { loadLoanSettings } from './loanSettings';

const EXPENSE_KEY = 'expenses';
const RECURRING_KEY = 'premium-recurring-expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

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

function safeArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-GT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function parseMonthLabel(label) {
  const normalized = String(label || '')
    .trim()
    .toLocaleLowerCase('es-GT');

  const match = normalized.match(
    /([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i
  );

  if (!match) return null;

  const month = MONTHS[match[1]];
  if (!month) return null;

  return `${match[2]}-${String(month).padStart(2, '0')}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}`;
}

function selectedMonth() {
  const label = document.querySelector(
    '.month-selector-copy strong'
  )?.textContent;

  return (
    parseMonthLabel(label) ||
    localStorage.getItem(SELECTED_MONTH_KEY) ||
    currentMonthKey()
  );
}

function isLoan(item) {
  const text = normalize(
    `${item?.category || ''} ${item?.name || ''} ${
      item?.title || ''
    }`
  );

  return text.includes('prestamo');
}

function getLoanPayments() {
  const recurring = safeArray(RECURRING_KEY)
    .filter((item) => item.active !== false && isLoan(item));

  const split = recurring
    .filter(
      (item) =>
        item.loanSplit ||
        Number(item.loanInstallment || 0) > 0
    )
    .sort(
      (a, b) =>
        Number(a.loanInstallment || a.day || 1) -
        Number(b.loanInstallment || b.day || 1)
    );

  if (split.length >= 2) {
    return split.slice(0, 2);
  }

  const settings = loadLoanSettings();
  const amount = Number(
    (
      Number(settings.biweeklyPrincipalPayment || 0) +
      Number(settings.biweeklyAdminFee || 0) +
      Number(settings.biweeklyLifeInsurance || 0) +
      Number(settings.biweeklyOtherInsurance || 0)
    ).toFixed(2)
  );

  const source = recurring[0] || {};
  const sourceId = source.loanSourceId || source.id || 'loan-payment';
  const baseDay = Number(source.loanBaseDay || source.day || 15);
  const firstDay = baseDay <= 15 ? baseDay : Math.max(1, baseDay - 15);
  const secondDay = baseDay <= 15 ? Math.min(31, baseDay + 15) : baseDay;

  return [1, 2].map((installment) => ({
    ...source,
    id:
      installment === 1
        ? sourceId
        : `${sourceId}::payment-2`,
    name: `Préstamo · pago ${installment} de 2`,
    category: 'Préstamo',
    amount:
      amount > 0
        ? amount
        : Number(source.amount || 0) / 2,
    day: installment === 1 ? firstDay : secondDay,
    loanSplit: true,
    loanSourceId: sourceId,
    loanInstallment: installment,
    loanInstallmentCount: 2,
    active: true
  }));
}

function lastDayForMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

function dateForPayment(monthKey, day) {
  const safeDay = Math.min(
    Math.max(Number(day) || 1, 1),
    lastDayForMonth(monthKey)
  );

  return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
}

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `loan-installment-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
  );
}

function findExpenseForPayment(expenses, month, payment) {
  const paymentNumber = Number(payment.loanInstallment || 0);

  return expenses.find((expense) => {
    if (!String(expense.date || '').startsWith(month)) {
      return false;
    }

    const recurringMatch =
      payment.id &&
      String(expense.recurringId || '') === String(payment.id);

    const scheduledMatch =
      expense.source === 'scheduled-loan' &&
      Number(expense.loanPaymentNumber || 0) === paymentNumber;

    return recurringMatch || scheduledMatch;
  });
}

function getSnapshot() {
  const month = selectedMonth();
  const expenses = safeArray(EXPENSE_KEY);
  const payments = getLoanPayments().map((payment, index) => {
    const normalizedPayment = {
      ...payment,
      loanInstallment:
        Number(payment.loanInstallment || 0) || index + 1
    };

    return {
      payment: normalizedPayment,
      expense: findExpenseForPayment(
        expenses,
        month,
        normalizedPayment
      )
    };
  });

  return { month, payments };
}

export default function LoanInstallmentShortcut() {
  const [host, setHost] = useState(null);
  const [snapshot, setSnapshot] = useState(getSnapshot);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let currentHost = null;

    const refresh = () => setSnapshot(getSnapshot());

    const ensureHost = () => {
      const rows = [
        ...document.querySelectorAll(
          '.app-view[aria-label="Gastos"] .budget-row'
        )
      ];

      const loanRow = rows.find((row) => {
        const category = row.querySelector(
          '.budget-title span:first-child'
        )?.textContent;

        return normalize(category) === 'prestamo';
      });

      if (!loanRow) {
        if (currentHost && !currentHost.isConnected) {
          currentHost = null;
          setHost(null);
        }
        return;
      }

      let nextHost = loanRow.querySelector(
        ':scope > .loan-installment-shortcut-host'
      );

      if (!nextHost) {
        nextHost = document.createElement('div');
        nextHost.className = 'loan-installment-shortcut-host';
        loanRow.appendChild(nextHost);
      }

      if (currentHost !== nextHost) {
        currentHost = nextHost;
        setHost(nextHost);
        refresh();
      }
    };

    ensureHost();

    const observer = new MutationObserver(ensureHost);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const monthNode = document.querySelector(
      '.month-selector-copy strong'
    );

    const monthObserver = monthNode
      ? new MutationObserver(() => {
          window.setTimeout(refresh, 0);
        })
      : null;

    monthObserver?.observe(monthNode, {
      childList: true,
      characterData: true,
      subtree: true
    });

    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener(
      'recurring-payments-normalized',
      refresh
    );
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      observer.disconnect();
      monthObserver?.disconnect();
      window.removeEventListener(
        'budget-data-changed',
        refresh
      );
      window.removeEventListener(
        'recurring-payments-normalized',
        refresh
      );
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const paidCount = useMemo(
    () => snapshot.payments.filter((row) => row.expense).length,
    [snapshot]
  );

  function refresh() {
    setSnapshot(getSnapshot());
  }

  function markPaid(row) {
    if (row.expense) return;

    const payment = row.payment;
    const paymentNumber = Number(payment.loanInstallment || 1);
    const expenses = safeArray(EXPENSE_KEY);

    const expense = {
      id: createId(),
      category: 'Préstamo',
      amount: Number(payment.amount || 0),
      date: dateForPayment(snapshot.month, payment.day),
      note: `${payment.name || `Pago ${paymentNumber} de 2`} · cuota regular`,
      recurringId: payment.id,
      recurringSourceId:
        payment.loanSourceId || payment.id,
      regularLoanPayment: true,
      source: 'scheduled-loan',
      loanPaymentNumber: paymentNumber,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(
      EXPENSE_KEY,
      JSON.stringify([expense, ...expenses])
    );

    window.dispatchEvent(
      new CustomEvent('budget-data-changed')
    );

    setMessage(
      `Quincena ${paymentNumber} registrada por ${currency.format(
        expense.amount
      )}.`
    );

    refresh();
  }

  function undoPaid(row) {
    if (!row.expense) return;

    const next = safeArray(EXPENSE_KEY).filter(
      (expense) => expense.id !== row.expense.id
    );

    localStorage.setItem(EXPENSE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent('budget-data-changed')
    );

    setMessage(
      `Pago de quincena ${row.payment.loanInstallment} deshecho.`
    );

    refresh();
  }

  if (!host) return null;

  return createPortal(
    <section
      className="loan-installment-shortcut"
      aria-label="Pagos de quincena del préstamo"
    >
      <div className="loan-installment-shortcut-heading">
        <div>
          <span>CUOTAS DEL PRÉSTAMO</span>
          <strong>Pago de quincena</strong>
        </div>

        <small>{paidCount}/2 pagadas</small>
      </div>

      <div className="loan-installment-shortcut-grid">
        {snapshot.payments.map((row) => {
          const paymentNumber = Number(
            row.payment.loanInstallment || 1
          );

          return (
            <article
              key={row.payment.id || paymentNumber}
              className={
                row.expense
                  ? 'loan-installment-chip is-paid'
                  : 'loan-installment-chip'
              }
            >
              <div>
                <span>Quincena {paymentNumber}</span>
                <strong>
                  {currency.format(row.payment.amount || 0)}
                </strong>
                <small>
                  Pago {paymentNumber} de 2 · día{' '}
                  {Number(row.payment.day || 1)}
                </small>
              </div>

              {row.expense ? (
                <div className="loan-installment-chip-paid">
                  <span>✓ Pagado</span>
                  <button
                    type="button"
                    onClick={() => undoPaid(row)}
                  >
                    Deshacer
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="loan-installment-chip-action"
                  onClick={() => markPaid(row)}
                >
                  ✓ Ya se pagó
                </button>
              )}
            </article>
          );
        })}
      </div>

      {message && (
        <div className="loan-installment-shortcut-message">
          {message}
        </div>
      )}
    </section>,
    host
  );
}
