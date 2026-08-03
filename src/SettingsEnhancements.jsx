import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasPin, savePin } from './SecurityGate';

const RECURRING_KEY = 'premium-recurring-expenses';
const EXPENSE_KEY = 'expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const NOTICE_KEY = 'recurring-notice-last-shown';

function loadArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveArray(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('budget-data-changed'));
}

function selectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function paymentDate(month, day) {
  const [year, monthNumber] = month.split('-').map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(Math.max(1, Number(day) || 1), maxDay)).padStart(2, '0')}`;
}

function money(value) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency',
    currency: 'GTQ',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function recurringStatus(item, month, paidIds) {
  if (!item.active) return { key: 'paused', label: 'Pausado' };
  if (paidIds.has(String(item.id))) return { key: 'paid', label: 'Pagado' };
  if (month !== currentMonthKey()) return { key: 'pending', label: 'Pendiente' };

  const today = new Date().getDate();
  const dueDay = Number(item.day || 1);
  if (dueDay < today) return { key: 'overdue', label: 'Vencido' };
  if (dueDay === today) return { key: 'today', label: 'Vence hoy' };
  return { key: 'pending', label: 'Pendiente' };
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `recurring-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function SettingsEnhancements() {
  const [target, setTarget] = useState(null);
  const [month, setMonth] = useState(selectedMonth);
  const [recurring, setRecurring] = useState(() => loadArray(RECURRING_KEY));
  const [expenses, setExpenses] = useState(() => loadArray(EXPENSE_KEY));
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [message, setMessage] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  useEffect(() => {
    function findTarget() {
      const nextTarget = document.querySelector('.product-panel-body');
      setTarget((current) => current === nextTarget ? current : nextTarget);
    }

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function refreshData() {
      setMonth(selectedMonth());
      setRecurring(loadArray(RECURRING_KEY));
      setExpenses(loadArray(EXPENSE_KEY));
    }

    refreshData();
    window.addEventListener('budget-data-changed', refreshData);
    window.addEventListener('storage', refreshData);
    window.addEventListener('focus', refreshData);
    return () => {
      window.removeEventListener('budget-data-changed', refreshData);
      window.removeEventListener('storage', refreshData);
      window.removeEventListener('focus', refreshData);
    };
  }, []);

  const paidIds = useMemo(() => new Set(
    expenses
      .filter((item) => String(item.date || '').startsWith(month) && item.recurringId)
      .map((item) => String(item.recurringId))
  ), [expenses, month]);

  const activeRows = useMemo(() => recurring.map((item) => ({
    item,
    status: recurringStatus(item, month, paidIds)
  })), [recurring, month, paidIds]);

  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (month !== currentMonthKey()) return;

    const attention = activeRows.filter(({ status }) => status.key === 'today' || status.key === 'overdue');
    if (!attention.length) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(NOTICE_KEY) === todayKey) return;

    try {
      new Notification('Pagos recurrentes pendientes', {
        body: `${attention.length} pago${attention.length === 1 ? '' : 's'} requiere${attention.length === 1 ? '' : 'n'} atención.`,
        icon: '/icons/icon-192.png',
        tag: 'mi-presupuesto-recurring'
      });
      localStorage.setItem(NOTICE_KEY, todayKey);
    } catch {
      // Algunos navegadores Android solo permiten notificaciones mediante push.
    }
  }, [activeRows, month]);

  async function changePin(event) {
    event.preventDefault();
    setMessage('');
    const pinAlreadyExisted = hasPin();

    if (newPin.length < 4 || newPin.length > 8) {
      setMessage('El PIN debe tener entre 4 y 8 dígitos.');
      return;
    }
    if (newPin !== confirmPin) {
      setMessage('Los PIN no coinciden.');
      return;
    }

    await savePin(newPin);
    setNewPin('');
    setConfirmPin('');
    setMessage(pinAlreadyExisted ? 'PIN actualizado correctamente.' : 'PIN activado correctamente.');
  }

  function markPaid(item) {
    const existing = expenses.some((expense) =>
      String(expense.date || '').startsWith(month) && String(expense.recurringId || '') === String(item.id)
    );

    if (existing) {
      setMessage(`${item.name || item.title || 'El pago'} ya está marcado como pagado.`);
      return;
    }

    const next = [
      ...expenses,
      {
        id: makeId(),
        amount: Number(item.amount || 0),
        category: item.category || 'Recurrente',
        note: item.name || item.title || item.description || 'Pago recurrente',
        date: paymentDate(month, item.day),
        recurringId: item.id,
        createdAt: new Date().toISOString()
      }
    ];

    saveArray(EXPENSE_KEY, next);
    setExpenses(next);
    setMessage(`${item.name || item.title || 'Pago'} marcado como pagado y agregado a gastos.`);
  }

  function undoPaid(item) {
    const next = expenses.filter((expense) => !(
      String(expense.date || '').startsWith(month) && String(expense.recurringId || '') === String(item.id)
    ));

    saveArray(EXPENSE_KEY, next);
    setExpenses(next);
    setMessage(`Se deshizo el pago de ${item.name || item.title || 'este recurrente'}.`);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      setMessage('Este dispositivo no admite notificaciones web.');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setMessage(permission === 'granted'
      ? 'Avisos activados. Se revisarán pagos al abrir o volver a la app.'
      : 'No se concedió permiso para notificaciones.');
  }

  if (!target || !target.isConnected) return null;

  return createPortal(
    <>
      <section className="product-setting-card product-stack settings-enhancement-card">
        <div>
          <h3>{hasPin() ? 'Cambiar PIN' : 'Crear PIN'}</h3>
          <p>Actualiza el PIN sin desactivar la protección ni borrar tus datos.</p>
        </div>
        <form className="settings-pin-editor" onSubmit={changePin}>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            minLength="4"
            maxLength="8"
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Nuevo PIN"
            aria-label="Nuevo PIN"
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            minLength="4"
            maxLength="8"
            value={confirmPin}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="Confirmar PIN"
            aria-label="Confirmar nuevo PIN"
          />
          <button type="submit" disabled={newPin.length < 4 || confirmPin.length < 4}>Guardar PIN</button>
        </form>
      </section>

      <section className="product-setting-card product-stack settings-enhancement-card recurring-control-card">
        <div className="recurring-control-heading">
          <div>
            <h3>Pagos recurrentes</h3>
            <p>Marca pagos del mes, deshaz errores y activa avisos.</p>
          </div>
          {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
            <button type="button" className="product-secondary" onClick={enableNotifications}>Activar avisos</button>
          )}
        </div>

        <div className="recurring-control-list">
          {activeRows.length ? activeRows.map(({ item, status }) => (
            <article key={item.id} className={`recurring-control-row is-${status.key}`}>
              <div>
                <strong>{item.name || item.title || item.description || 'Pago recurrente'}</strong>
                <small>Día {Number(item.day || 1)} · {money(item.amount)}</small>
              </div>
              <span className={`recurring-status is-${status.key}`}>{status.label}</span>
              {status.key === 'paid' ? (
                <button type="button" className="product-secondary" onClick={() => undoPaid(item)}>Deshacer</button>
              ) : item.active ? (
                <button type="button" onClick={() => markPaid(item)}>Marcar pagado</button>
              ) : null}
            </article>
          )) : <p className="recurring-empty">Todavía no hay gastos recurrentes configurados.</p>}
        </div>
      </section>

      {message && <div className="product-status settings-enhancement-status">{message}</div>}
    </>,
    target
  );
}
