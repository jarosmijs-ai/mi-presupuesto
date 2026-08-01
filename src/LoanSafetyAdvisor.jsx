import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_MONTHLY_BUDGETS } from './monthlyBudgets';
import { loadLoanSettings } from './loanSettings';

const INCOME_KEY = 'monthly-incomes';
const EXPENSE_KEY = 'expenses';
const RECURRING_KEY = 'premium-recurring-expenses';
const BUDGET_KEY = 'monthly-budgets';
const CLASSIFICATION_KEY = 'income-classifications';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function monthKey() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function inferredClass(income) {
  const text = `${income.type || ''} ${income.source || ''} ${income.note || ''}`.toLocaleLowerCase('es');
  return /(quincena|salario|sueldo|nómina|nomina)/.test(text) ? 'regular' : 'extraordinary';
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function calculateAdvice() {
  const month = monthKey();
  const incomes = load(INCOME_KEY, []).filter((item) => String(item.date || '').startsWith(month));
  const expenses = load(EXPENSE_KEY, []).filter((item) => String(item.date || '').startsWith(month));
  const recurring = load(RECURRING_KEY, []).filter((item) => item.active);
  const classifications = load(CLASSIFICATION_KEY, {});
  const allBudgets = load(BUDGET_KEY, {});
  const budgets = { ...DEFAULT_MONTHLY_BUDGETS, ...(allBudgets[month] || {}) };
  const loan = loadLoanSettings();

  const regularIncome = sum(incomes.filter((item) => (classifications[item.id] || inferredClass(item)) === 'regular'));
  const extraordinaryIncome = sum(incomes.filter((item) => (classifications[item.id] || inferredClass(item)) === 'extraordinary'));
  const totalIncome = regularIncome + extraordinaryIncome;
  const reliableIncome = regularIncome > 0 ? regularIncome : totalIncome;
  const spent = sum(expenses);
  const paidRecurringIds = new Set(expenses.map((item) => item.recurringId).filter(Boolean));
  const pendingRecurring = recurring.filter((item) => !paidRecurringIds.has(item.id));
  const pendingTotal = sum(pendingRecurring);
  const budgetTotal = Object.values(budgets).reduce((total, amount) => total + Number(amount || 0), 0);

  const today = new Date();
  const selectedCurrentMonth = month === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const daysElapsed = selectedCurrentMonth ? Math.max(1, today.getDate()) : new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const variableSpent = sum(expenses.filter((item) => !item.recurringId));
  const projectedVariable = (variableSpent / daysElapsed) * daysInMonth;
  const paidRecurring = sum(expenses.filter((item) => item.recurringId));
  const projectedExpenses = Math.max(spent + pendingTotal, projectedVariable + paidRecurring + pendingTotal, budgetTotal);

  const configuredReserve = Math.max(0, Number(localStorage.getItem('minimum-reserve') || 1000));
  const proportionalReserve = reliableIncome * 0.15;
  const safetyReserve = Math.max(configuredReserve, proportionalReserve);
  const safeSurplus = Math.max(0, reliableIncome - projectedExpenses - safetyReserve);
  const suggestedExtra = Math.floor((safeSurplus * 0.5) / 50) * 50;
  const maximumExtra = Math.floor(safeSurplus / 50) * 50;
  const availableAfterPending = totalIncome - spent - pendingTotal;
  const monthlyLoanPayment = Number(loan.biweeklyPrincipalPayment || 0) * 2 + (Number(loan.biweeklyAdminFee || 0) + Number(loan.biweeklyLifeInsurance || 0) + Number(loan.biweeklyOtherInsurance || 0)) * 2;

  let status = 'Sin capacidad segura';
  if (!totalIncome) status = 'Faltan ingresos del mes';
  else if (suggestedExtra > 0) status = 'Abono prudente disponible';
  else if (availableAfterPending > 0) status = 'Conserva el efectivo este mes';

  return {
    month,
    regularIncome,
    extraordinaryIncome,
    totalIncome,
    reliableIncome,
    spent,
    pendingTotal,
    budgetTotal,
    projectedExpenses,
    safetyReserve,
    safeSurplus,
    suggestedExtra,
    maximumExtra,
    availableAfterPending,
    monthlyLoanPayment,
    status
  };
}

function applyExtraPayment(amount) {
  const input = document.querySelector('.loan-panel .extra-payment-input input');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, String(amount));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.focus();
  return true;
}

export default function LoanSafetyAdvisor() {
  const [target, setTarget] = useState(null);
  const [advice, setAdvice] = useState(calculateAdvice);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refresh = () => {
      setTarget(document.querySelector('.loan-panel .extra-payment-box'));
      setAdvice(calculateAdvice());
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

  const explanation = useMemo(() => {
    if (!advice.totalIncome) return 'Registra los ingresos del mes para generar una recomendación.';
    if (!advice.suggestedExtra) return 'La proyección del mes y la reserva de seguridad no dejan margen prudente para un abono adicional.';
    return `La recomendación utiliza solo el 50% del excedente seguro y conserva ${currency.format(advice.safetyReserve)} como reserva.`;
  }, [advice]);

  if (!target) return null;

  return createPortal(
    <section className="loan-safety-advisor" aria-label="Recomendación segura de abono extra">
      <header>
        <div><span>ANÁLISIS DE CAPACIDAD</span><h3>Abono extra recomendado</h3></div>
        <strong>{currency.format(advice.suggestedExtra)}</strong>
      </header>
      <p>{explanation}</p>
      <div className="loan-safety-grid">
        <div><span>Ingreso confiable</span><strong>{currency.format(advice.reliableIncome)}</strong></div>
        <div><span>Gasto proyectado o presupuesto</span><strong>{currency.format(advice.projectedExpenses)}</strong></div>
        <div><span>Reserva protegida</span><strong>{currency.format(advice.safetyReserve)}</strong></div>
        <div><span>Máximo sin reserva adicional</span><strong>{currency.format(advice.maximumExtra)}</strong></div>
      </div>
      <small>{advice.status}. Los ingresos extraordinarios no se usan como base cuando existen ingresos regulares.</small>
      <button type="button" disabled={!advice.suggestedExtra} onClick={() => {
        const applied = applyExtraPayment(advice.suggestedExtra);
        setMessage(applied ? `Se aplicó ${currency.format(advice.suggestedExtra)} al simulador.` : 'Abre la sección de préstamo para aplicar la recomendación.');
      }}>Usar abono recomendado</button>
      {message && <div className="loan-safety-message">{message}</div>}
    </section>,
    target.parentElement
  );
}
