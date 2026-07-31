import React, { useEffect, useMemo, useState } from 'react';

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

function currentMonthIncomes() {
  const month = monthKey();
  return safeLoad('incomes').filter((item) => String(item.date || '').startsWith(month));
}

function updateHeaderIncome() {
  const box = document.querySelector('.income-box');
  if (!box) return;
  const incomes = currentMonthIncomes();
  const total = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  box.innerHTML = `
    <span class="ux-income-label">INGRESOS REGISTRADOS ESTE MES</span>
    <strong class="ux-income-value">${currency.format(total)}</strong>
    <small>${incomes.length} movimiento${incomes.length === 1 ? '' : 's'} registrado${incomes.length === 1 ? '' : 's'}</small>
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

  useEffect(() => {
    const timer = window.setTimeout(updateHeaderIncome, 50);
    window.addEventListener('focus', updateHeaderIncome);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', updateHeaderIncome);
    };
  }, []);

  const pendingTotal = useMemo(
    () => pending.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [pending]
  );

  function addExpense(event) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    const expenses = safeLoad('expenses');
    save('expenses', [{ id: id(), category, amount: numericAmount, date: new Date().toISOString().slice(0, 10), note: note.trim() }, ...expenses]);
    setAmount('');
    setNote('');
    setMessage('Gasto registrado.');
    window.setTimeout(() => window.location.reload(), 450);
  }

  function markPaid(item) {
    const expenses = safeLoad('expenses');
    save('expenses', [{
      id: id(),
      recurringId: item.id,
      category: item.category || 'Otros',
      amount: Number(item.amount || 0),
      date: dateForDay(item.day),
      note: `${item.name} · recurrente`
    }, ...expenses]);
    setPending((current) => current.filter((payment) => payment.id !== item.id));
    setMessage(`${item.name} registrado como pagado.`);
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

            {message && <div className="ux-message">{message}</div>}
          </section>
        </div>
      )}
    </>
  );
}
