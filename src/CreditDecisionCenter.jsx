import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEFAULT_MONTHLY_BUDGETS } from './monthlyBudgets';
import { loadLoanSettings } from './loanSettings';

const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const SELECTED_MONTH_KEY = 'ux-selected-month';

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function selectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function classifyIncome(item, classifications) {
  if (classifications[item.id]) return classifications[item.id];
  const text = `${item.type || ''} ${item.source || ''} ${item.note || ''}`.toLowerCase();
  return /(salario|sueldo|quincena|nómina|nomina)/.test(text) ? 'regular' : 'extraordinary';
}

function calculate() {
  const month = selectedMonth();
  const incomes = load('monthly-incomes', []).filter((item) => String(item.date || '').startsWith(month));
  const expenses = load('expenses', []).filter((item) => String(item.date || '').startsWith(month));
  const recurring = load('premium-recurring-expenses', []).filter((item) => item.active);
  const classifications = load('income-classifications', {});
  const budgetsByMonth = load('monthly-budgets', {});
  const budgets = { ...DEFAULT_MONTHLY_BUDGETS, ...(budgetsByMonth[month] || {}) };
  const loan = loadLoanSettings();

  const regularIncome = sum(incomes.filter((item) => classifyIncome(item, classifications) === 'regular'));
  const totalIncome = sum(incomes);
  const reliableIncome = regularIncome || totalIncome;
  const spent = sum(expenses);
  const paidRecurring = new Set(expenses.map((item) => item.recurringId).filter(Boolean));
  const pending = sum(recurring.filter((item) => !paidRecurring.has(item.id)));
  const budgetTotal = sum(Object.entries(budgets).filter(([name]) => name !== 'Préstamo').map(([, amount]) => ({ amount })));
  const regularLoanPayment = (Number(loan.biweeklyPrincipalPayment || 0) + Number(loan.biweeklyAdminFee || 0) + Number(loan.biweeklyLifeInsurance || 0) + Number(loan.biweeklyOtherInsurance || 0)) * 2;
  const reserve = Math.max(Number(localStorage.getItem('minimum-reserve') || 1000), reliableIncome * 0.15);
  const expectedOutflow = Math.max(spent + pending, budgetTotal + regularLoanPayment);
  const safeSurplus = Math.max(0, reliableIncome - expectedOutflow - reserve);
  const recommended = Math.floor((safeSurplus * 0.5) / 50) * 50;
  const aggressive = Math.floor(safeSurplus / 50) * 50;

  let decision = 'No abonar extra este mes';
  let reason = 'La prioridad es cubrir gastos, pagos pendientes y conservar tu reserva.';
  if (!totalIncome) {
    decision = 'Registra ingresos primero';
    reason = 'Sin ingresos registrados no es posible recomendar un abono responsable.';
  } else if (recommended > 0) {
    decision = `Abono sugerido: ${currency.format(recommended)}`;
    reason = 'Este monto usa solo la mitad del excedente seguro y mantiene una reserva.';
  }

  return { month, totalIncome, reliableIncome, spent, pending, budgetTotal, regularLoanPayment, reserve, expectedOutflow, safeSurplus, recommended, aggressive, decision, reason };
}

function applyAmount(amount) {
  const input = document.querySelector('.loan-panel .extra-payment-input input');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, String(amount));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

export default function CreditDecisionCenter() {
  const [target, setTarget] = useState(null);
  const [data, setData] = useState(calculate);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refresh = () => {
      const grid = document.querySelector('.loan-panel .loan-summary-grid');
      setTarget(grid);
      setData(calculate());
      document.querySelector('.loan-panel')?.classList.add('credit-simplified');
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      observer.disconnect();
      window.removeEventListener('budget-data-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  const coverage = useMemo(() => data.reliableIncome > 0 ? (data.expectedOutflow / data.reliableIncome) * 100 : 0, [data]);
  if (!target) return null;

  return createPortal(
    <section className="credit-decision-center">
      <div className="credit-decision-main">
        <span>QUÉ HACER ESTE MES</span>
        <h3>{data.decision}</h3>
        <p>{data.reason}</p>
        <div className="credit-choice-row">
          <button type="button" className="active" disabled={!data.recommended} onClick={() => setMessage(applyAmount(data.recommended) ? `Se aplicó ${currency.format(data.recommended)} al simulador.` : 'No se encontró el simulador.')}>Usar sugerido</button>
          <button type="button" disabled={!data.aggressive} onClick={() => setMessage(applyAmount(data.aggressive) ? `Se aplicó el máximo de ${currency.format(data.aggressive)}.` : 'No se encontró el simulador.')}>Ver máximo</button>
          <button type="button" onClick={() => setMessage(applyAmount(0) ? 'Se dejó el abono extra en Q0.' : 'No se encontró el simulador.')}>Sin abono</button>
        </div>
        {message && <small>{message}</small>}
      </div>

      <div className="credit-explanation-grid">
        <article><span>Ingreso confiable</span><strong>{currency.format(data.reliableIncome)}</strong><small>No usa bonos como base cuando hay salario.</small></article>
        <article><span>Compromisos del mes</span><strong>{currency.format(data.expectedOutflow)}</strong><small>{coverage.toFixed(0)}% del ingreso confiable.</small></article>
        <article><span>Reserva protegida</span><strong>{currency.format(data.reserve)}</strong><small>No se toca para acelerar el préstamo.</small></article>
        <article><span>Excedente seguro</span><strong>{currency.format(data.safeSurplus)}</strong><small>De aquí sale la recomendación.</small></article>
      </div>

      <div className="credit-flow">
        <div><b>1</b><span>Cubre gastos y pagos pendientes</span></div>
        <div><b>2</b><span>Conserva tu reserva</span></div>
        <div><b>3</b><span>Abona solo una parte del excedente</span></div>
      </div>
    </section>,
    target
  );
}
