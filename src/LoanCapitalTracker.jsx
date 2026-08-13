import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculateLoanProjection, calculateEstimatedEndDate, getMonthlyLoanBreakdown } from './loanCalculator';
import { loadLoanSettings, saveLoanSettings } from './loanSettings';

const HISTORY_KEY = 'loan-capital-payments';
const EXPENSE_KEY = 'expenses';
const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const dateFormatter = new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });

function todayKey() { return new Date().toISOString().slice(0, 10); }
function createId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function loadArray(key) {
  try { const value = JSON.parse(localStorage.getItem(key)); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
function saveArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
}

function syncVisibleLoanBalance(balance) {
  const panel = document.querySelector('.loan-panel');
  if (!panel) return;
  const settingsAlreadyOpen = Boolean(panel.querySelector('.loan-settings-box'));
  const toggle = panel.querySelector('.loan-heading-actions .secondary-button');
  if (!settingsAlreadyOpen) toggle?.click();
  window.setTimeout(() => {
    const input = panel.querySelector('.loan-settings-grid .settings-field input[type="number"]');
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(balance));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!settingsAlreadyOpen) window.setTimeout(() => toggle?.click(), 60);
  }, 60);
}

export default function LoanCapitalTracker() {
  const [target, setTarget] = useState(null);
  const [loan, setLoan] = useState(() => loadLoanSettings());
  const [history, setHistory] = useState(() => loadArray(HISTORY_KEY));
  const [form, setForm] = useState({ amount: '', date: todayKey(), note: '', addAsExpense: true });
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refreshTarget = () => setTarget(document.querySelector('.loan-panel'));
    refreshTarget();
    const observer = new MutationObserver(refreshTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const normalized = useMemo(() => ({
    currentBalance: Number(loan.currentBalance || 0),
    monthlyInterestRate: Number(loan.monthlyInterestRate || 0) / 100,
    biweeklyPrincipalPayment: Number(loan.biweeklyPrincipalPayment || 0),
    biweeklyAdminFee: Number(loan.biweeklyAdminFee || 0),
    biweeklyLifeInsurance: Number(loan.biweeklyLifeInsurance || 0),
    biweeklyOtherInsurance: Number(loan.biweeklyOtherInsurance || 0)
  }), [loan]);

  const breakdown = useMemo(() => getMonthlyLoanBreakdown(normalized), [normalized]);
  const preview = useMemo(() => {
    const amount = Math.max(0, Number(form.amount || 0));
    const before = normalized.currentBalance;
    const after = Math.max(0, before - amount);
    const beforeProjection = calculateLoanProjection({ balance: before, monthlyRate: normalized.monthlyInterestRate, regularMonthlyPayment: breakdown.monthlyPrincipalPayment });
    const afterProjection = calculateLoanProjection({ balance: after, monthlyRate: normalized.monthlyInterestRate, regularMonthlyPayment: breakdown.monthlyPrincipalPayment });
    return {
      before,
      after,
      monthsSaved: Math.max(0, beforeProjection.months - afterProjection.months),
      interestSaved: Math.max(0, beforeProjection.totalInterest - afterProjection.totalInterest),
      endDate: calculateEstimatedEndDate(afterProjection.months)
    };
  }, [form.amount, normalized, breakdown.monthlyPrincipalPayment]);

  const totalPaid = useMemo(() => history.reduce((sum, item) => sum + Number(item.amount || 0), 0), [history]);

  function registerPayment(event) {
    event.preventDefault();
    setMessage('');
    const amount = Number(form.amount || 0);
    if (!amount || amount <= 0) return setMessage('Ingresa un monto válido.');
    if (amount > normalized.currentBalance) return setMessage('El abono no puede superar el saldo actual.');

    const id = createId();
    const record = {
      id,
      amount,
      date: form.date || todayKey(),
      note: form.note.trim(),
      balanceBefore: normalized.currentBalance,
      balanceAfter: Number((normalized.currentBalance - amount).toFixed(2)),
      expenseId: form.addAsExpense ? `loan-capital-${id}` : null,
      createdAt: new Date().toISOString()
    };
    const nextLoan = { ...loan, currentBalance: record.balanceAfter };
    const nextHistory = [record, ...history];
    saveLoanSettings(nextLoan);
    saveArray(HISTORY_KEY, nextHistory);
    setLoan(nextLoan);
    setHistory(nextHistory);

    if (record.expenseId) {
      const expenses = loadArray(EXPENSE_KEY);
      saveArray(EXPENSE_KEY, [{ id: record.expenseId, category: 'Préstamo', amount, date: record.date, note: record.note || 'Abono extraordinario a capital', loanCapitalPaymentId: id }, ...expenses]);
    }

    syncVisibleLoanBalance(record.balanceAfter);
    setForm({ amount: '', date: todayKey(), note: '', addAsExpense: true });
    setMessage(`Abono registrado. Nuevo saldo: ${currency.format(record.balanceAfter)}.`);
  }

  function undoLatest() {
    const latest = history[0];
    if (!latest) return;
    if (Math.abs(normalized.currentBalance - Number(latest.balanceAfter || 0)) > 0.02) {
      setMessage('No se puede deshacer automáticamente porque el saldo cambió después de ese abono.');
      return;
    }
    const nextLoan = { ...loan, currentBalance: Number(latest.balanceBefore || 0) };
    const nextHistory = history.slice(1);
    saveLoanSettings(nextLoan);
    saveArray(HISTORY_KEY, nextHistory);
    if (latest.expenseId) saveArray(EXPENSE_KEY, loadArray(EXPENSE_KEY).filter((item) => item.id !== latest.expenseId));
    setLoan(nextLoan);
    setHistory(nextHistory);
    syncVisibleLoanBalance(nextLoan.currentBalance);
    setMessage(`Último abono deshecho. Saldo restaurado: ${currency.format(nextLoan.currentBalance)}.`);
  }

  if (!target) return null;

  return createPortal(
    <section className="capital-payment-box" aria-label="Abonos reales a capital">
      <div className="capital-payment-heading">
        <div><span className="eyebrow">ABONO REAL</span><h3>Registrar abono a capital realizado</h3><p>Actualiza el saldo real del préstamo y recalcula automáticamente las proyecciones. Es distinto del simulador mensual.</p></div>
        <div className="capital-paid-total"><span>Total registrado</span><strong>{currency.format(totalPaid)}</strong></div>
      </div>

      <form className="capital-payment-form" onSubmit={registerPayment}>
        <label><span>Monto abonado</span><div className="capital-money-input"><span>Q</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="1000" required /></div></label>
        <label><span>Fecha</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></label>
        <label className="capital-note-field"><span>Nota opcional</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ej. abono extraordinario de agosto" /></label>
        <label className="capital-expense-toggle"><input type="checkbox" checked={form.addAsExpense} onChange={(event) => setForm({ ...form, addAsExpense: event.target.checked })} /><span>Registrar también como gasto del mes</span></label>
        <button type="submit" className="primary-button">Registrar abono real</button>
      </form>

      <div className="capital-preview-grid">
        <div><span>Saldo antes</span><strong>{currency.format(preview.before)}</strong></div>
        <div className="capital-after"><span>Saldo después</span><strong>{currency.format(preview.after)}</strong></div>
        <div><span>Meses reducidos por este abono</span><strong>{preview.monthsSaved}</strong></div>
        <div><span>Interés estimado evitado</span><strong>{currency.format(preview.interestSaved)}</strong></div>
        <div><span>Nueva fecha estimada</span><strong>{dateFormatter.format(preview.endDate)}</strong></div>
      </div>

      {message && <div className="capital-payment-message">{message}</div>}

      {!!history.length && <div className="capital-payment-history">
        <div className="capital-history-heading"><div><span className="eyebrow">HISTORIAL</span><h4>Abonos registrados</h4></div><button type="button" className="secondary-button" onClick={undoLatest}>Deshacer último</button></div>
        {history.slice(0, 5).map((item) => <article key={item.id}><div><strong>{currency.format(item.amount)}</strong><span>{item.date}{item.note ? ` · ${item.note}` : ''}</span></div><div><span>Saldo</span><strong>{currency.format(item.balanceBefore)} → {currency.format(item.balanceAfter)}</strong></div></article>)}
      </div>}
    </section>,
    target
  );
}
