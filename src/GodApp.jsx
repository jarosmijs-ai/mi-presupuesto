import React, { useEffect, useMemo, useState } from 'react';
import {
  Home, ReceiptText, WalletCards, Landmark, MoreHorizontal,
  ChevronLeft, ChevronRight, Plus, ArrowDownLeft, ArrowUpRight,
  Check, Settings, ShieldCheck, Sparkles, X, Trash2, Fuel,
  Smartphone, Zap, Wifi, Utensils, CircleDollarSign, CalendarDays,
  TrendingUp, TrendingDown, Eye, EyeOff, RotateCcw, Copy,
  Calculator, Target, Save, BarChart3, Download, LockKeyhole
} from 'lucide-react';

import BackupPanel from './BackupPanel';
import InstallAppButton from './InstallAppButton';
import {
  loadAllMonthlyBudgets,
  saveAllMonthlyBudgets,
  getBudgetForMonth,
  updateBudgetForMonth,
  copyBudgetBetweenMonths,
  resetBudgetForMonth
} from './monthlyBudgets';
import { loadIncomes, saveIncomes } from './incomeTracker';
import {
  getCurrentMonthKey,
  changeMonth,
  formatMonthLabel,
  filterItemsByMonth
} from './monthUtils';
import { loadLoanSettings, saveLoanSettings } from './loanSettings';
import {
  getMonthlyLoanBreakdown,
  compareLoanScenarios
} from './loanCalculator';

const CURRENCY = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

const NAV = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'moves', label: 'Movimientos', icon: ReceiptText },
  { id: 'budget', label: 'Presupuesto', icon: WalletCards },
  { id: 'loan', label: 'Préstamo', icon: Landmark },
  { id: 'more', label: 'Más', icon: MoreHorizontal }
];

const CATEGORY_META = {
  Gasolina: { icon: Fuel, tone: 'blue' },
  Teléfono: { icon: Smartphone, tone: 'navy' },
  Luz: { icon: Zap, tone: 'gold' },
  Internet: { icon: Wifi, tone: 'blue' },
  Comidas: { icon: Utensils, tone: 'red' },
  Préstamo: { icon: Landmark, tone: 'navy' },
  Otros: { icon: CircleDollarSign, tone: 'neutral' }
};

function safeArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function safeText(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch {
      return value;
    }
  } catch {
    return fallback;
  }
}

