import React, { useEffect, useMemo, useState } from 'react';
import { cloudConfigured, getSession, pullBackup, pushBackup, signIn, signOut, signUp } from './cloudSync';
import { hasPin, removePin, savePin } from './SecurityGate';

const SETTINGS_KEY = 'app-settings';

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || { theme: 'light' };
  } catch {
    return { theme: 'light' };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function safeParse(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const expenses = safeParse('expenses').map((item) => ({
    tipo: 'Gasto', fecha: item.date, categoria: item.category, descripcion: item.note, monto: item.amount
  }));
  const incomes = safeParse('incomes').map((item) => ({
    tipo: 'Ingreso', fecha: item.date, categoria: item.source || 'Ingreso', descripcion: item.note, monto: item.amount
  }));
  const rows = [...expenses, ...incomes].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const header = ['Tipo', 'Fecha', 'Categoría', 'Descripción', 'Monto'];
  const csv = [header, ...rows.map((row) => Object.values(row))]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
  downloadFile(`mi-presupuesto-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

function printReport() {
  const expenses = safeParse('expenses');
  const incomes = safeParse('incomes');
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalIncomes = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>Reporte Mi Presupuesto</title><style>body{font-family:Arial;padding:40px;color:#14213d}h1{margin-bottom:6px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:30px 0}.card{border:1px solid #ddd;border-radius:14px;padding:18px}.label{color:#667085;font-size:12px;text-transform:uppercase}.value{font-size:24px;font-weight:700;margin-top:8px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px;border-bottom:1px solid #eee}th{font-size:12px;text-transform:uppercase;color:#667085}@media print{button{display:none}}</style></head><body><h1>Mi Presupuesto</h1><p>Reporte generado el ${new Date().toLocaleDateString('es-GT')}</p><div class="grid"><div class="card"><div class="label">Ingresos</div><div class="value">Q ${totalIncomes.toFixed(2)}</div></div><div class="card"><div class="label">Gastos</div><div class="value">Q ${totalExpenses.toFixed(2)}</div></div><div class="card"><div class="label">Balance</div><div class="value">Q ${(totalIncomes-totalExpenses).toFixed(2)}</div></div></div><h2>Movimientos</h2><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Monto</th></tr></thead><tbody>${[...incomes.map(i=>({...i,tipo:'Ingreso'})),...expenses.map(i=>({...i,tipo:'Gasto'}))].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,200).map(item=>`<tr><td>${item.date||''}</td><td>${item.tipo}</td><td>${item.category||item.source||item.note||''}</td><td>Q ${Number(item.amount||0).toFixed(2)}</td></tr>`).join('')}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`);
  popup.document.close();
}

function notifyDuePayments() {
  const recurring = safeParse('premium-recurring-expenses');
  const today = new Date().getDate();
  const due = recurring.filter((item) => item.active && Number(item.day) <= today);
  if (!due.length || Notification.permission !== 'granted') return;
  new Notification('Mi Presupuesto', {
    body: `${due.length} pago${due.length === 1 ? '' : 's'} recurrente${due.length === 1 ? '' : 's'} podría${due.length === 1 ? '' : 'n'} estar pendiente${due.length === 1 ? '' : 's'}.`,
    icon: '/icons/icon-192.png'
  });
}

export default function ProductCenter() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(loadSettings);
  const [pin, setPin] = useState('');
  const [session, setSession] = useState(null);
  const [auth, setAuth] = useState({ email: '', password: '' });
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    getSession().then(setSession).catch(() => {});
    notifyDuePayments();
  }, []);

  const email = useMemo(() => session?.user?.email || '', [session]);

  async function run(action, success) {
    setBusy(true);
    setStatus('');
    try {
      await action();
      setStatus(success);
    } catch (error) {
      setStatus(error.message || 'Ocurrió un error.');
    } finally {
      setBusy(false);
    }
  }

  async function enablePin(event) {
    event.preventDefault();
    if (pin.length < 4) return;
    await savePin(pin);
    setPin('');
    setStatus('PIN activado. La app se bloqueará al cerrar la sesión actual.');
  }

  async function requestNotifications() {
    if (!('Notification' in window)) {
      setStatus('Este dispositivo no admite notificaciones web.');
      return;
    }
    const permission = await Notification.requestPermission();
    setStatus(permission === 'granted' ? 'Notificaciones activadas.' : 'No se concedió permiso para notificaciones.');
    if (permission === 'granted') notifyDuePayments();
  }

  async function handleSignIn(mode) {
    await run(async () => {
      const result = mode === 'signup'
        ? await signUp(auth.email, auth.password)
        : await signIn(auth.email, auth.password);
      if (result.error) throw result.error;
      setSession(await getSession());
    }, mode === 'signup' ? 'Cuenta creada. Revisa tu correo si se requiere confirmación.' : 'Sesión iniciada.');
  }

  return (
    <>
      <button type="button" className="product-settings-button" onClick={() => setOpen(true)} aria-label="Configuración y seguridad">⚙</button>
      {open && (
        <div className="product-overlay" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section className="product-panel" role="dialog" aria-modal="true" aria-label="Configuración de la aplicación">
            <header><div><span>CONFIGURACIÓN</span><h2>Cuenta, seguridad y datos</h2></div><button type="button" onClick={() => setOpen(false)}>×</button></header>
            <div className="product-panel-body">
              <section className="product-setting-card">
                <div><h3>Apariencia</h3><p>Elige el modo que mejor se adapte a tu dispositivo.</p></div>
                <div className="product-segmented"><button className={settings.theme === 'light' ? 'active' : ''} onClick={() => setSettings({ ...settings, theme: 'light' })}>Claro</button><button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => setSettings({ ...settings, theme: 'dark' })}>Oscuro</button></div>
              </section>

              <section className="product-setting-card product-stack">
                <div><h3>Bloqueo con PIN</h3><p>Protege la app con un PIN local de 4 a 8 dígitos.</p></div>
                {hasPin() ? <button className="product-secondary" onClick={() => { removePin(); setStatus('PIN desactivado.'); }}>Desactivar PIN</button> : <form className="product-inline-form" onSubmit={enablePin}><input type="password" inputMode="numeric" minLength="4" maxLength="8" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="Nuevo PIN" /><button type="submit">Activar</button></form>}
              </section>

              <section className="product-setting-card product-stack">
                <div><h3>Exportar y reportar</h3><p>Descarga tus movimientos o genera un reporte imprimible.</p></div>
                <div className="product-action-row"><button onClick={exportCsv}>Exportar CSV</button><button onClick={printReport}>Reporte PDF</button><button onClick={requestNotifications}>Recordatorios</button></div>
              </section>

              <section className="product-setting-card product-stack">
                <div><h3>Sincronización en la nube</h3><p>{cloudConfigured ? 'Respalda y recupera tus datos entre dispositivos.' : 'La función está preparada, pero falta conectar Supabase en Vercel.'}</p></div>
                {cloudConfigured && !session && <><input type="email" value={auth.email} onChange={(e) => setAuth({ ...auth, email: e.target.value })} placeholder="Correo" /><input type="password" minLength="6" value={auth.password} onChange={(e) => setAuth({ ...auth, password: e.target.value })} placeholder="Contraseña" /><div className="product-action-row"><button disabled={busy} onClick={() => handleSignIn('signin')}>Entrar</button><button disabled={busy} onClick={() => handleSignIn('signup')}>Crear cuenta</button></div></>}
                {session && <><div className="product-account"><span>Conectado como</span><strong>{email}</strong></div><div className="product-action-row"><button disabled={busy} onClick={() => run(pushBackup, 'Respaldo enviado a la nube.')}>Subir respaldo</button><button disabled={busy} onClick={() => run(async () => { await pullBackup(); window.location.reload(); }, 'Datos restaurados.')}>Restaurar nube</button><button className="product-secondary" onClick={() => run(async () => { await signOut(); setSession(null); }, 'Sesión cerrada.')}>Salir</button></div></>}
                {!cloudConfigured && <code>VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY</code>}
              </section>

              {status && <div className="product-status">{status}</div>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
