import React, { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORIES = ['Comidas', 'Gasolina', 'Teléfono', 'Luz', 'Internet', 'Préstamo', 'Otros'];
const INCOME_KEY = 'monthly-incomes';
const EXPENSE_KEY = 'expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

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

function safeLoad(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
}

function createId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function localToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentMonthKey() {
  return localToday().slice(0, 7);
}

function parseMonthLabel(label) {
  const normalized = String(label || '').trim().toLocaleLowerCase('es-GT');
  const match = normalized.match(/([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (!month) return null;
  return `${match[2]}-${String(month).padStart(2, '0')}`;
}

function selectedMonthFromDom() {
  const label = document.querySelector('.month-selector-copy strong')?.textContent;
  return parseMonthLabel(label);
}

function getSelectedMonth() {
  return selectedMonthFromDom() || localStorage.getItem(SELECTED_MONTH_KEY) || currentMonthKey();
}

function monthDifference(fromMonth, toMonth) {
  const [fromYear, fromValue] = fromMonth.split('-').map(Number);
  const [toYear, toValue] = toMonth.split('-').map(Number);
  return (toYear - fromYear) * 12 + (toValue - fromValue);
}

function restoreSelectedMonth() {
  const desired = localStorage.getItem(SELECTED_MONTH_KEY);
  const displayed = selectedMonthFromDom();
  if (!desired || !displayed || desired === displayed) return;

  const difference = monthDifference(displayed, desired);
  const selector = difference > 0
    ? '.month-selector .month-arrow:last-child'
    : '.month-selector .month-arrow:first-child';

  for (let index = 0; index < Math.min(Math.abs(difference), 24); index += 1) {
    window.setTimeout(() => document.querySelector(selector)?.click(), index * 35);
  }
}

function dateForSelectedMonth(month, preferredDay = null) {
  const today = localToday();
  if (month === today.slice(0, 7)) return today;

  const [year, monthValue] = month.split('-').map(Number);
  const lastDay = new Date(year, monthValue, 0).getDate();
  const safeDay = Math.min(Math.max(Number(preferredDay) || 1, 1), lastDay);
  return `${month}-${String(safeDay).padStart(2, '0')}`;
}

function sum(items) {
  return items.reduce((total, item) => total + Number(item.amount || 0), 0);
}

function getFinancialSnapshot(month = getSelectedMonth()) {
  const incomes = safeLoad(INCOME_KEY);
  const expenses = safeLoad(EXPENSE_KEY);
  const monthIncomes = incomes.filter((item) => String(item.date || '').startsWith(month));
  const monthExpenses = expenses.filter((item) => String(item.date || '').startsWith(month));

  const monthlyIncome = sum(monthIncomes);
  const monthlyExpenses = sum(monthExpenses);
  const allIncome = sum(incomes);
  const allExpenses = sum(expenses);

  return {
    month,
    monthlyIncome,
    monthlyExpenses,
    monthlyBalance: monthlyIncome - monthlyExpenses,
    cumulativeBalance: allIncome - allExpenses,
    incomeCount: monthIncomes.length,
    expenseCount: monthExpenses.length
  };
}

function formatMonth(month) {
  const [year, monthValue] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthValue - 1, 1));
}

function updateHeaderIncome(month = getSelectedMonth()) {
  const box = document.querySelector('.income-box');
  if (!box) return;

  const snapshot = getFinancialSnapshot(month);
  localStorage.setItem(SELECTED_MONTH_KEY, month);

  box.innerHTML = `
    <div class="ux-balance-header-grid">
      <div>
        <span class="ux-income-label">INGRESOS REGISTRADOS · ${formatMonth(month).toLocaleUpperCase('es-GT')}</span>
        <strong class="ux-income-value">${currency.format(snapshot.monthlyIncome)}</strong>
        <small>${snapshot.incomeCount} ingreso${snapshot.incomeCount === 1 ? '' : 's'} registrado${snapshot.incomeCount === 1 ? '' : 's'}</small>
      </div>
      <div>
        <span class="ux-income-label">GASTOS REGISTRADOS</span>
        <strong class="ux-income-value">${currency.format(snapshot.monthlyExpenses)}</strong>
        <small>${snapshot.expenseCount} gasto${snapshot.expenseCount === 1 ? '' : 's'} registrado${snapshot.expenseCount === 1 ? '' : 's'}</small>
      </div>
      <div>
        <span class="ux-income-label">BALANCE DEL MES</span>
        <strong class="ux-income-value ${snapshot.monthlyBalance < 0 ? 'negative' : ''}">${currency.format(snapshot.monthlyBalance)}</strong>
        <small>Ingresos menos gastos del mes seleccionado</small>
      </div>
      <div>
        <span class="ux-income-label">BALANCE ACUMULADO</span>
        <strong class="ux-income-value ${snapshot.cumulativeBalance < 0 ? 'negative' : ''}">${currency.format(snapshot.cumulativeBalance)}</strong>
        <small>Todos los ingresos menos todos los gastos</small>
      </div>
    </div>
  `;
}

function getPendingPayments(month = getSelectedMonth()) {
  const recurring = safeLoad('premium-recurring-expenses');
  const expenses = safeLoad(EXPENSE_KEY);
  const today = new Date();
  const isCurrentMonth = month === currentMonthKey();
  const comparisonDay = isCurrentMonth ? today.getDate() : 31;
  const paidIds = new Set(
    expenses
      .filter((item) => String(item.date || '').startsWith(month))
      .map((item) => item.recurringId)
      .filter(Boolean)
  );

  return recurring.filter(
    (item) => item.active && Number(item.day) <= comparisonDay && !paidIds.has(item.id)
  );
}

function getRecurringById(recurringId) {
  return safeLoad('premium-recurring-expenses').find((item) => item.id === recurringId);
}

function recurringAlreadyPaid(recurringId, month) {
  return safeLoad(EXPENSE_KEY).some(
    (item) => item.recurringId === recurringId && String(item.date || '').startsWith(month)
  );
}

function createRecurringExpense(item, month) {
  return {
    id: createId(),
    recurringId: item.id,
    category: item.category || 'Otros',
    amount: Number(item.amount || 0),
    date: dateForSelectedMonth(month, item.day),
    note: `${item.name} · recurrente`
  };
}

function registerRecurringPayment(item, month) {
  if (!item || recurringAlreadyPaid(item.id, month)) return null;
  const expense = createRecurringExpense(item, month);
  save(EXPENSE_KEY, [expense, ...safeLoad(EXPENSE_KEY)]);
  return expense;
}

async function showPendingNotifications(pending, month) {
  if (month !== currentMonthKey()) return;
  if (!pending.length || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const today = localToday();

  for (const item of pending) {
    const notificationKey = `recurring-notified:${today}:${item.id}`;
    if (sessionStorage.getItem(notificationKey) === 'true') continue;

    await registration.showNotification(`Pago pendiente: ${item.name}`, {
      body: `${currency.format(item.amount)} · ${item.category || 'Otros'} · vencía el día ${item.day}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `recurring-${month}-${item.id}`,
      renotify: false,
      requireInteraction: true,
      actions: [
        { action: 'mark-paid', title: 'Ya se pagó' },
        { action: 'open-app', title: 'Abrir app' }
      ],
      data: { recurringId: item.id }
    });

    sessionStorage.setItem(notificationKey, 'true');
  }
}

function exportSelectedMonthCsv() {
  const month = getSelectedMonth();
  const expenses = safeLoad(EXPENSE_KEY)
    .filter((item) => String(item.date || '').startsWith(month))
    .map((item) => ['Gasto', item.date, item.category, item.note, item.amount]);
  const incomes = safeLoad(INCOME_KEY)
    .filter((item) => String(item.date || '').startsWith(month))
    .map((item) => ['Ingreso', item.date, item.type || 'Ingreso', item.note, item.amount]);
  const rows = [['Tipo', 'Fecha', 'Categoría', 'Descripción', 'Monto'], ...incomes, ...expenses];
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mi-presupuesto-${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function UXConsolidation() {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Comidas');
  const [note, setNote] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => localStorage.getItem(SELECTED_MONTH_KEY) || currentMonthKey());
  const [pending, setPending] = useState(() => getPendingPayments(selectedMonth));
  const [message, setMessage] = useState('');
  const [undoExpense, setUndoExpense] = useState(null);
  const undoTimerRef = useRef(null);
  const reloadTimerRef = useRef(null);

  useEffect(() => {
    function refresh() {
      const month = getSelectedMonth();
      setSelectedMonth(month);
      updateHeaderIncome(month);
      const nextPending = getPendingPayments(month);
      setPending(nextPending);
      showPendingNotifications(nextPending, month).catch(() => {});
    }

    restoreSelectedMonth();
    const timer = window.setTimeout(refresh, 180);
    window.addEventListener('focus', refresh);
    window.addEventListener('budget-data-changed', refresh);

    const monthNode = document.querySelector('.month-selector-copy strong');
    const observer = monthNode
      ? new MutationObserver(() => window.setTimeout(refresh, 0))
      : null;
    observer?.observe(monthNode, { childList: true, characterData: true, subtree: true });

    const params = new URLSearchParams(window.location.search);
    const recurringId = params.get('paidRecurring');
    if (recurringId) {
      const month = getSelectedMonth();
      const recurring = getRecurringById(recurringId);
      const expense = registerRecurringPayment(recurring, month);
      if (expense) {
        setMessage(`${recurring.name} registrado como pagado desde la notificación.`);
        setUndoExpense(expense);
      }
      params.delete('paidRecurring');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', nextUrl);
      window.setTimeout(refresh, 100);
    }

    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('focus', refresh);
      window.removeEventListener('budget-data-changed', refresh);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  const pendingTotal = useMemo(
    () => pending.reduce((total, item) => total + Number(item.amount || 0), 0),
    [pending]
  );

  function scheduleRefresh() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setUndoExpense(null), 6000);
    reloadTimerRef.current = window.setTimeout(() => window.location.reload(), 6200);
  }

  function addExpense(event) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;

    const month = getSelectedMonth();
    localStorage.setItem(SELECTED_MONTH_KEY, month);
    const expense = {
      id: createId(),
      category,
      amount: numericAmount,
      date: dateForSelectedMonth(month),
      note: note.trim()
    };

    save(EXPENSE_KEY, [expense, ...safeLoad(EXPENSE_KEY)]);
    setAmount('');
    setNote('');
    setMessage(`Gasto de ${currency.format(numericAmount)} registrado en ${formatMonth(month)}.`);
    setUndoExpense(expense);
    updateHeaderIncome(month);
    scheduleRefresh();
  }

  function markPaid(item) {
    const month = getSelectedMonth();
    localStorage.setItem(SELECTED_MONTH_KEY, month);
    const expense = registerRecurringPayment(item, month);
    if (!expense) {
      setMessage(`${item.name} ya estaba registrado en ${formatMonth(month)}.`);
      setPending(getPendingPayments(month));
      return;
    }

    setPending((current) => current.filter((payment) => payment.id !== item.id));
    setMessage(`${item.name} registrado como pagado en ${formatMonth(month)}.`);
    setUndoExpense(expense);
    updateHeaderIncome(month);
    scheduleRefresh();
  }

  function undoLastExpense() {
    if (!undoExpense) return;
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    save(EXPENSE_KEY, safeLoad(EXPENSE_KEY).filter((item) => item.id !== undoExpense.id));
    setMessage('Registro deshecho.');
    setUndoExpense(null);
    setPending(getPendingPayments(getSelectedMonth()));
    updateHeaderIncome(getSelectedMonth());
  }

  function openExisting(selector) {
    setOpen(false);
    window.setTimeout(() => document.querySelector(selector)?.click(), 80);
  }

  return (
    <>
      <button type="button" className="ux-main-fab" onClick={() => {
        const month = getSelectedMonth();
        setSelectedMonth(month);
        setPending(getPendingPayments(month));
        setOpen(true);
      }} aria-label="Abrir acciones rápidas">
        <span>＋</span><strong>Registrar</strong>
        {!!pending.length && <b>{pending.length}</b>}
      </button>

      {open && (
        <div className="ux-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="ux-sheet" role="dialog" aria-modal="true" aria-label="Acciones rápidas">
            <header>
              <div><span>ACCESO RÁPIDO · {formatMonth(selectedMonth).toLocaleUpperCase('es-GT')}</span><h2>¿Qué deseas registrar?</h2></div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            </header>

            <form className="ux-quick-form" onSubmit={addExpense}>
              <label>Monto del gasto
                <div className="ux-amount-input"><span>Q</span><input autoFocus type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" /></div>
              </label>
              <div className="ux-quick-amounts">
                {[25, 50, 100, 250].map((value) => <button type="button" key={value} onClick={() => setAmount(String(value))}>Q{value}</button>)}
              </div>
              <div className="ux-category-chips">
                {CATEGORIES.map((item) => <button type="button" className={category === item ? 'active' : ''} key={item} onClick={() => setCategory(item)}>{item}</button>)}
              </div>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
              <button className="ux-primary" type="submit">Registrar gasto en {formatMonth(selectedMonth)}</button>
            </form>

            {!!pending.length && (
              <section className="ux-reminders">
                <div className="ux-section-title"><div><span>PAGOS POR CONFIRMAR</span><h3>{pending.length} pendiente{pending.length === 1 ? '' : 's'}</h3></div><strong>{currency.format(pendingTotal)}</strong></div>
                {pending.map((item) => (
                  <article key={item.id}>
                    <div><strong>{item.name}</strong><small>{item.category} · día {item.day}</small></div>
                    <span>{currency.format(item.amount)}</span>
                    <button type="button" onClick={() => markPaid(item)}>Ya se pagó</button>
                  </article>
                ))}
              </section>
            )}

            <section className="ux-more-actions">
              <button type="button" onClick={() => openExisting('.finance-hub-fab')}><span>◎</span><div><strong>Plan y metas</strong><small>Recurrentes, ahorro y búsqueda</small></div><b>›</b></button>
              <button type="button" onClick={() => openExisting('.product-settings-button')}><span>⚙</span><div><strong>Ajustes y seguridad</strong><small>PIN, apariencia y reportes</small></div><b>›</b></button>
              <button type="button" onClick={exportSelectedMonthCsv}><span>⇩</span><div><strong>Exportar {formatMonth(selectedMonth)}</strong><small>Descargar ingresos y gastos del mes</small></div><b>›</b></button>
            </section>

            {message && (
              <div className="ux-message">
                <span>{message}</span>
                {undoExpense && <button type="button" onClick={undoLastExpense}>Deshacer</button>}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
