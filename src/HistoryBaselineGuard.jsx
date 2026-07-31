import React, { useEffect } from 'react';
import { HISTORY_START_LABEL, HISTORY_START_MONTH, isWithinHistory } from './historyBaseline';

const INCOME_KEY = 'monthly-incomes';
const EXPENSE_KEY = 'expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

function loadArray(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function updateBaselineUi() {
  const eligibleIncomes = loadArray(INCOME_KEY).filter((item) => isWithinHistory(item.date));
  const eligibleExpenses = loadArray(EXPENSE_KEY).filter((item) => isWithinHistory(item.date));
  const cumulativeBalance = sum(eligibleIncomes) - sum(eligibleExpenses);

  const cumulativeCard = document.querySelector('.ux-balance-header-grid > div:nth-child(4)');
  if (cumulativeCard) {
    const label = cumulativeCard.querySelector('.ux-income-label');
    const value = cumulativeCard.querySelector('.ux-income-value');
    const note = cumulativeCard.querySelector('small');

    if (label) label.textContent = `BALANCE ACUMULADO · DESDE ${HISTORY_START_LABEL.toLocaleUpperCase('es-GT')}`;
    if (value) {
      value.textContent = currency.format(cumulativeBalance);
      value.classList.toggle('negative', cumulativeBalance < 0);
    }
    if (note) note.textContent = `Solo incluye ingresos y gastos desde ${HISTORY_START_LABEL}`;
  }

  const selectedMonth = localStorage.getItem(SELECTED_MONTH_KEY);
  const previousButton = document.querySelector('.month-selector .month-arrow:first-child');
  if (previousButton) {
    const atBaseline = selectedMonth === HISTORY_START_MONTH;
    previousButton.disabled = atBaseline;
    previousButton.setAttribute('aria-disabled', atBaseline ? 'true' : 'false');
    previousButton.title = atBaseline ? `El historial comienza en ${HISTORY_START_LABEL}` : 'Mes anterior';
  }
}

export default function HistoryBaselineGuard() {
  useEffect(() => {
    const refresh = () => window.setTimeout(updateBaselineUi, 30);
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

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

  return null;
}
