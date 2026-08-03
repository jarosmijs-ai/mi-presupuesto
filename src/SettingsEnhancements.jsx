import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { hasPin, removePin, savePin } from './SecurityGate';

const RECURRING_KEY = 'premium-recurring-expenses';
const EXPENSE_KEY = 'expenses';
const SELECTED_MONTH_KEY = 'ux-selected-month';
const NOTICE_KEY = 'recurring-reminder-last-date';

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

function localDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function paymentDate(month, day) {
  const [year, monthNumber] = month.split('-').map(Number);
  const maxDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(Math.min(Math.max(1, Number(day) || 1), maxDay)).padStart(2, '0')}`;
}

function money(value) {
  return new Intl.NumberFormat('es-GT', {
    style: 'currency', currency: 'GTQ', maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function statusFor(item, month, paidIds) {
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

async function showReminderNotification(attentionRows) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  if (!attentionRows.length) return false;

  const first = attentionRows[0]?.item;
  const firstName = first?.name || first?.title || first?.description || 'Pago recurrente';
  const extra = attentionRows.length - 1;
  const body = extra > 0
    ? `${firstName} y ${extra} pago${extra === 1 ? '' : 's'} más siguen sin marcarse como pagados.`
    : `${firstName} sigue sin marcarse como pagado. Abre la app para confirmarlo.`;

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'mi-presupuesto-recurring-reminder',
    renotify: false,
    data: { url: '/' }
  };

  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration?.showNotification) {
      await registration.showNotification('¿Ya pagaste tus recurrentes?', options);
    } else {
      new Notification('¿Ya pagaste tus recurrentes?', options);
    }
    return true;
  } catch {
    return false;
  }
}

export default function SettingsEnhancements() {
  const [open, setOpen] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinEnabled, setPinEnabled] = useState(hasPin());
  const [message, setMessage] = useState('');
  const [month, setMonth] = useState(selectedMonth);
  const [recurring, setRecurring] = useState(() => loadArray(RECURRING_KEY));
  const [expenses, setExpenses] = useState(() => loadArray(EXPENSE_KEY));
  const [notificationPermission, setNotificationPermission] = useState(() =>
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const paidIds = useMemo(() => new Set(
    expenses
      .filter((item) => String(item.date || '').startsWith(month) && item.recurringId)
      .map((item) => String(item.recurringId))
  ), [expenses, month]);

  const rows = useMemo(() => recurring.map((item) => ({ item, status: statusFor(item, month, paidIds) })), [recurring, month, paidIds]);
  const attentionRows = useMemo(() => rows.filter(({ status }) => status.key === 'today' || status.key === 'overdue'), [rows]);

  function refreshData() {
    setMonth(selectedMonth());
    setRecurring(loadArray(RECURRING_KEY));
    setExpenses(loadArray(EXPENSE_KEY));
    setPinEnabled(hasPin());
    if ('Notification' in window) setNotificationPermission(Notification.permission);
  }

  useEffect(() => {
    const refresh = () => refreshData();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('budget-data-changed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('budget-data-changed', refresh);
    };
  }, []);

  useEffect(() => {
    if (month !== currentMonthKey() || !attentionRows.length) return;
    const today = localDateKey();
    if (localStorage.getItem(NOTICE_KEY) === today) return;

    showReminderNotification(attentionRows).then((shown) => {
      if (shown) localStorage.setItem(NOTICE_KEY, today);
    });
  }, [attentionRows, month]);

  async function saveNewPin(event) {
    event.preventDefault();
    setMessage('');
    if (newPin.length < 4 || newPin.length > 8) return setMessage('El PIN debe tener entre 4 y 8 dígitos.');
    if (newPin !== confirmPin) return setMessage('Los PIN no coinciden.');
    await savePin(newPin);
    setPinEnabled(true);
    setNewPin('');
    setConfirmPin('');
    setMessage('PIN guardado correctamente.');
  }

  function disablePin() {
    removePin();
    setPinEnabled(false);
    setNewPin('');
    setConfirmPin('');
    setMessage('PIN desactivado.');
  }

  function markPaid(item) {
    if (paidIds.has(String(item.id))) return;
    const next = [...expenses, {
      id: makeId(), amount: Number(item.amount || 0), category: item.category || 'Recurrente',
      note: item.name || item.title || item.description || 'Pago recurrente',
      date: paymentDate(month, item.day), recurringId: item.id, createdAt: new Date().toISOString()
    }];
    saveArray(EXPENSE_KEY, next);
    setExpenses(next);
    setMessage(`${item.name || item.title || 'Pago'} marcado como pagado y agregado a gastos.`);
  }

  function undoPaid(item) {
    const next = expenses.filter((expense) => !(String(expense.date || '').startsWith(month) && String(expense.recurringId || '') === String(item.id)));
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
    if (permission !== 'granted') {
      setMessage('No se concedió permiso para enviar recordatorios.');
      return;
    }

    setMessage('Recordatorios activados. La app te avisará al abrirla cuando haya pagos vencidos o que vencen hoy.');
    const shown = await showReminderNotification(attentionRows);
    if (shown) localStorage.setItem(NOTICE_KEY, localDateKey());
  }

  return (
    <>
      <button type="button" className="quick-security-button" onClick={() => { refreshData(); setOpen(true); }} aria-label="Seguridad y pagos recurrentes">
        🔐
        {attentionRows.length > 0 && <span className="quick-security-badge">{attentionRows.length}</span>}
      </button>
      {open && createPortal(
        <div className="quick-security-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="quick-security-panel" role="dialog" aria-modal="true" aria-label="Seguridad y pagos recurrentes">
            <header><div><span>SEGURIDAD</span><h2>PIN y pagos recurrentes</h2></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button></header>
            <div className="quick-security-body">
              <section className="product-setting-card product-stack">
                <div><h3>{pinEnabled ? 'Cambiar o desactivar PIN' : 'Activar PIN'}</h3><p>Configura un PIN local de 4 a 8 dígitos sin borrar tus datos.</p></div>
                <form className="settings-pin-editor" onSubmit={saveNewPin}>
                  <input type="password" inputMode="numeric" value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Nuevo PIN" />
                  <input type="password" inputMode="numeric" value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Confirmar PIN" />
                  <button type="submit" disabled={newPin.length < 4 || confirmPin.length < 4}>{pinEnabled ? 'Cambiar PIN' : 'Activar PIN'}</button>
                </form>
                {pinEnabled && <button type="button" className="product-secondary" onClick={disablePin}>Desactivar PIN</button>}
              </section>

              <section className="product-setting-card product-stack">
                <div className="recurring-control-heading">
                  <div>
                    <h3>Pagos recurrentes</h3>
                    <p>El estado Activo indica que el recordatorio existe. El estado de pago mensual aparece abajo.</p>
                  </div>
                  {notificationPermission !== 'granted' && notificationPermission !== 'unsupported' && (
                    <button type="button" className="product-secondary" onClick={enableNotifications}>Activar avisos</button>
                  )}
                  {notificationPermission === 'granted' && <span className="notification-enabled">Avisos activos</span>}
                </div>

                <div className="recurring-control-list">
                  {rows.length ? rows.map(({ item, status }) => (
                    <article key={item.id} className={`recurring-control-row is-${status.key}`}>
                      <div>
                        <strong>{item.name || item.title || item.description || 'Pago recurrente'}</strong>
                        <small>Día {Number(item.day || 1)} · {money(item.amount)}</small>
                      </div>
                      <span className={`recurring-status is-${status.key}`}>{status.label}</span>
                      {status.key === 'paid'
                        ? <button type="button" className="product-secondary" onClick={() => undoPaid(item)}>Deshacer pago</button>
                        : item.active && <button type="button" onClick={() => markPaid(item)}>Marcar pagado</button>}
                    </article>
                  )) : <p className="recurring-empty">Todavía no hay gastos recurrentes configurados.</p>}
                </div>
              </section>
              {message && <div className="product-status">{message}</div>}
            </div>
          </section>
        </div>, document.body
      )}
    </>
  );
}
