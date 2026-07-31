import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const INCOME_KEY = 'monthly-incomes';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

function loadIncomes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INCOME_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getSelectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function calculateStats() {
  const incomes = loadIncomes();
  const monthlyTotals = new Map();

  incomes.forEach((income) => {
    const month = String(income.date || '').slice(0, 7);
    const amount = Number(income.amount || 0);
    if (!/^\d{4}-\d{2}$/.test(month) || amount <= 0) return;
    monthlyTotals.set(month, (monthlyTotals.get(month) || 0) + amount);
  });

  const totals = [...monthlyTotals.values()];
  const average = totals.length
    ? totals.reduce((sum, total) => sum + total, 0) / totals.length
    : 0;
  const selectedMonth = getSelectedMonth();
  const selectedIncome = monthlyTotals.get(selectedMonth) || 0;
  const difference = selectedIncome - average;
  const percentage = average > 0 ? (difference / average) * 100 : 0;

  return {
    average,
    selectedIncome,
    difference,
    percentage,
    monthsCount: totals.length,
    entriesCount: incomes.filter((item) => Number(item.amount || 0) > 0).length
  };
}

export default function IncomeAverageCard() {
  const [target, setTarget] = useState(null);
  const [stats, setStats] = useState(calculateStats);

  useEffect(() => {
    function refresh() {
      setTarget(document.querySelector('.summary-grid'));
      setStats(calculateStats());
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

  const trend = useMemo(() => {
    if (!stats.monthsCount || stats.monthsCount === 1) {
      return 'El promedio se volverá más preciso al registrar más meses.';
    }

    if (Math.abs(stats.percentage) < 1) {
      return 'El ingreso del mes está prácticamente igual a tu promedio.';
    }

    const direction = stats.percentage > 0 ? 'por encima' : 'por debajo';
    return `${Math.abs(stats.percentage).toFixed(1)}% ${direction} de tu promedio.`;
  }, [stats]);

  if (!target) return null;

  return createPortal(
    <article className="summary-card income-average-card" aria-label="Promedio histórico de ingresos">
      <div className="summary-icon" aria-hidden="true">≈</div>
      <div className="income-average-copy">
        <span>Ingreso mensual promedio</span>
        <strong>{currency.format(stats.average)}</strong>
        <small>
          {stats.monthsCount
            ? `Basado en ${stats.monthsCount} mes${stats.monthsCount === 1 ? '' : 'es'} con ingresos · ${stats.entriesCount} registro${stats.entriesCount === 1 ? '' : 's'}`
            : 'Registra tu primer ingreso para comenzar el promedio'}
        </small>
        {!!stats.monthsCount && <p>{trend}</p>}
      </div>
    </article>,
    target
  );
}
