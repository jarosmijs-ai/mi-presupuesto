import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const BASELINE = '2026-08';
const INCOME_KEY = 'monthly-incomes';
const EXPENSE_KEY = 'expenses';
const RECURRING_KEY = 'premium-recurring-expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const CLASSIFICATION_KEY = 'income-classifications';
const CLOSE_KEY = 'monthly-close-snapshots';

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

function load(key, fallback = []) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
}

function monthKey(value) {
  return String(value?.date || value || '').slice(0, 7);
}

function getSelectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function formatMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function daysInMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function elapsedDays(month) {
  const today = new Date();
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  if (month < current) return daysInMonth(month);
  if (month > current) return 0;
  return Math.max(1, today.getDate());
}

function inferredIncomeClass(income) {
  const label = `${income.type || ''} ${income.source || ''} ${income.note || ''}`.toLocaleLowerCase('es');
  return /(quincena|salario|sueldo|nómina|nomina)/.test(label) ? 'regular' : 'extraordinary';
}

function buildSnapshot(month) {
  const allIncomes = load(INCOME_KEY, []).filter((item) => monthKey(item) >= BASELINE);
  const allExpenses = load(EXPENSE_KEY, []).filter((item) => monthKey(item) >= BASELINE);
  const recurring = load(RECURRING_KEY, []);
  const classifications = load(CLASSIFICATION_KEY, {});

  const monthIncomes = allIncomes.filter((item) => monthKey(item) === month);
  const monthExpenses = allExpenses.filter((item) => monthKey(item) === month);
  const regularIncome = sum(monthIncomes.filter((item) => (classifications[item.id] || inferredIncomeClass(item)) === 'regular'));
  const extraordinaryIncome = sum(monthIncomes.filter((item) => (classifications[item.id] || inferredIncomeClass(item)) === 'extraordinary'));
  const income = regularIncome + extraordinaryIncome;
  const expenses = sum(monthExpenses);

  const paidRecurringIds = new Set(monthExpenses.map((item) => item.recurringId).filter(Boolean));
  const pendingRecurring = recurring.filter((item) => item.active && !paidRecurringIds.has(item.id));
  const pendingTotal = sum(pendingRecurring);

  const elapsed = elapsedDays(month);
  const projectionReady = elapsed >= 3;
  const variableExpenses = monthExpenses.filter((item) => !item.recurringId);
  const paidRecurringTotal = sum(monthExpenses.filter((item) => item.recurringId));
  const realisticMinimum = expenses + pendingTotal;
  const dailyVariable = projectionReady ? sum(variableExpenses) / elapsed : 0;
  const projectedVariable = projectionReady ? dailyVariable * daysInMonth(month) : sum(variableExpenses);
  const projectedExpenses = projectionReady
    ? Math.max(expenses, projectedVariable + paidRecurringTotal + pendingTotal)
    : realisticMinimum;
  const projectedBalance = income - projectedExpenses;

  const totalsByMonth = new Map();
  allExpenses.forEach((item) => {
    const key = monthKey(item);
    totalsByMonth.set(key, (totalsByMonth.get(key) || 0) + Number(item.amount || 0));
  });
  const monthlyExpenseTotals = [...totalsByMonth.values()];
  const averageExpenses = monthlyExpenseTotals.length ? sum(monthlyExpenseTotals.map((amount) => ({ amount }))) / monthlyExpenseTotals.length : 0;

  const incomesByMonth = new Map();
  allIncomes.forEach((item) => {
    const key = monthKey(item);
    incomesByMonth.set(key, (incomesByMonth.get(key) || 0) + Number(item.amount || 0));
  });
  const savingsByMonth = [...new Set([...incomesByMonth.keys(), ...totalsByMonth.keys()])].map((key) =>
    (incomesByMonth.get(key) || 0) - (totalsByMonth.get(key) || 0)
  );
  const averageSavings = savingsByMonth.length ? savingsByMonth.reduce((a, b) => a + b, 0) / savingsByMonth.length : 0;
  const averageIncome = incomesByMonth.size ? [...incomesByMonth.values()].reduce((a, b) => a + b, 0) / incomesByMonth.size : 0;
  const savingsRate = averageIncome > 0 ? (averageSavings / averageIncome) * 100 : 0;

  let health = 'Sin datos suficientes';
  if (income > 0) {
    if (income - expenses - pendingTotal < 0) health = 'Balance negativo';
    else if ((projectionReady && projectedBalance < 0) || pendingTotal > income * 0.35) health = 'Atención';
    else health = 'Estable';
  }

  return {
    month,
    monthIncomes,
    income,
    regularIncome,
    extraordinaryIncome,
    expenses,
    averageExpenses,
    averageSavings,
    savingsRate,
    pendingRecurring,
    pendingTotal,
    availableAfterPending: income - expenses - pendingTotal,
    projectedExpenses,
    projectedBalance,
    projectionReady,
    health
  };
}