function createId(prefix = 'item') {
  return globalThis.crypto?.randomUUID?.() ||
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayForMonth(monthKey, preferredDay) {
  const now = new Date();
  if (monthKey === getCurrentMonthKey() && !preferredDay) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const [year, month] = monthKey.split('-').map(Number);
  const max = new Date(year, month, 0).getDate();
  const day = Math.min(Math.max(Number(preferredDay || 1), 1), max);
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

function monthDay(monthKey, day) {
  return todayForMonth(monthKey, day);
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-GT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function recurringItems() {
  return safeArray('premium-recurring-expenses').filter((item) => item.active !== false);
}

function isLoanRecurring(item) {
  return normalize(`${item?.category || ''} ${item?.name || ''}`).includes('prestamo');
}

function loanInstallmentsFromSettings(loan) {
  const amount = Number((
    Number(loan.biweeklyPrincipalPayment || 0) +
    Number(loan.biweeklyAdminFee || 0) +
    Number(loan.biweeklyLifeInsurance || 0) +
    Number(loan.biweeklyOtherInsurance || 0)
  ).toFixed(2));

  const candidates = recurringItems()
    .filter(isLoanRecurring)
    .filter((item) => item.loanSplit || Number(item.loanInstallment || 0) > 0)
    .sort((a, b) => Number(a.loanInstallment || a.day || 1) - Number(b.loanInstallment || b.day || 1));

  if (candidates.length >= 2) return candidates.slice(0, 2);

  const source = candidates[0] || recurringItems().find(isLoanRecurring) || {};
  const sourceId = source.loanSourceId || source.id || 'loan-regular';
  const baseDay = Number(source.loanBaseDay || source.day || 15);
  const firstDay = baseDay <= 15 ? baseDay : Math.max(1, baseDay - 15);
  const secondDay = baseDay <= 15 ? Math.min(31, baseDay + 15) : baseDay;

  return [1, 2].map((number) => ({
    ...source,
    id: number === 1 ? sourceId : `${sourceId}::payment-2`,
    name: `Préstamo · pago ${number} de 2`,
    category: 'Préstamo',
    amount,
    day: number === 1 ? firstDay : secondDay,
    loanSplit: true,
    loanSourceId: sourceId,
    loanInstallment: number,
    active: true
  }));
}

function paymentExpense(expenses, month, item, number) {
  return expenses.find((expense) => {
    if (!String(expense.date || '').startsWith(month)) return false;
    const recurringMatch = item?.id && String(expense.recurringId || '') === String(item.id);
    const scheduledMatch =
      expense.source === 'scheduled-loan' &&
      Number(expense.loanPaymentNumber || 0) === Number(number);
    return recurringMatch || scheduledMatch;
  });
}

function emitChange() {
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
}

function useStoredData() {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener('budget-data-changed', refresh);
    window.addEventListener('financial-data-synced', refresh);
    window.addEventListener('recurring-payments-normalized', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('budget-data-changed', refresh);
      window.removeEventListener('financial-data-synced', refresh);
      window.removeEventListener('recurring-payments-normalized', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  return revision;
}

export default function GodApp() {
  const revision = useStoredData();
  const [section, setSection] = useState(() => safeText('god-section', 'home'));
  const [month, setMonth] = useState(() => safeText('ux-selected-month', getCurrentMonthKey()));
  const [privateMode, setPrivateMode] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [message, setMessage] = useState('');
  const [localRevision, setLocalRevision] = useState(0);

  const expenses = useMemo(() => safeArray('expenses'), [revision, localRevision]);
  const incomes = useMemo(() => loadIncomes(), [revision, localRevision]);
  const allBudgets = useMemo(() => loadAllMonthlyBudgets(), [revision, localRevision]);
  const budgets = useMemo(() => getBudgetForMonth(allBudgets, month), [allBudgets, month]);
  const loan = useMemo(() => loadLoanSettings(), [revision, localRevision]);

  const monthExpenses = useMemo(() => filterItemsByMonth(expenses, month), [expenses, month]);
  const monthIncomes = useMemo(() => filterItemsByMonth(incomes, month), [incomes, month]);

  const totalIncome = useMemo(
    () => monthIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [monthIncomes]
  );
  const totalExpense = useMemo(
    () => monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [monthExpenses]
  );
  const balance = totalIncome - totalExpense;
  const budgetTotal = Object.values(budgets).reduce((sum, value) => sum + Number(value || 0), 0);
  const budgetRemaining = Math.max(0, budgetTotal - totalExpense);
  const spendRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

  const breakdown = useMemo(() => getMonthlyLoanBreakdown({
    currentBalance: Number(loan.currentBalance || 0),
    monthlyInterestRate: Number(loan.monthlyInterestRate || 0) / 100,
    biweeklyPrincipalPayment: Number(loan.biweeklyPrincipalPayment || 0),
    biweeklyAdminFee: Number(loan.biweeklyAdminFee || 0),
    biweeklyLifeInsurance: Number(loan.biweeklyLifeInsurance || 0),
    biweeklyOtherInsurance: Number(loan.biweeklyOtherInsurance || 0),
    contractualEndDate: loan.contractualEndDate
  }), [loan]);

  const loanInstallments = useMemo(() => loanInstallmentsFromSettings(loan), [loan, revision, localRevision]);
  const loanRows = useMemo(
    () => loanInstallments.map((item, index) => ({
      item,
      number: Number(item.loanInstallment || index + 1),
      expense: paymentExpense(expenses, month, item, Number(item.loanInstallment || index + 1))
    })),
    [loanInstallments, expenses, month]
  );

  const fixedRows = useMemo(() => {
    return recurringItems()
      .filter((item) => !isLoanRecurring(item))
      .sort((a, b) => Number(a.day || 1) - Number(b.day || 1))
      .map((item) => ({
        item,
        expense: expenses.find((expense) =>
          String(expense.date || '').startsWith(month) &&
          String(expense.recurringId || '') === String(item.id)
        )
      }));
  }, [expenses, month, revision, localRevision]);

  const recent = useMemo(() => [
    ...monthIncomes.map((item) => ({ ...item, kind: 'income' })),
    ...monthExpenses.map((item) => ({ ...item, kind: 'expense' }))
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7), [monthIncomes, monthExpenses]);

  function refresh() {
    setLocalRevision((value) => value + 1);
    emitChange();
  }

  function openSection(id) {
    setSection(id);
    localStorage.setItem('god-section', id);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function moveMonth(delta) {
    const next = changeMonth(month, delta);
    setMonth(next);
    localStorage.setItem('ux-selected-month', next);
    refresh();
  }

  function formatMoney(value) {
    return privateMode ? '••••••' : CURRENCY.format(Number(value || 0));
  }

  function addExpense(payload) {
    const item = {
      id: createId('expense'),
      category: payload.category || 'Otros',
      amount: Number(payload.amount || 0),
      date: payload.date || todayForMonth(month),
      note: payload.note || ''
    };
    if (!(item.amount > 0)) return false;
    localStorage.setItem('expenses', JSON.stringify([item, ...expenses]));
    refresh();
    setMessage(`Gasto registrado: ${CURRENCY.format(item.amount)}`);
    return true;
  }

  function addIncome(payload) {
    const item = {
      id: createId('income'),
      type: payload.type || 'Ingreso',
      amount: Number(payload.amount || 0),
      date: payload.date || todayForMonth(month),
      note: payload.note || ''
    };
    if (!(item.amount > 0)) return false;
    saveIncomes([item, ...incomes]);
    refresh();
    setMessage(`Ingreso registrado: ${CURRENCY.format(item.amount)}`);
    return true;
  }

  function removeMovement(item) {
    if (!window.confirm('¿Eliminar este movimiento?')) return;
    if (item.kind === 'income') {
      saveIncomes(incomes.filter((candidate) => candidate.id !== item.id));
    } else {
      localStorage.setItem('expenses', JSON.stringify(expenses.filter((candidate) => candidate.id !== item.id)));
    }
    refresh();
  }

  function markLoanPaid(row) {
    if (row.expense) return;
    const expense = {
      id: createId('loan-payment'),
      category: 'Préstamo',
      amount: Number(row.item.amount || 0),
      date: monthDay(month, row.item.day || (row.number === 1 ? 15 : 30)),
      note: `Préstamo · pago ${row.number} de 2 · cuota regular`,
      recurringId: row.item.id,
      recurringSourceId: row.item.loanSourceId || row.item.id,
      regularLoanPayment: true,
      source: 'scheduled-loan',
      loanPaymentNumber: row.number,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('expenses', JSON.stringify([expense, ...expenses]));
    refresh();
    setMessage(`Pago ${row.number} de 2 registrado.`);
  }

  function undoLoanPaid(row) {
    if (!row.expense) return;
    localStorage.setItem(
      'expenses',
      JSON.stringify(expenses.filter((item) => item.id !== row.expense.id))
    );
    refresh();
    setMessage(`Pago ${row.number} deshecho.`);
  }

  function markRecurringPaid(row) {
    if (row.expense) return;
    const item = row.item;
    const expense = {
      id: createId('fixed-payment'),
      category: item.category || 'Otros',
      amount: Number(item.amount || 0),
      date: monthDay(month, item.day || 1),
      note: `${item.name || item.title || 'Pago programado'} · recurrente`,
      recurringId: item.id,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem('expenses', JSON.stringify([expense, ...expenses]));
    refresh();
  }

  function updateBudget(category, amount) {
    const next = updateBudgetForMonth({
      monthlyBudgets: allBudgets,
      monthKey: month,
      category,
      amount
    });
    saveAllMonthlyBudgets(next);
    refresh();
  }

  function copyPreviousBudget() {
    const source = changeMonth(month, -1);
    const next = copyBudgetBetweenMonths({
      monthlyBudgets: allBudgets,
      sourceMonth: source,
      destinationMonth: month
    });
    saveAllMonthlyBudgets(next);
    refresh();
    setMessage('Presupuesto copiado del mes anterior.');
  }

  function resetBudget() {
    if (!window.confirm('¿Restablecer este presupuesto a los valores base?')) return;
    const next = resetBudgetForMonth({ monthlyBudgets: allBudgets, monthKey: month });
    saveAllMonthlyBudgets(next);
    refresh();
  }

  function launch(selector) {
    document.querySelector(selector)?.click();
  }

  return (
    <div className="g-app">
      <div className="g-ambient g-ambient-a" />
      <div className="g-ambient g-ambient-b" />
      <div className="g-ambient g-ambient-c" />

      <header className="g-topbar">
        <div className="g-brand">
          <span className="g-brand-mark">Q</span>
          <div>
            <strong>Mi Presupuesto</strong>
            <small>Tu dinero, sin ruido.</small>
          </div>
        </div>

        <div className="g-top-actions">
          <button
            type="button"
            className="g-icon-button"
            onClick={() => setPrivateMode((value) => !value)}
            aria-label={privateMode ? 'Mostrar montos' : 'Ocultar montos'}
          >
            {privateMode ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button
            type="button"
            className="g-avatar-button"
            onClick={() => openSection('more')}
            aria-label="Abrir más opciones"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="g-month-bar">
        <button type="button" onClick={() => moveMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={20} /></button>
        <div>
          <small>MES ACTIVO</small>
          <strong>{formatMonthLabel(month)}</strong>
        </div>
        <button type="button" onClick={() => moveMonth(1)} aria-label="Mes siguiente"><ChevronRight size={20} /></button>
      </div>

      <main className="g-main">
        {section === 'home' && (
          <HomeView
            formatMoney={formatMoney}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            balance={balance}
            spendRatio={spendRatio}
            budgetRemaining={budgetRemaining}
            recent={recent}
            loanRows={loanRows}
            fixedRows={fixedRows}
            onAddExpense={() => setSheet({ type: 'expense' })}
            onAddIncome={() => setSheet({ type: 'income' })}
            onOpenMoves={() => openSection('moves')}
            onOpenBudget={() => openSection('budget')}
            onOpenLoan={() => openSection('loan')}
            onMarkLoan={markLoanPaid}
            onUndoLoan={undoLoanPaid}
            onMarkRecurring={markRecurringPaid}
          />
        )}

        {section === 'moves' && (
          <MovementsView
            month={month}
            incomes={monthIncomes}
            expenses={monthExpenses}
            formatMoney={formatMoney}
            onAddExpense={() => setSheet({ type: 'expense' })}
            onAddIncome={() => setSheet({ type: 'income' })}
            onDelete={removeMovement}
          />
        )}

        {section === 'budget' && (
          <BudgetView
            budgets={budgets}
            expenses={monthExpenses}
            formatMoney={formatMoney}
            totalBudget={budgetTotal}
            totalExpense={totalExpense}
            onChange={updateBudget}
            onCopy={copyPreviousBudget}
            onReset={resetBudget}
            onAddExpense={() => setSheet({ type: 'expense' })}
          />
        )}

        {section === 'loan' && (
          <LoanView
            loan={loan}
            breakdown={breakdown}
            rows={loanRows}
            formatMoney={formatMoney}
            onMark={markLoanPaid}
            onUndo={undoLoanPaid}
            onSaveLoan={(next) => {
              saveLoanSettings(next);
              refresh();
              setMessage('Configuración del préstamo guardada.');
            }}
          />
        )}

        {section === 'more' && (
          <MoreView
            onLaunchPlan={() => launch('.finance-hub-fab')}
            onLaunchSettings={() => launch('.product-settings-button')}
          />
        )}
      </main>

      <nav className="g-bottom-nav" aria-label="Navegación principal">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? 'is-active' : ''}
              onClick={() => openSection(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span><Icon size={20} strokeWidth={active ? 2.5 : 2} /></span>
              <small>{item.label}</small>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="g-fab"
        onClick={() => setSheet({ type: 'expense' })}
        aria-label="Registrar movimiento"
      >
        <Plus size={24} />
      </button>

      {sheet && (
        <MovementSheet
          type={sheet.type}
          month={month}
          onClose={() => setSheet(null)}
          onSave={(payload) => {
            const ok = sheet.type === 'income' ? addIncome(payload) : addExpense(payload);
            if (ok) setSheet(null);
          }}
        />
      )}

      {message && (
        <div className="g-toast" role="status">
          <Check size={16} />
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function HomeView({
  formatMoney, totalIncome, totalExpense, balance, spendRatio, budgetRemaining,
  recent, loanRows, fixedRows, onAddExpense, onAddIncome, onOpenMoves,
  onOpenBudget, onOpenLoan, onMarkLoan, onUndoLoan, onMarkRecurring
}) {
  const positive = balance >= 0;
  const paidLoan = loanRows.filter((row) => row.expense).length;
  const pendingFixed = fixedRows.filter((row) => !row.expense).slice(0, 3);

  return (
    <div className="g-stack">
      <section className="g-hero-card">
        <div className="g-hero-top">
          <div>
            <span className="g-kicker">BALANCE DISPONIBLE</span>
            <h1>{formatMoney(balance)}</h1>
            <p className={positive ? 'is-positive' : 'is-negative'}>
              {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {positive ? 'Vas con margen este mes' : 'Los gastos superan los ingresos'}
            </p>
          </div>
          <div className="g-spend-ring" style={{ '--value': `${Math.min(100, Math.max(0, spendRatio)) * 3.6}deg` }}>
            <div>
              <strong>{Math.round(spendRatio)}%</strong>
              <small>usado</small>
            </div>
          </div>
        </div>

        <div className="g-hero-stats">
          <div><span>Ingresos</span><strong>{formatMoney(totalIncome)}</strong></div>
          <div><span>Gastos</span><strong>{formatMoney(totalExpense)}</strong></div>
          <div><span>Presupuesto libre</span><strong>{formatMoney(budgetRemaining)}</strong></div>
        </div>

        <div className="g-quick-row">
          <button type="button" onClick={onAddIncome}><ArrowDownLeft size={18} /><span>Ingreso</span></button>
          <button type="button" onClick={onAddExpense}><ArrowUpRight size={18} /><span>Gasto</span></button>
          <button type="button" onClick={onOpenBudget}><BarChart3 size={18} /><span>Plan</span></button>
        </div>
      </section>

      <SectionTitle eyebrow="PRÓXIMO" title="Lo que requiere tu atención" />

      <section className="g-attention-grid">
        <article className="g-attention-card g-loan-attention">
          <div className="g-card-title">
            <span className="g-soft-icon"><Landmark size={18} /></span>
            <div><strong>Préstamo</strong><small>{paidLoan}/2 cuotas pagadas</small></div>
            <button type="button" onClick={onOpenLoan}><ChevronRight size={18} /></button>
          </div>
          <div className="g-installment-mini-list">
            {loanRows.map((row) => (
              <div className={row.expense ? 'is-paid' : ''} key={row.number}>
                <div>
                  <span>Pago {row.number} de 2</span>
                  <strong>{formatMoney(row.item.amount)}</strong>
                </div>
                {row.expense ? (
                  <button type="button" className="g-paid-chip" onClick={() => onUndoLoan(row)}>
                    <Check size={14} /> Pagado
                  </button>
                ) : (
                  <button type="button" className="g-pay-button" onClick={() => onMarkLoan(row)}>
                    Ya se pagó
                  </button>
                )}
              </div>
            ))}
          </div>
        </article>

        <article className="g-attention-card">
          <div className="g-card-title">
            <span className="g-soft-icon g-red"><CalendarDays size={18} /></span>
            <div><strong>Pagos programados</strong><small>{pendingFixed.length ? 'Pendientes del mes' : 'Todo al día'}</small></div>
          </div>
          {pendingFixed.length ? (
            <div className="g-fixed-list">
              {pendingFixed.map((row) => (
                <button type="button" key={row.item.id} onClick={() => onMarkRecurring(row)}>
                  <span>
                    <strong>{row.item.name || row.item.title || row.item.category}</strong>
                    <small>Día {row.item.day || 1}</small>
                  </span>
                  <b>{formatMoney(row.item.amount)}</b>
                  <Check size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="g-empty-inline"><Check size={18} /><span>No tienes pagos pendientes.</span></div>
          )}
        </article>
      </section>

      <div className="g-section-heading-row">
        <SectionTitle eyebrow="ACTIVIDAD" title="Últimos movimientos" compact />
        <button type="button" className="g-text-button" onClick={onOpenMoves}>Ver todos</button>
      </div>

      <MovementList items={recent} formatMoney={formatMoney} compact emptyText="Todavía no hay movimientos este mes." />
    </div>
  );
}

function MovementsView({ month, incomes, expenses, formatMoney, onAddIncome, onAddExpense, onDelete }) {
  const [filter, setFilter] = useState('all');
  const items = useMemo(() => [
    ...incomes.map((item) => ({ ...item, kind: 'income' })),
    ...expenses.map((item) => ({ ...item, kind: 'expense' }))
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [incomes, expenses]);

  const shown = filter === 'all' ? items : items.filter((item) => item.kind === filter);

  return (
    <div className="g-stack">
      <div className="g-page-head">
        <div><span className="g-kicker">MOVIMIENTOS</span><h1>Tu actividad</h1><p>{formatMonthLabel(month)}</p></div>
        <div className="g-dual-actions">
          <button type="button" className="g-secondary-action" onClick={onAddIncome}><ArrowDownLeft size={17} />Ingreso</button>
          <button type="button" className="g-primary-action" onClick={onAddExpense}><Plus size={17} />Gasto</button>
        </div>
      </div>

      <div className="g-segmented">
        {[['all', 'Todos'], ['income', 'Ingresos'], ['expense', 'Gastos']].map(([id, label]) => (
          <button key={id} type="button" className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>

      <MovementList items={shown} formatMoney={formatMoney} onDelete={onDelete} emptyText="No hay movimientos para este filtro." />
    </div>
  );
}

function MovementList({ items, formatMoney, onDelete, compact = false, emptyText }) {
  if (!items.length) return <div className="g-empty-state"><ReceiptText size={24} /><strong>Sin movimientos</strong><span>{emptyText}</span></div>;

  return (
    <section className={compact ? 'g-movement-list is-compact' : 'g-movement-list'}>
      {items.map((item) => {
        const income = item.kind === 'income';
        const meta = CATEGORY_META[item.category] || { icon: income ? ArrowDownLeft : ReceiptText, tone: income ? 'blue' : 'neutral' };
        const Icon = meta.icon;
        return (
          <article className="g-movement" key={item.id}>
            <span className={`g-movement-icon tone-${meta.tone}`}><Icon size={18} /></span>
            <div className="g-movement-copy">
              <strong>{income ? (item.type || 'Ingreso') : (item.category || 'Gasto')}</strong>
              <small>{item.note || (income ? 'Ingreso registrado' : 'Sin nota')} · {item.date}</small>
            </div>
            <strong className={income ? 'g-amount is-income' : 'g-amount'}>{income ? '+' : '−'}{formatMoney(item.amount)}</strong>
            {onDelete && (
              <button type="button" className="g-row-action" onClick={() => onDelete(item)} aria-label="Eliminar movimiento"><Trash2 size={16} /></button>
            )}
          </article>
        );
      })}
    </section>
  );
}

function BudgetView({ budgets, expenses, formatMoney, totalBudget, totalExpense, onChange, onCopy, onReset, onAddExpense }) {
  const spent = (category) => expenses
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <div className="g-stack">
      <div className="g-page-head">
        <div><span className="g-kicker">PLAN MENSUAL</span><h1>Presupuesto</h1><p>Define límites claros, no microgestión.</p></div>
        <button type="button" className="g-primary-action" onClick={onAddExpense}><Plus size={17} />Gasto</button>
      </div>

      <section className="g-budget-summary">
        <div><span>Planificado</span><strong>{formatMoney(totalBudget)}</strong></div>
        <div><span>Consumido</span><strong>{formatMoney(totalExpense)}</strong></div>
        <div><span>Disponible</span><strong>{formatMoney(Math.max(0, totalBudget - totalExpense))}</strong></div>
      </section>

      <div className="g-budget-toolbar">
        <button type="button" onClick={onCopy}><Copy size={16} />Copiar mes anterior</button>
        <button type="button" onClick={onReset}><RotateCcw size={16} />Restablecer</button>
      </div>

      <section className="g-budget-grid">
        {Object.entries(budgets).map(([category, budget]) => {
          const used = spent(category);
          const ratio = Number(budget) > 0 ? (used / Number(budget)) * 100 : 0;
          const meta = CATEGORY_META[category] || CATEGORY_META.Otros;
          const Icon = meta.icon;
          return (
            <article className={`g-budget-card tone-${meta.tone}`} key={category}>
              <div className="g-budget-card-head">
                <span className="g-soft-icon"><Icon size={18} /></span>
                <div><strong>{category}</strong><small>{Math.round(ratio)}% utilizado</small></div>
                <span className={ratio > 100 ? 'g-budget-state is-over' : 'g-budget-state'}>{ratio > 100 ? 'Excedido' : 'En control'}</span>
              </div>
              <div className="g-budget-numbers">
                <strong>{formatMoney(used)}</strong>
                <span>de {formatMoney(budget)}</span>
              </div>
              <div className="g-progress"><span style={{ width: `${Math.min(100, ratio)}%` }} /></div>
              <label className="g-budget-edit">
                <span>Límite mensual</span>
                <div><b>Q</b><input type="number" min="0" step="50" value={budget} onChange={(event) => onChange(category, event.target.value)} /></div>
              </label>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function LoanView({ loan, breakdown, rows, formatMoney, onMark, onUndo, onSaveLoan }) {
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState(loan);
  const [extra, setExtra] = useState(0);

  useEffect(() => setDraft(loan), [loan]);

  const normalized = {
    balance: Number(loan.currentBalance || 0),
    monthlyRate: Number(loan.monthlyInterestRate || 0) / 100,
    regularMonthlyPayment: Number(breakdown.monthlyPrincipalPayment || 0),
    extraMonthlyPayment: Number(extra || 0)
  };
  const scenarios = compareLoanScenarios(normalized);

  return (
    <div className="g-stack">
      <div className="g-page-head">
        <div><span className="g-kicker">PRÉSTAMO</span><h1>Tu deuda, clara.</h1><p>Cuotas normales separadas de los abonos extra.</p></div>
        <button type="button" className="g-secondary-action" onClick={() => setShowSettings((value) => !value)}><Settings size={17} />{showSettings ? 'Cerrar' : 'Ajustes'}</button>
      </div>

      <section className="g-loan-hero">
        <div><span>Saldo actual</span><h2>{formatMoney(loan.currentBalance)}</h2><small>{Number(loan.monthlyInterestRate || 0).toFixed(2)}% mensual</small></div>
        <div className="g-loan-stat"><span>Pago mensual</span><strong>{formatMoney(breakdown.monthlyTotalPayment)}</strong></div>
        <div className="g-loan-stat"><span>A capital</span><strong>{formatMoney(breakdown.monthlyPrincipalPayment)}</strong></div>
        <div className="g-loan-stat"><span>Cargos y seguros</span><strong>{formatMoney(breakdown.monthlyFees)}</strong></div>
      </section>

      <SectionTitle eyebrow="CUOTAS REGULARES" title="Pago de quincena" />
      <section className="g-loan-installments">
        {rows.map((row) => (
          <article className={row.expense ? 'is-paid' : ''} key={row.number}>
            <div className="g-installment-number"><span>0{row.number}</span><small>de 02</small></div>
            <div className="g-installment-copy"><span>Quincena {row.number}</span><strong>{formatMoney(row.item.amount)}</strong><small>Día {row.item.day || (row.number === 1 ? 15 : 30)}</small></div>
            {row.expense ? (
              <button type="button" className="g-paid-button" onClick={() => onUndo(row)}><Check size={16} />Pagado · deshacer</button>
            ) : (
              <button type="button" className="g-loan-pay" onClick={() => onMark(row)}>✓ Ya se pagó</button>
            )}
          </article>
        ))}
      </section>

      <section className="g-extra-card">
        <div className="g-card-title">
          <span className="g-soft-icon g-red"><Target size={18} /></span>
          <div><strong>Abono extra a capital</strong><small>Simula sin alterar tus cuotas normales</small></div>
        </div>
        <label className="g-extra-input"><span>Monto extra mensual</span><div><b>Q</b><input type="number" min="0" step="100" value={extra} onChange={(event) => setExtra(Number(event.target.value || 0))} /></div></label>
        <div className="g-scenario-grid">
          <div><span>Sin abono</span><strong>{scenarios.baseScenario.months} meses</strong><small>Interés: {formatMoney(scenarios.baseScenario.totalInterest)}</small></div>
          <div className="is-highlight"><span>Con abono</span><strong>{scenarios.extraScenario.months} meses</strong><small>Ahorras {formatMoney(scenarios.interestSaved)}</small></div>
        </div>
      </section>

      {showSettings && (
        <section className="g-settings-card">
          <SectionTitle eyebrow="CONFIGURACIÓN" title="Datos del préstamo" compact />
          <div className="g-settings-grid">
            <NumberField label="Saldo actual" value={draft.currentBalance} onChange={(value) => setDraft({ ...draft, currentBalance: value })} />
            <NumberField label="Interés mensual %" value={draft.monthlyInterestRate} step="0.01" onChange={(value) => setDraft({ ...draft, monthlyInterestRate: value })} />
            <NumberField label="Principal por quincena" value={draft.biweeklyPrincipalPayment} onChange={(value) => setDraft({ ...draft, biweeklyPrincipalPayment: value })} />
            <NumberField label="Administración" value={draft.biweeklyAdminFee} onChange={(value) => setDraft({ ...draft, biweeklyAdminFee: value })} />
            <NumberField label="Seguro de vida" value={draft.biweeklyLifeInsurance} onChange={(value) => setDraft({ ...draft, biweeklyLifeInsurance: value })} />
            <NumberField label="Otro seguro" value={draft.biweeklyOtherInsurance} onChange={(value) => setDraft({ ...draft, biweeklyOtherInsurance: value })} />
          </div>
          <button type="button" className="g-primary-action g-wide" onClick={() => onSaveLoan(draft)}><Save size={17} />Guardar configuración</button>
        </section>
      )}
    </div>
  );
}

function NumberField({ label, value, onChange, step = '0.01' }) {
  return <label className="g-field"><span>{label}</span><input type="number" step={step} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function MoreView({ onLaunchPlan, onLaunchSettings }) {
  return (
    <div className="g-stack">
      <div className="g-page-head"><div><span className="g-kicker">MÁS</span><h1>Herramientas</h1><p>Todo lo avanzado, sin estorbarte en el día a día.</p></div></div>

      <section className="g-more-grid">
        <button type="button" className="g-tool-card g-tool-navy" onClick={onLaunchPlan}>
          <span className="g-tool-icon"><Sparkles size={22} /></span>
          <div><strong>Plan y metas</strong><small>Recurrentes, ahorro y planificación.</small></div>
          <ChevronRight size={18} />
        </button>

        <button type="button" className="g-tool-card" onClick={onLaunchSettings}>
          <span className="g-tool-icon"><Settings size={22} /></span>
          <div><strong>Ajustes y reportes</strong><small>Seguridad, nube, exportación y preferencias.</small></div>
          <ChevronRight size={18} />
        </button>
      </section>

      <section className="g-privacy-note">
        <ShieldCheck size={20} />
        <div><strong>Datos bajo tu control</strong><small>La app conserva su sistema de respaldo, seguridad y sincronización ya configurado.</small></div>
      </section>

      <BackupPanel />
      <InstallAppButton />
    </div>
  );
}

function MovementSheet({ type, month, onClose, onSave }) {
  const income = type === 'income';
  const [form, setForm] = useState({
    amount: '',
    category: 'Comidas',
    type: 'Primera quincena',
    date: todayForMonth(month),
    note: ''
  });

  function submit(event) {
    event.preventDefault();
    onSave(form);
  }

  return (
    <div className="g-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="g-sheet" role="dialog" aria-modal="true">
        <div className="g-sheet-handle" />
        <header>
          <div><span className="g-kicker">{income ? 'NUEVO INGRESO' : 'NUEVO GASTO'}</span><h2>{income ? 'Registrar dinero recibido' : 'Registrar movimiento'}</h2></div>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </header>

        <form onSubmit={submit}>
          <label className="g-amount-field">
            <span>Monto</span>
            <div><b>Q</b><input autoFocus type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" /></div>
          </label>

          {income ? (
            <label className="g-field"><span>Tipo de ingreso</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Primera quincena</option><option>Segunda quincena</option><option>Bono</option><option>Comisión</option><option>Otro ingreso</option></select></label>
          ) : (
            <label className="g-field"><span>Categoría</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{Object.keys(CATEGORY_META).map((category) => <option key={category}>{category}</option>)}</select></label>
          )}

          <div className="g-sheet-grid">
            <label className="g-field"><span>Fecha</span><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label className="g-field"><span>Nota</span><input type="text" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Opcional" /></label>
          </div>

          <button className="g-primary-action g-sheet-save" type="submit"><Check size={18} />Guardar {income ? 'ingreso' : 'gasto'}</button>
        </form>
      </section>
    </div>
  );
}

function SectionTitle({ eyebrow, title, compact = false }) {
  return <div className={compact ? 'g-section-title is-compact' : 'g-section-title'}><span>{eyebrow}</span><h2>{title}</h2></div>;
}
