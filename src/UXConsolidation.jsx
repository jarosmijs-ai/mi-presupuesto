import React, { useEffect, useMemo, useRef, useState } from 'react';

const CATEGORIES = ['Comidas', 'Gasolina', 'Teléfono', 'Luz', 'Internet', 'Préstamo', 'Otros'];
const currency = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

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

function id() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function dateForDay(day) {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), last);
  return `${monthKey()}-${String(safeDay).padStart(2, '0')}`;
}

function getFinancialSnapshot() {
  const incomes = safeLoad('incomes');
  const expenses = safeLoad('expenses');
  const month = monthKey();
  const monthIncomes = incomes.filter((item) => String(item.date || '').startsWith(month));
  const monthExpenses = expenses.filter((item) => String(item.date || '').startsWith(month));
  const sum = (items) => items.reduce((total, item) => total + Number(item.amount || 0), 0);

  const monthlyIncome = sum(monthIncomes);
  const monthlyExpenses = sum(monthExpenses);
  const allIncome = sum(incomes);
  const allExpenses = sum(expenses);

  return {
    monthlyIncome,
    monthlyExpenses,
    monthlyBalance: monthlyIncome - monthlyExpenses,
    cumulativeBalance: allIncome - allExpenses,
    incomeCount: monthIncomes.length
  };
}

function updateHeaderIncome() {
  const box = document.querySelector('.income-box');
  if (!box) return;
  const snapshot = getFinancialSnapshot();
  box.innerHTML = `
    <div class="ux-balance-header-grid">
      <div>
        <span class="ux-income-label">INGRESOS REGISTRADOS ESTE MES</span>
        <strong class="ux-income-value">${currency.format(snapshot.monthlyIncome)}</strong>
        <small>${snapshot.incomeCount} movimiento${snapshot.incomeCount === 1 ? '' : 's'} registrado${snapshot.incomeCount === 1 ? '' : 's'}</small>
      </div>
      <div>
        <span class="ux-income-label">BALANCE DEL MES</span>
        <strong class="ux-income-value ${snapshot.monthlyBalance < 0 ? 'negative' : ''}">${currency.format(snapshot.monthlyBalance)}</strong>
        <small>Después de ${currency.format(snapshot.monthlyExpenses)} en gastos</small>
      </div>
      <div>
        <span class="ux-income-label">BALANCE ACUMULADO</span>
        <strong class="ux-income-value ${snapshot.cumulativeBalance < 0 ? 'negative' : ''}">${currency.format(snapshot.cumulativeBalance)}</strong>
        <small>Todos los ingresos menos todos los gastos</small>
      </div>
    </div>
  `;
}

function getPendingPayments() {
  const recurring = safeLoad('premium-recurring-expenses');
  const expenses = safeLoad('expenses');
  const month = monthKey();
  const today = new Date().getDate();
  const paidIds = new Set(
    expenses
      .filter((item) => String(item.date || '').startsWith(month))
      .map((item) => item.recurringId)
      .filter(Boolean)
  );

  return recurring.filter(
    (item) => item.active && Number(item.day) <= today && !paidIds.has(item.id)
  );
}

function getRecurringById(recurringId) {
  return safeLoad('premium-recurring-expenses').find((item) => item.id === recurringId);
}

function createRecurringExpense(item) {
  return {
    id: id(),
    recurringId: item.id,
    category: item.category || 'Otros',
    amount: Number(item.amount || 0),
    date: dateForDay(item.day),
    note: `${item.name} · recurrente`
  };
}

function recurringAlreadyPaid(recurringId) {
  const month = monthKey();
  return safeLoad('expenses').some(
    (item) => item.recurringId === recurringId && String(item.date || '').startsWith(month)
  );
}

function registerRecurringPayment(item) {
  if (!item || recurringAlreadyPaid(item.id)) return null;
  const expense = createRecurringExpense(item);
  save('expenses', [expense, ...safeLoad('expenses')]);
  return expense;
}

