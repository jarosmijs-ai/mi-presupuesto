import { useEffect } from 'react';
import { loadLoanSettings } from './loanSettings';

const RECURRING_KEY = 'premium-recurring-expenses';

function safeArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(month = currentMonthKey()) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function isLoanPayment(item) {
  const text = `${item?.name || ''} ${item?.title || ''} ${item?.category || ''}`
    .toLocaleLowerCase('es-GT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return text.includes('prestamo');
}

function regularBiweeklyLoanAmount(item) {
  const settings = loadLoanSettings();
  const total =
    Number(settings.biweeklyPrincipalPayment || 0) +
    Number(settings.biweeklyAdminFee || 0) +
    Number(settings.biweeklyLifeInsurance || 0) +
    Number(settings.biweeklyOtherInsurance || 0);

  if (total > 0) return Number(total.toFixed(2));

  if (item?.loanSplit) return Number(item.amount || 0);
  const configuredMonthly = Number(item?.amount || 0);
  return configuredMonthly > 0 ? Number((configuredMonthly / 2).toFixed(2)) : 0;
}

function installmentDays(baseDay, month = currentMonthKey()) {
  const lastDay = daysInMonth(month);
  const normalized = Math.min(Math.max(Number(baseDay) || 15, 1), lastDay);

  if (normalized <= 15) {
    return [normalized, Math.min(lastDay, normalized + 15)];
  }

  return [Math.max(1, normalized - 15), normalized];
}

function normalizedLoanItem(item, installment, amount, days) {
  const sourceId = item.loanSourceId || item.id;
  const baseName = item.loanBaseName || String(item.name || item.title || 'Préstamo')
    .replace(/\s*[·-]\s*pago\s*[12]\s*de\s*2\s*$/i, '')
    .trim() || 'Préstamo';
  const baseDay = Number(item.loanBaseDay || item.day || 15);
  const id = installment === 1 ? sourceId : `${sourceId}::payment-2`;

  return {
    ...item,
    id,
    name: `${baseName} · pago ${installment} de 2`,
    category: 'Préstamo',
    amount,
    day: days[installment - 1],
    active: item.active !== false,
    loanSplit: true,
    loanSourceId: sourceId,
    loanBaseName: baseName,
    loanBaseDay: baseDay,
    loanInstallment: installment,
    loanInstallmentCount: 2,
    amountSource: 'loan-settings'
  };
}

function normalizeRecurringPayments() {
  const current = safeArray(RECURRING_KEY);
  if (!current.length) return;

  const splitGroups = new Map();
  const normalItems = [];

  current.forEach((item) => {
    if (item?.loanSplit && isLoanPayment(item)) {
      const sourceId = item.loanSourceId || String(item.id || '').replace(/::payment-2$/, '');
      const group = splitGroups.get(sourceId) || [];
      group.push(item);
      splitGroups.set(sourceId, group);
    } else if (isLoanPayment(item)) {
      const sourceId = item.id;
      splitGroups.set(sourceId, [item]);
    } else {
      normalItems.push(item);
    }
  });

  if (!splitGroups.size) return;

  const normalizedLoans = [];

  splitGroups.forEach((items, sourceId) => {
    const firstExisting = items.find((item) => Number(item.loanInstallment) === 1) || items[0];
    const secondExisting = items.find((item) => Number(item.loanInstallment) === 2);
    const base = {
      ...firstExisting,
      id: sourceId,
      loanSourceId: sourceId,
      active: firstExisting.active !== false
    };
    const amount = regularBiweeklyLoanAmount(firstExisting);
    const baseDay = Number(firstExisting.loanBaseDay || firstExisting.day || 15);
    const days = installmentDays(baseDay);

    const first = normalizedLoanItem(base, 1, amount, days);
    const second = normalizedLoanItem(
      {
        ...base,
        ...(secondExisting || {}),
        id: `${sourceId}::payment-2`,
        loanSourceId: sourceId,
        active: secondExisting ? secondExisting.active !== false : base.active
      },
      2,
      amount,
      days
    );

    normalizedLoans.push(first, second);
  });

  const next = [...normalItems, ...normalizedLoans];
  const currentRaw = JSON.stringify(current);
  const nextRaw = JSON.stringify(next);

  if (currentRaw === nextRaw) return;

  localStorage.setItem(RECURRING_KEY, nextRaw);
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
  window.dispatchEvent(new CustomEvent('recurring-payments-normalized'));
}

export default function RecurringPaymentNormalizer() {
  useEffect(() => {
    let queued = false;

    const normalize = () => {
      if (queued) return;
      queued = true;
      window.setTimeout(() => {
        queued = false;
        normalizeRecurringPayments();
      }, 40);
    };

    normalizeRecurringPayments();
    window.addEventListener('focus', normalize);
    window.addEventListener('storage', normalize);
    window.addEventListener('budget-data-changed', normalize);

    return () => {
      window.removeEventListener('focus', normalize);
      window.removeEventListener('storage', normalize);
      window.removeEventListener('budget-data-changed', normalize);
    };
  }, []);

  return null;
}
