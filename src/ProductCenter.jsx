import React, { useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { cloudConfigured, getSession, pullBackup, pushBackup, signIn, signOut, signUp } from './cloudSync';
import { hasPin, removePin, savePin } from './SecurityGate';

const SETTINGS_KEY = 'app-settings';
const SELECTED_MONTH_KEY = 'ux-selected-month';

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
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeParse(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function getIncomes() {
  const primary = safeParse('monthly-incomes');
  return primary.length ? primary : safeParse('incomes');
}

function selectedMonth() {
  return localStorage.getItem(SELECTED_MONTH_KEY) || new Date().toISOString().slice(0, 7);
}

function monthLabel(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' })
    .format(new Date(year, monthNumber - 1, 1));
}

function currency(value) {
  return `Q ${Number(value || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportCsv() {
  const expenses = safeParse('expenses').map((item) => ({
    tipo: 'Gasto', fecha: item.date, categoria: item.category, descripcion: item.note, monto: item.amount
  }));
  const incomes = getIncomes().map((item) => ({
    tipo: 'Ingreso', fecha: item.date, categoria: item.source || item.type || 'Ingreso', descripcion: item.note, monto: item.amount
  }));
  const rows = [...expenses, ...incomes].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const header = ['Tipo', 'Fecha', 'Categoría', 'Descripción', 'Monto'];
  const csv = [header, ...rows.map((row) => Object.values(row))]
    .map((row) => row.map(csvEscape).join(','))
    .join('\n');
  downloadFile(`mi-presupuesto-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
}

function generatePdfReport() {
  const month = selectedMonth();
  const expenses = safeParse('expenses').filter((item) => String(item.date || '').startsWith(month));
  const incomes = getIncomes().filter((item) => String(item.date || '').startsWith(month));
  const totalExpenses = expenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalIncomes = incomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const balance = totalIncomes - totalExpenses;

  const movements = [
    ...incomes.map((item) => ({
      date: item.date || '',
      type: 'Ingreso',
      detail: item.source || item.type || item.description || item.note || 'Ingreso',
      amount: Number(item.amount || 0)
    })),
    ...expenses.map((item) => ({
      date: item.date || '',
      type: 'Gasto',
      detail: item.category || item.note || 'Gasto',
      amount: -Number(item.amount || 0)
    }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  function addHeader() {
    doc.setFillColor(53, 92, 125);
    doc.rect(0, 0, pageWidth, 34, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Mi Presupuesto', margin, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Reporte de ${monthLabel(month)}`, margin, 23);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-GT')}`, pageWidth - margin, 23, { align: 'right' });
    doc.setTextColor(35, 54, 74);
  }

  function addPage() {
    doc.addPage();
    addHeader();
    return 44;
  }

  addHeader();
  let y = 44;
  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cards = [
    { label: 'Ingresos', value: currency(totalIncomes), color: [53, 92, 125] },
    { label: 'Gastos', value: currency(totalExpenses), color: [246, 114, 128] },
    { label: 'Balance', value: currency(balance), color: balance < 0 ? [246, 114, 128] : [108, 91, 123] }
  ];

  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setFillColor(248, 242, 239);
    doc.setDrawColor(220, 207, 210);
    doc.roundedRect(x, y, cardWidth, 25, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(108, 91, 123);
    doc.text(card.label.toUpperCase(), x + 4, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(...card.color);
    const valueLines = doc.splitTextToSize(card.value, cardWidth - 8);
    doc.text(valueLines, x + 4, y + 16);
  });

  y += 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(53, 92, 125);
  doc.text('Movimientos del mes', margin, y);
  y += 7;

  const columns = [
    { title: 'Fecha', x: margin, width: 26 },
    { title: 'Tipo', x: margin + 28, width: 24 },
    { title: 'Detalle', x: margin + 54, width: 88 },
    { title: 'Monto', x: pageWidth - margin - 35, width: 35 }
  ];

  function drawTableHeader() {
    doc.setFillColor(108, 91, 123);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    columns.forEach((column) => doc.text(column.title, column.x + 2, y + 5.3));
    y += 8;
  }

  drawTableHeader();

  if (!movements.length) {
    doc.setTextColor(90, 100, 114);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No hay movimientos registrados para este mes.', margin + 2, y + 10);
  } else {
    movements.slice(0, 500).forEach((movement, index) => {
      const detailLines = doc.splitTextToSize(String(movement.detail), columns[2].width - 4);
      const rowHeight = Math.max(9, detailLines.length * 4.2 + 3);

      if (y + rowHeight > pageHeight - 14) {
        y = addPage();
        drawTableHeader();
      }

      if (index % 2 === 0) {
        doc.setFillColor(252, 247, 246);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }

      doc.setDrawColor(232, 224, 225);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(35, 54, 74);
      doc.text(String(movement.date), columns[0].x + 2, y + 5.5);
      doc.text(movement.type, columns[1].x + 2, y + 5.5);
      doc.text(detailLines, columns[2].x + 2, y + 5.5);
      doc.setTextColor(movement.amount < 0 ? 246 : 53, movement.amount < 0 ? 114 : 92, movement.amount < 0 ? 128 : 125);
      doc.text(currency(Math.abs(movement.amount)), pageWidth - margin - 2, y + 5.5, { align: 'right' });
      y += rowHeight;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(108, 91, 123);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(`mi-presupuesto-${month}.pdf`);
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
                <div><h3>Exportar y reportar</h3><p>Descarga tus movimientos en CSV o como un PDF real del mes seleccionado.</p></div>
                <div className="product-action-row"><button disabled={busy} onClick={exportCsv}>Exportar CSV</button><button disabled={busy} onClick={() => run(generatePdfReport, 'Reporte PDF descargado.')}>{busy ? 'Generando…' : 'Descargar PDF'}</button><button disabled={busy} onClick={requestNotifications}>Recordatorios</button></div>
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
