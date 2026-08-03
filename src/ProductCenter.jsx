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

function percent(value) {
  return `${Number(value || 0).toLocaleString('es-GT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function cleanLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCase(value) {
  const text = cleanLabel(value);
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isGenericExpenseLabel(value) {
  return ['otros', 'otro', 'misceláneos', 'miscelaneos', 'gastos', 'gasto', 'sin categoría', 'sin categoria'].includes(
    cleanLabel(value).toLowerCase()
  );
}

function resolveExpenseCategory(item) {
  const category = titleCase(item.category);
  const note = titleCase(item.note || item.description);
  if (isGenericExpenseLabel(category) && note) return note;
  return category || note || 'Sin categoría';
}

function resolveExpenseDetail(item) {
  const category = titleCase(item.category);
  const note = titleCase(item.note || item.description);
  if (note && category && note.toLowerCase() !== category.toLowerCase()) return `${category} • ${note}`;
  return note || category || 'Sin detalle';
}

function resolveIncomeCategory(item) {
  return titleCase(item.source || item.type || 'Ingreso') || 'Ingreso';
}

function resolveIncomeDetail(item) {
  const base = resolveIncomeCategory(item);
  const note = titleCase(item.note || item.description);
  if (note && note.toLowerCase() !== base.toLowerCase()) return `${base} • ${note}`;
  return note || base;
}

function groupExpensesByCategory(expenses) {
  const map = new Map();
  expenses.forEach((item) => {
    const label = item.categoryLabel || resolveExpenseCategory(item);
    const current = map.get(label) || { label, total: 0, count: 0 };
    current.total += Number(item.amountNumber ?? item.amount ?? 0);
    current.count += 1;
    map.set(label, current);
  });
  return [...map.values()].sort((a, b) => b.total - a.total);
}

function groupExpensesByWeek(expenses) {
  const map = new Map();
  expenses.forEach((item) => {
    const day = Number(String(item.date || '').slice(8, 10)) || 1;
    const week = Math.min(5, Math.max(1, Math.ceil(day / 7)));
    const label = `Semana ${week}`;
    map.set(label, (map.get(label) || 0) + Number(item.amountNumber ?? item.amount ?? 0));
  });
  return Array.from({ length: 5 }, (_, index) => {
    const label = `Semana ${index + 1}`;
    return { label, total: map.get(label) || 0 };
  });
}

function exportCsv() {
  const expenses = safeParse('expenses').map((item) => ({
    tipo: 'Gasto', fecha: item.date, categoria: resolveExpenseCategory(item), descripcion: resolveExpenseDetail(item), monto: item.amount
  }));
  const incomes = getIncomes().map((item) => ({
    tipo: 'Ingreso', fecha: item.date, categoria: resolveIncomeCategory(item), descripcion: resolveIncomeDetail(item), monto: item.amount
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

  const normalizedExpenses = expenses.map((item) => ({
    ...item,
    categoryLabel: resolveExpenseCategory(item),
    detailLabel: resolveExpenseDetail(item),
    amountNumber: Number(item.amount || 0)
  }));

  const normalizedIncomes = incomes.map((item) => ({
    ...item,
    categoryLabel: resolveIncomeCategory(item),
    detailLabel: resolveIncomeDetail(item),
    amountNumber: Number(item.amount || 0)
  }));

  const totalExpenses = normalizedExpenses.reduce((sum, item) => sum + item.amountNumber, 0);
  const totalIncomes = normalizedIncomes.reduce((sum, item) => sum + item.amountNumber, 0);
  const balance = totalIncomes - totalExpenses;
  const expenseRatio = totalIncomes > 0 ? (totalExpenses / totalIncomes) * 100 : 0;
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0;
  const uniqueExpenseDays = new Set(normalizedExpenses.map((item) => item.date)).size;
  const averageExpenseTicket = normalizedExpenses.length ? totalExpenses / normalizedExpenses.length : 0;
  const averageDailyExpense = uniqueExpenseDays ? totalExpenses / uniqueExpenseDays : 0;
  const categorySummary = groupExpensesByCategory(normalizedExpenses);
  const topCategories = categorySummary.slice(0, 6);
  const weeklySummary = groupExpensesByWeek(normalizedExpenses);
  const highestExpense = [...normalizedExpenses].sort((a, b) => b.amountNumber - a.amountNumber)[0] || null;
  const mainCategory = topCategories[0] || null;
  const availableMargin = balance > 0 ? balance : 0;

  const movements = [
    ...normalizedIncomes.map((item) => ({
      date: item.date || '',
      type: 'Ingreso',
      category: item.categoryLabel,
      detail: item.detailLabel,
      amount: item.amountNumber
    })),
    ...normalizedExpenses.map((item) => ({
      date: item.date || '',
      type: 'Gasto',
      category: item.categoryLabel,
      detail: item.detailLabel,
      amount: -item.amountNumber
    }))
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  const insights = [];
  if (mainCategory) {
    insights.push(`La categoría con mayor peso fue ${mainCategory.label} con ${currency(mainCategory.total)}, equivalente a ${percent((mainCategory.total / Math.max(totalExpenses, 1)) * 100)} del gasto del mes.`);
  }
  if (highestExpense) {
    insights.push(`El movimiento individual más alto fue ${highestExpense.categoryLabel} por ${currency(highestExpense.amountNumber)} el ${highestExpense.date}.`);
  }
  if (totalIncomes > 0) {
    insights.push(balance >= 0
      ? `Después de cubrir los gastos del mes, el balance neto fue positivo en ${currency(balance)}. Esto deja un margen potencial para ahorro o abonos extra al préstamo.`
      : `Los gastos superaron los ingresos en ${currency(Math.abs(balance))}. Conviene revisar categorías presionadas y pagos que puedan reprogramarse.`);
  } else {
    insights.push('No se registraron ingresos en el mes seleccionado, por lo que el balance y las tasas deben interpretarse con cautela.');
  }

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const colors = {
    navy: [53, 92, 125],
    plum: [108, 91, 123],
    rose: [192, 108, 132],
    coral: [246, 114, 128],
    peach: [248, 177, 149],
    bg: [252, 247, 246],
    bgSoft: [248, 242, 239],
    border: [226, 216, 220],
    text: [35, 54, 74],
    muted: [90, 100, 114],
    white: [255, 255, 255],
    success: [53, 92, 125]
  };

  function drawHeader(title, subtitle) {
    doc.setFillColor(...colors.navy);
    doc.rect(0, 0, pageWidth, 32, 'F');
    doc.setFillColor(...colors.rose);
    doc.rect(0, 32, pageWidth, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...colors.white);
    doc.text(title, margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(subtitle, margin, 22);
    doc.text(`Generado: ${new Date().toLocaleDateString('es-GT')}`, pageWidth - margin, 22, { align: 'right' });
  }

  function drawSectionTitle(text, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...colors.navy);
    doc.text(text, margin, y);
    doc.setDrawColor(...colors.border);
    doc.line(margin, y + 2, pageWidth - margin, y + 2);
  }

  function drawSummaryCard(x, y, width, height, label, value, accent, helper = '') {
    doc.setFillColor(...colors.bg);
    doc.setDrawColor(...colors.border);
    doc.roundedRect(x, y, width, height, 3, 3, 'FD');
    doc.setFillColor(...accent);
    doc.roundedRect(x, y, 3.5, height, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.plum);
    doc.text(label.toUpperCase(), x + 7, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(...accent);
    doc.text(doc.splitTextToSize(value, width - 10), x + 7, y + 16);
    if (helper) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...colors.muted);
      doc.text(doc.splitTextToSize(helper, width - 10), x + 7, y + height - 5);
    }
  }

  function drawMetricLine(label, value, y, accent = colors.text) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.muted);
    doc.text(label, margin + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...accent);
    doc.text(value, pageWidth - margin - 4, y, { align: 'right' });
  }

  function addPage(title = 'Mi Presupuesto', subtitle = `Reporte financiero de ${monthLabel(month)}`) {
    doc.addPage();
    drawHeader(title, subtitle);
    return 44;
  }

  drawHeader('Mi Presupuesto', `Reporte financiero de ${monthLabel(month)}`);
  doc.setProperties({
    title: `Reporte financiero ${month}`,
    subject: 'Reporte financiero mensual',
    author: 'Mi Presupuesto',
    creator: 'Mi Presupuesto'
  });

  let y = 42;
  const gap = 4;
  const cardWidth = (contentWidth - gap * 3) / 4;
  drawSummaryCard(margin, y, cardWidth, 26, 'Ingresos', currency(totalIncomes), colors.success, `${normalizedIncomes.length} registro${normalizedIncomes.length === 1 ? '' : 's'}`);
  drawSummaryCard(margin + (cardWidth + gap), y, cardWidth, 26, 'Gastos', currency(totalExpenses), colors.coral, `${normalizedExpenses.length} movimiento${normalizedExpenses.length === 1 ? '' : 's'}`);
  drawSummaryCard(margin + (cardWidth + gap) * 2, y, cardWidth, 26, 'Balance', currency(balance), balance >= 0 ? colors.plum : colors.coral, balance >= 0 ? 'Resultado neto del mes' : 'Requiere ajuste de gasto');
  drawSummaryCard(margin + (cardWidth + gap) * 3, y, cardWidth, 26, 'Tasa de ahorro', percent(savingsRate), savingsRate >= 0 ? colors.success : colors.coral, `${percent(expenseRatio)} del ingreso fue utilizado`);

  y += 34;
  drawSectionTitle('Resumen ejecutivo', y);
  y += 8;
  doc.setFillColor(...colors.bgSoft);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, y, contentWidth, 34, 3, 3, 'FD');
  drawMetricLine('Promedio por gasto', currency(averageExpenseTicket), y + 7);
  drawMetricLine('Promedio diario de gasto', currency(averageDailyExpense), y + 14);
  drawMetricLine('Días con movimientos de gasto', `${uniqueExpenseDays}`, y + 21);
  drawMetricLine('Potencial disponible para ahorro / abono', currency(availableMargin), y + 28, availableMargin > 0 ? colors.success : colors.muted);

  y += 42;
  drawSectionTitle('Hallazgos del mes', y);
  y += 8;
  const insightHeight = 9 + insights.reduce((total, text) => total + Math.max(5, doc.splitTextToSize(`• ${text}`, contentWidth - 14).length * 4.5), 0);
  doc.setFillColor(...colors.bg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, y, contentWidth, insightHeight, 3, 3, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...colors.text);
  let insightY = y + 7;
  insights.forEach((text) => {
    const lines = doc.splitTextToSize(`• ${text}`, contentWidth - 14);
    doc.text(lines, margin + 5, insightY);
    insightY += Math.max(5, lines.length * 4.5);
  });

  y += insightHeight + 8;
  if (y > 176) y = addPage('Mi Presupuesto', `Análisis de gasto de ${monthLabel(month)}`);
  drawSectionTitle('Distribución de gasto por categoría', y);
  y += 8;
  const chartHeight = Math.max(36, topCategories.length * 9 + 6);
  doc.setFillColor(...colors.bg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, y, contentWidth, chartHeight, 3, 3, 'FD');
  const chartTop = y + 6;
  const barStartX = margin + 56;
  const barMaxWidth = 74;
  const maxCategoryValue = Math.max(...topCategories.map((item) => item.total), 1);
  topCategories.forEach((item, index) => {
    const rowY = chartTop + index * 8;
    const label = doc.splitTextToSize(item.label, 38)[0] || item.label;
    const ratio = item.total / maxCategoryValue;
    const barWidth = Math.max(3, barMaxWidth * ratio);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...colors.text);
    doc.text(label, margin + 4, rowY + 3.8);
    doc.setFillColor(...colors.bgSoft);
    doc.roundedRect(barStartX, rowY, barMaxWidth, 4.5, 1.5, 1.5, 'F');
    doc.setFillColor(...(index % 2 === 0 ? colors.rose : colors.peach));
    doc.roundedRect(barStartX, rowY, barWidth, 4.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.muted);
    doc.text(percent((item.total / Math.max(totalExpenses, 1)) * 100), barStartX + barMaxWidth + 6, rowY + 3.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.navy);
    doc.text(currency(item.total), pageWidth - margin - 4, rowY + 3.8, { align: 'right' });
  });

  y += chartHeight + 6;
  drawSectionTitle('Ritmo semanal del gasto', y);
  y += 8;
  doc.setFillColor(...colors.bg);
  doc.setDrawColor(...colors.border);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, 'FD');
  const weeklyMax = Math.max(...weeklySummary.map((item) => item.total), 1);
  const baseY = y + 31;
  const weeklyBarWidth = 18;
  const space = 16;
  weeklySummary.forEach((item, index) => {
    const barHeight = weeklyMax ? (item.total / weeklyMax) * 20 : 0;
    const x = margin + 10 + index * (weeklyBarWidth + space);
    doc.setFillColor(...colors.bgSoft);
    doc.roundedRect(x, baseY - 20, weeklyBarWidth, 20, 2, 2, 'F');
    doc.setFillColor(...(index % 2 === 0 ? colors.navy : colors.rose));
    if (barHeight > 0) doc.roundedRect(x, baseY - barHeight, weeklyBarWidth, barHeight, 2, 2, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...colors.muted);
    doc.text(item.label, x + weeklyBarWidth / 2, baseY + 5, { align: 'center' });
    doc.setFontSize(7);
    doc.text(currency(item.total), x + weeklyBarWidth / 2, baseY - 23, { align: 'center' });
  });

  y = addPage('Mi Presupuesto', `Detalle transaccional de ${monthLabel(month)}`);
  drawSectionTitle('Detalle de movimientos', y);
  y += 8;
  const columns = [
    { title: 'Fecha', x: margin, width: 22 },
    { title: 'Tipo', x: margin + 24, width: 18 },
    { title: 'Categoría', x: margin + 44, width: 42 },
    { title: 'Detalle', x: margin + 88, width: 62 },
    { title: 'Monto', x: pageWidth - margin - 28, width: 28 }
  ];

  function drawTableHeader() {
    doc.setFillColor(...colors.plum);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(...colors.white);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    columns.forEach((column) => doc.text(column.title, column.x + 2, y + 5.3));
    y += 8;
  }

  drawTableHeader();
  if (!movements.length) {
    doc.setTextColor(...colors.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No hay movimientos registrados para este mes.', margin + 2, y + 8);
  } else {
    movements.slice(0, 600).forEach((movement, index) => {
      const categoryLines = doc.splitTextToSize(String(movement.category), columns[2].width - 4);
      const detailLines = doc.splitTextToSize(String(movement.detail), columns[3].width - 4);
      const rowHeight = Math.max(9, Math.max(categoryLines.length, detailLines.length, 1) * 4.2 + 3);
      if (y + rowHeight > pageHeight - 14) {
        y = addPage('Mi Presupuesto', `Detalle transaccional de ${monthLabel(month)}`);
        drawSectionTitle('Detalle de movimientos', y);
        y += 8;
        drawTableHeader();
      }
      if (index % 2 === 0) {
        doc.setFillColor(...colors.bg);
        doc.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      doc.setDrawColor(...colors.border);
      doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.3);
      doc.setTextColor(...colors.text);
      doc.text(String(movement.date), columns[0].x + 2, y + 5.5);
      doc.text(movement.type, columns[1].x + 2, y + 5.5);
      doc.text(categoryLines, columns[2].x + 2, y + 5.5);
      doc.text(detailLines, columns[3].x + 2, y + 5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(movement.amount < 0 ? colors.coral : colors.success));
      doc.text(`${movement.amount < 0 ? '-' : '+'}${currency(Math.abs(movement.amount))}`, pageWidth - margin - 2, y + 5.5, { align: 'right' });
      y += rowHeight;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(`mi-presupuesto-${month}.pdf`);
}

function notifyDuePayments() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const recurring = safeParse('premium-recurring-expenses');
  const today = new Date().getDate();
  const due = recurring.filter((item) => item.active && Number(item.day) <= today);
  if (!due.length || window.Notification.permission !== 'granted') return;
  new window.Notification('Mi Presupuesto', {
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
    try { notifyDuePayments(); } catch (error) { console.warn('No se pudieron revisar los recordatorios:', error); }
  }, []);

  const email = useMemo(() => session?.user?.email || '', [session]);

  async function run(action, success) {
    setBusy(true);
    setStatus('');
    try { await action(); setStatus(success); }
    catch (error) { setStatus(error.message || 'Ocurrió un error.'); }
    finally { setBusy(false); }
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
    const permission = await window.Notification.requestPermission();
    setStatus(permission === 'granted' ? 'Notificaciones activadas.' : 'No se concedió permiso para notificaciones.');
    if (permission === 'granted') notifyDuePayments();
  }

  async function handleSignIn(mode) {
    await run(async () => {
      const result = mode === 'signup' ? await signUp(auth.email, auth.password) : await signIn(auth.email, auth.password);
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
                <div><h3>Exportar y reportar</h3><p>Descarga tus movimientos en CSV o genera un reporte financiero mensual con resumen ejecutivo, categorías, estadísticas, gráficas y detalle transaccional.</p></div>
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
