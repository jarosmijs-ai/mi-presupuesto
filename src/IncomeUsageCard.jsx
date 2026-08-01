import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const INCOME_KEY = 'monthly-incomes';
const EXPENSE_KEY = 'expenses';
const RECURRING_KEY = 'premium-recurring-expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

function load(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function selectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function calculate() {
  const month = selectedMonth();
  const incomes = load(INCOME_KEY).filter((item) => String(item.date || '').startsWith(month));
  const expenses = load(EXPENSE_KEY).filter((item) => String(item.date || '').startsWith(month));
  const recurring = load(RECURRING_KEY).filter((item) => item.active);
  const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);
  const income = sum(incomes);
  const spent = sum(expenses);
  const paidRecurringIds = new Set(expenses.map((item) => item.recurringId).filter(Boolean));
  const pendingAmount = sum(recurring.filter((item) => !paidRecurringIds.has(item.id)));
  const available = income - spent - pendingAmount;
  const spentPercent = income > 0 ? Math.min(100, (spent / income) * 100) : 0;
  const committedPercent = income > 0 ? Math.min(100 - spentPercent, (pendingAmount / income) * 100) : 0;
  const usedPercent = income > 0 ? ((spent + pendingAmount) / income) * 100 : 0;

  let status = 'Sin datos suficientes';
  if (income > 0) {
    if (usedPercent > 100) status = 'Gastaste más de lo ingresado';
    else if (usedPercent > 80) status = 'Ajustado';
    else if (usedPercent > 60) status = 'Atención';
    else status = 'Saludable';
  }

  return { income, spent, pendingAmount, available, spentPercent, committedPercent, usedPercent, status };
}

export default function IncomeUsageCard() {
  const [target, setTarget] = useState(null);
  const [stats, setStats] = useState(calculate);

  useEffect(() => {
    const refresh = () => {
      setTarget(document.querySelector('.summary-grid'));
      setStats(calculate());
    };
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

  const note = useMemo(() => {
    if (!stats.income) return 'Registra ingresos para medir cuánto has utilizado.';
    return `${stats.usedPercent.toFixed(1)}% utilizado o comprometido · ${stats.status}`;
  }, [stats]);

  if (!target) return null;

  return createPortal(
    <article className="summary-card income-usage-card" aria-label="Uso de tus ingresos">
      <div className="summary-icon" aria-hidden="true">↔</div>
      <div className="income-usage-copy">
        <span>Uso de tus ingresos</span>
        <strong>{currency.format(stats.available)}</strong>
        <small>Disponible después de gastos y pagos pendientes</small>
        <div className="income-usage-track" aria-label={note}>
          <span className="income-usage-spent" style={{ width: `${stats.spentPercent}%` }} />
          <span className="income-usage-pending" style={{ width: `${stats.committedPercent}%` }} />
        </div>
        <div className="income-usage-values">
          <span>Ingresos {currency.format(stats.income)}</span>
          <span>Gastado {currency.format(stats.spent)}</span>
          <span>Pendiente {currency.format(stats.pendingAmount)}</span>
        </div>
        <p>{note}</p>
      </div>
    </article>,
    target
  );
}