async function showPendingNotifications(pending) {
  if (!pending.length || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (!('serviceWorker' in navigator)) return;

  const registration = await navigator.serviceWorker.ready;
  const today = new Date().toISOString().slice(0, 10);

  for (const item of pending) {
    const notificationKey = `recurring-notified:${today}:${item.id}`;
    if (sessionStorage.getItem(notificationKey) === 'true') continue;

    await registration.showNotification(`Pago pendiente: ${item.name}`, {
      body: `${currency.format(item.amount)} · ${item.category || 'Otros'} · vencía el día ${item.day}`,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `recurring-${monthKey()}-${item.id}`,
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

function exportCurrentMonthCsv() {
  const month = monthKey();
  const expenses = safeLoad('expenses')
    .filter((item) => String(item.date || '').startsWith(month))
    .map((item) => ['Gasto', item.date, item.category, item.note, item.amount]);
  const incomes = safeLoad('incomes')
    .filter((item) => String(item.date || '').startsWith(month))
    .map((item) => ['Ingreso', item.date, item.source || 'Ingreso', item.note, item.amount]);
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
  const [pending, setPending] = useState(getPendingPayments);
  const [message, setMessage] = useState('');
  const [undoExpense, setUndoExpense] = useState(null);
  const undoTimerRef = useRef(null);

  useEffect(() => {
    function refresh() {
      updateHeaderIncome();
      const nextPending = getPendingPayments();
      setPending(nextPending);
      showPendingNotifications(nextPending).catch(() => {});
    }

    const timer = window.setTimeout(refresh, 80);
    window.addEventListener('focus', refresh);
    window.addEventListener('budget-data-changed', refresh);

    const params = new URLSearchParams(window.location.search);
    const recurringId = params.get('paidRecurring');
    if (recurringId) {
      const recurring = getRecurringById(recurringId);
      const expense = registerRecurringPayment(recurring);
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
      window.removeEventListener('focus', refresh);
      window.removeEventListener('budget-data-changed', refresh);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const pendingTotal = useMemo(
    () => pending.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [pending]
  );

  function scheduleUndoClear() {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setUndoExpense(null), 6000);
  }

  function addExpense(event) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    const expense = {
      id: id(),
      category,
      amount: numericAmount,
      date: new Date().toISOString().slice(0, 10),
      note: note.trim()
    };
    save('expenses', [expense, ...safeLoad('expenses')]);
    setAmount('');
    setNote('');
    setMessage(`Gasto de ${currency.format(numericAmount)} registrado.`);
    setUndoExpense(expense);
    scheduleUndoClear();
    updateHeaderIncome();
  }

  function markPaid(item) {
    const expense = registerRecurringPayment(item);
    if (!expense) {
      setMessage(`${item.name} ya estaba registrado este mes.`);
      setPending(getPendingPayments());
      return;
    }
    setPending((current) => current.filter((payment) => payment.id !== item.id));
    setMessage(`${item.name} registrado como pagado.`);
    setUndoExpense(expense);
    scheduleUndoClear();
    updateHeaderIncome();
  }

  function undoLastExpense() {
    if (!undoExpense) return;
    const expenses = safeLoad('expenses').filter((item) => item.id !== undoExpense.id);
    save('expenses', expenses);
    setMessage('Registro deshecho.');
    setUndoExpense(null);
    setPending(getPendingPayments());
    updateHeaderIncome();
  }

  function openExisting(selector) {
    setOpen(false);
    window.setTimeout(() => document.querySelector(selector)?.click(), 80);
  }

  return (
    <>
      <button type="button" className="ux-main-fab" onClick={() => { setPending(getPendingPayments()); setOpen(true); }} aria-label="Abrir acciones rápidas">
        <span>＋</span><strong>Registrar</strong>
        {!!pending.length && <b>{pending.length}</b>}
      </button>

      {open && (
        <div className="ux-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="ux-sheet" role="dialog" aria-modal="true" aria-label="Acciones rápidas">
            <header>
              <div><span>ACCESO RÁPIDO</span><h2>¿Qué deseas hacer?</h2></div>
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
              <button className="ux-primary" type="submit">Registrar gasto</button>
            </form>

            {!!pending.length && (
              <section className="ux-reminders">
                <div className="ux-section-title"><div><span>PAGOS POR CONFIRMAR</span><h3>{pending.length} pendiente{pending.length === 1 ? '' : 's'}</h3></div><strong>{currency.format(pendingTotal)}</strong></div>
                {pending.map((item) => (
                  <article key={item.id}>
                    <div><strong>{item.name}</strong><small>{item.category} · vencía el día {item.day}</small></div>
                    <span>{currency.format(item.amount)}</span>
                    <button type="button" onClick={() => markPaid(item)}>Ya se pagó</button>
                  </article>
                ))}
              </section>
            )}

            <section className="ux-more-actions">
              <button type="button" onClick={() => openExisting('.finance-hub-fab')}><span>◎</span><div><strong>Plan y metas</strong><small>Recurrentes, ahorro y búsqueda</small></div><b>›</b></button>
              <button type="button" onClick={() => openExisting('.product-settings-button')}><span>⚙</span><div><strong>Ajustes y seguridad</strong><small>PIN, apariencia y reportes</small></div><b>›</b></button>
              <button type="button" onClick={exportCurrentMonthCsv}><span>⇩</span><div><strong>Exportar este mes</strong><small>Descargar movimientos en CSV</small></div><b>›</b></button>
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