export default function FinancialInsightsDashboard() {
  const [target, setTarget] = useState(null);
  const [month, setMonth] = useState(getSelectedMonth);
  const [snapshot, setSnapshot] = useState(() => buildSnapshot(getSelectedMonth()));
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('projection');
  const [message, setMessage] = useState('');

  useEffect(() => {
    function refresh() {
      const selected = getSelectedMonth();
      setTarget(document.querySelector('.summary-grid'));
      setMonth(selected);
      setSnapshot(buildSnapshot(selected));
    }
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
    };
  }, []);

  const closed = useMemo(() => Boolean(load(CLOSE_KEY, {})[month]), [month, snapshot]);

  function setIncomeClass(income, value) {
    const classifications = load(CLASSIFICATION_KEY, {});
    classifications[income.id] = value;
    save(CLASSIFICATION_KEY, classifications);
    setSnapshot(buildSnapshot(month));
  }

  function closeMonth() {
    const snapshots = load(CLOSE_KEY, {});
    snapshots[month] = {
      closedAt: new Date().toISOString(),
      month,
      income: snapshot.income,
      regularIncome: snapshot.regularIncome,
      extraordinaryIncome: snapshot.extraordinaryIncome,
      expenses: snapshot.expenses,
      balance: snapshot.income - snapshot.expenses,
      pendingTotal: snapshot.pendingTotal,
      projectedBalance: snapshot.projectedBalance,
      health: snapshot.health
    };
    save(CLOSE_KEY, snapshots);
    setMessage(`${formatMonth(month)} quedó cerrado con un balance de ${currency.format(snapshot.income - snapshot.expenses)}.`);
    setSnapshot(buildSnapshot(month));
  }

  if (!target) return null;

  return createPortal(
    <>
      <article className="summary-card financial-insight-card" onClick={() => setOpen(true)} role="button" tabIndex={0}>
        <div className="summary-icon" aria-hidden="true">↗</div>
        <div>
          <span>Disponible después de pendientes</span>
          <strong className={snapshot.availableAfterPending < 0 ? 'negative' : ''}>{currency.format(snapshot.availableAfterPending)}</strong>
          <small>{currency.format(snapshot.pendingTotal)} aún por pagar · Estado: {snapshot.health}</small>
          <p>{snapshot.projectionReady ? `Proyección de cierre: ${currency.format(snapshot.projectedBalance)}` : 'Proyección disponible después de 3 días del mes'}</p>
        </div>
      </article>

      {open && (
        <div className="insights-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="insights-panel" role="dialog" aria-modal="true">
            <header>
              <div><span>ANÁLISIS DESDE AGOSTO 2026</span><h2>{formatMonth(month)}</h2></div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>

            <nav>
              <button className={tab === 'projection' ? 'active' : ''} onClick={() => setTab('projection')}>Proyección</button>
              <button className={tab === 'income' ? 'active' : ''} onClick={() => setTab('income')}>Ingresos</button>
              <button className={tab === 'close' ? 'active' : ''} onClick={() => setTab('close')}>Cierre</button>
            </nav>

            {tab === 'projection' && (
              <div className="insights-stack">
                <div className="insights-metric-grid">
                  <article><span>Gasto mensual promedio</span><strong>{currency.format(snapshot.averageExpenses)}</strong></article>
                  <article><span>Ahorro mensual promedio</span><strong>{currency.format(snapshot.averageSavings)}</strong></article>
                  <article><span>Tasa de ahorro</span><strong>{snapshot.savingsRate.toFixed(1)}%</strong></article>
                  <article><span>Gasto proyectado</span><strong>{snapshot.projectionReady ? currency.format(snapshot.projectedExpenses) : 'Sin datos suficientes'}</strong></article>
                </div>
                <section className="insights-highlight">
                  <span>{snapshot.projectionReady ? 'AL CIERRE DEL MES' : 'PROYECCIÓN AÚN NO DISPONIBLE'}</span>
                  <strong className={snapshot.projectionReady && snapshot.projectedBalance < 0 ? 'negative' : ''}>
                    {snapshot.projectionReady ? currency.format(snapshot.projectedBalance) : '—'}
                  </strong>
                  <p>{snapshot.projectionReady
                    ? 'La estimación combina gastos registrados, ritmo de gastos variables y recurrentes pendientes.'
                    : 'La proyección comenzará cuando el mes haya iniciado y existan al menos 3 días de datos.'}</p>
                </section>
                <section className="insights-pending">
                  <div><span>Balance actual</span><strong>{currency.format(snapshot.income - snapshot.expenses)}</strong></div>
                  <div><span>Pagos pendientes</span><strong>-{currency.format(snapshot.pendingTotal)}</strong></div>
                  <div><span>Disponible realista</span><strong className={snapshot.availableAfterPending < 0 ? 'negative' : ''}>{currency.format(snapshot.availableAfterPending)}</strong></div>
                </section>
              </div>
            )}

            {tab === 'income' && (
              <div className="insights-stack">
                <div className="insights-metric-grid">
                  <article><span>Ingreso regular</span><strong>{currency.format(snapshot.regularIncome)}</strong></article>
                  <article><span>Ingreso extraordinario</span><strong>{currency.format(snapshot.extraordinaryIncome)}</strong></article>
                </div>
                <p className="insights-help">Clasifica cada ingreso para que bonos o reembolsos no inflen tu ingreso mensual seguro.</p>
                <div className="income-classification-list">
                  {snapshot.monthIncomes.length ? snapshot.monthIncomes.map((income) => {
                    const classifications = load(CLASSIFICATION_KEY, {});
                    const value = classifications[income.id] || inferredIncomeClass(income);
                    return (
                      <article key={income.id}>
                        <div><strong>{income.type || income.source || 'Ingreso'}</strong><small>{income.date} · {currency.format(income.amount)}</small></div>
                        <select value={value} onChange={(event) => setIncomeClass(income, event.target.value)}>
                          <option value="regular">Regular</option>
                          <option value="extraordinary">Extraordinario</option>
                        </select>
                      </article>
                    );
                  }) : <p>No hay ingresos registrados en este mes.</p>}
                </div>
              </div>
            )}

            {tab === 'close' && (
              <div className="insights-stack">
                <section className="insights-highlight">
                  <span>{closed ? 'MES CERRADO' : 'CIERRE MENSUAL'}</span>
                  <strong>{currency.format(snapshot.income - snapshot.expenses)}</strong>
                  <p>Ingresos {currency.format(snapshot.income)} · Gastos {currency.format(snapshot.expenses)} · Pendientes {currency.format(snapshot.pendingTotal)}</p>
                </section>
                <button className="close-month-button" type="button" disabled={closed} onClick={closeMonth}>
                  {closed ? 'Este mes ya fue cerrado' : `Cerrar ${formatMonth(month)}`}
                </button>
                <small className="close-note">El cierre guarda una fotografía del mes. Tus registros siguen siendo editables, pero el resumen cerrado queda conservado.</small>
                {message && <div className="insights-message">{message}</div>}
              </div>
            )}
          </section>
        </div>
      )}
    </>,
    target
  );
}
