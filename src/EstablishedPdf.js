// FINANCE / ESTABLISHED 02 — print edition.
// Rendering only: receives snapshots of existing ledger data and does not mutate storage.
// jsPDF's built-in fonts cannot render Japanese characters reliably; the editorial
// identity is conveyed by Roman type, geometry and the YORU dark-paper palette.
export function renderEstablishedReport({
  jsPDF, month, monthLabel, currency, percent,
  totalIncomes, totalExpenses, balance, expenseRatio, savingsRate,
  normalizedIncomes, normalizedExpenses, topCategories, weeklySummary,
  insights, movements, averageExpenseTicket, averageDailyExpense,
  uniqueExpenseDays, availableMargin
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = W - M * 2;
  const C = {
    night: [12, 17, 24],
    deep: [21, 31, 38],
    paper: [247, 246, 241],
    white: [255, 254, 250],
    sand: [224, 192, 150],
    jade: [126, 180, 151],
    coral: [209, 134, 126],
    ink: [35, 46, 53],
    muted: [105, 119, 121],
    rule: [222, 223, 217],
    cream: [239, 235, 225]
  };
  const rgb = (name) => C[name];
  const fill = (name) => doc.setFillColor(...rgb(name));
  const stroke = (name) => doc.setDrawColor(...rgb(name));
  const ink = (name) => doc.setTextColor(...rgb(name));
  const font = (size, weight = 'normal', family = 'helvetica') => {
    doc.setFont(family, weight); doc.setFontSize(size);
  };
  function tracked(str, x, y, color = 'muted', size = 8) {
    font(size, 'bold', 'courier'); ink(color); doc.text(String(str).toUpperCase(), x, y);
  }
  function fit(value, maxWidth, desired = 13, min = 8, family = 'helvetica', weight = 'bold') {
    const text = String(value);
    let size = desired;
    while (size > min) {
      font(size, weight, family);
      if (doc.getTextWidth(text) <= maxWidth) break;
      size -= .5;
    }
    return size;
  }
  function short(value, maxWidth, size = 8) {
    const str = String(value ?? '');
    font(size);
    if (doc.getTextWidth(str) <= maxWidth) return str;
    let result = str;
    while (result.length > 1 && doc.getTextWidth(result + '...') > maxWidth) {
      result = result.slice(0, -1);
    }
    return result + '...';
  }
  function line(y, x1 = M, x2 = W - M, color = 'rule') {
    stroke(color); doc.setLineWidth(.25); doc.line(x1, y, x2, y);
  }
  function paper() {
    fill('paper'); doc.rect(0, 0, W, H, 'F');
    fill('sand'); doc.rect(M, H - 11, 13, .7, 'F');
  }
  function footer(page, total) {
    doc.setPage(page);
    line(H - 17);
    tracked('YORU / FINANCE   -   ARCHIVO FINANCIERO PRIVADO', M, H - 11.5, 'muted', 6.7);
    font(8, 'bold', 'courier'); ink('ink');
    doc.text(`${String(page).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, W - M, H - 11.5, { align: 'right' });
  }
  function chapterHeader(number, name, detail) {
    paper();
    fill('night'); doc.rect(0, 0, W, 37, 'F');
    fill('sand'); doc.rect(M, 11, 1.1, 12, 'F');
    tracked('FINANCE / ESTABLISHED', M + 5, 14, 'sand', 9);
    font(14, 'bold'); ink('cream'); doc.text(name, M + 5, 25);
    tracked(`${number} / MONTHLY FINANCIAL RECORD`, W - M, 14, 'sand', 7);
    font(9, 'normal'); ink('cream'); doc.text(detail, W - M, 25, { align: 'right' });
  }
  function sectionTitle(num, title, y) {
    tracked(num, M, y, 'muted', 7);
    font(13.5, 'bold'); ink('ink'); doc.text(title, M + 11, y + .5);
    line(y + 3.2);
  }
  function metric(x, y, width, title, value, color = 'ink', helper = '') {
    fill('white'); stroke('rule'); doc.setLineWidth(.28);
    doc.roundedRect(x, y, width, 29, 2, 2, 'FD');
    fill(color); doc.rect(x, y, width, 1.5, 'F');
    tracked(title, x + 5, y + 8, 'muted', 7.2);
    const size = fit(value, width - 10, 14, 8.5);
    font(size, 'bold'); ink(color); doc.text(String(value), x + 5, y + 18);
    if (helper) {
      font(7.1); ink('muted');
      doc.text(short(helper, width - 10, 7.1), x + 5, y + 25);
    }
  }

  // PAGE 01: Executive journal / designed as print, not a screenshot.
  paper();
  fill('night'); doc.rect(0, 0, W, 71, 'F');
  fill('sand'); doc.rect(0, 69, W, 1.6, 'F');
  fill('deep'); doc.circle(W - 18, 5, 35, 'F');
  stroke('sand'); doc.setLineWidth(.5); doc.line(M, 10, M, 55);
  tracked('YORU    /    FINANCE', M + 7, 15, 'sand', 9.5);
  tracked('ESTABLISHED      VOL. 02', W - M, 15, 'sand', 7.5);
  font(29, 'bold'); ink('cream');
  doc.text('FINANCIAL', M + 7, 35);
  doc.text('FIELD NOTES', M + 7, 47);
  font(10); ink('sand');
  doc.text(`EDICION MENSUAL  /  ${monthLabel(month).toUpperCase()}`, M + 7, 58);
  tracked(`${month.replace('-', ' / ')}    GUATEMALA`, W - M, 60, 'sand', 8.5);

  sectionTitle('01', 'Balance de la edicion', 82);
  const gap = 4, width = (CW - gap * 2) / 3;
  metric(M, 91, width, 'INGRESOS', currency(totalIncomes), 'jade', `${normalizedIncomes.length} registros`);
  metric(M + width + gap, 91, width, 'GASTOS', currency(totalExpenses), 'coral', `${normalizedExpenses.length} movimientos`);
  metric(M + 2 * (width + gap), 91, width, 'BALANCE NETO', currency(balance),
    balance >= 0 ? 'jade' : 'coral', balance >= 0 ? 'Saldo positivo' : 'Por revisar');

  fill('deep'); doc.roundedRect(M, 126, CW, 22, 2, 2, 'F');
  tracked('INDICE DE UTILIZACION DE INGRESOS', M + 6, 133.5, 'cream', 7.5);
  font(10, 'bold', 'courier'); ink('sand'); doc.text(totalIncomes > 0 ? percent(expenseRatio) : 'SIN BASE', W - M - 6, 133.5, { align: 'right' });
  fill('night'); doc.rect(M + 6, 138, CW - 12, 2.6, 'F');
  fill('sand'); doc.rect(M + 6, 138, (CW - 12) * Math.max(0, Math.min(100, expenseRatio)) / 100, 2.6, 'F');
  font(7.2); ink('cream');
  doc.text(`TASA DE AHORRO  ${percent(savingsRate)}     /     PROMEDIO POR GASTO  ${currency(averageExpenseTicket)}`, M + 6, 144.6);

  sectionTitle('02', 'Geografia del gasto', 158);
  fill('white'); stroke('rule'); doc.roundedRect(M, 167, CW, 64, 2, 2, 'FD');
  if (!topCategories.length) {
    font(10); ink('muted'); doc.text('Sin gastos registrados en el periodo seleccionado.', M + 7, 190);
  } else {
    const categories = topCategories.slice(0, 5);
    const biggest = Math.max(1, ...categories.map((item) => item.total));
    categories.forEach((item, index) => {
      const yy = 176 + index * 10.6;
      const label = short(item.label, 46, 8.8);
      font(8.8, 'bold'); ink('ink'); doc.text(label, M + 5, yy);
      fill('paper'); doc.rect(M + 57, yy - 3, 57, 3.2, 'F');
      fill(index === 0 ? 'sand' : 'jade'); doc.rect(M + 57, yy - 3, Math.max(.5, item.total / biggest * 57), 3.2, 'F');
      font(8.5, 'bold', 'courier'); ink('ink');
      doc.text(short(currency(item.total), 45, 8.5), W - M - 5, yy, { align: 'right' });
    });
  }

  sectionTitle('03', 'Cadencia semanal', 242);
  fill('white'); stroke('rule'); doc.roundedRect(M, 251, CW, 25, 2, 2, 'FD');
  const maxWeek = Math.max(1, ...weeklySummary.map((item) => item.total));
  weeklySummary.forEach((week, i) => {
    const cell = CW / 5;
    const xx = M + cell * i + 6;
    const bh = Math.max(.45, week.total / maxWeek * 11);
    fill('paper'); doc.rect(xx, 255, cell - 12, 11, 'F');
    fill(i % 2 === 0 ? 'coral' : 'sand'); doc.rect(xx, 266 - bh, cell - 12, bh, 'F');
    font(7.1, 'bold', 'courier'); ink('muted'); doc.text(`S${i + 1}`, xx, 273.5);
    font(7.1, 'bold'); ink('ink'); doc.text(short(currency(week.total), cell - 12, 7.1), xx + cell - 12, 273.5, { align: 'right' });
  });

  // PAGE 02: Commentary + continuous ledger. Every new page gets clean columns.
  doc.addPage();
  chapterHeader('02', 'Lectura del mes', monthLabel(month));
  let y = 48;
  sectionTitle('04', 'Observaciones', y);
  y += 9;
  const insightText = [
    ...insights,
    `Actividad en ${uniqueExpenseDays} dias de gasto. Promedio por dia activo: ${currency(averageDailyExpense)}.`,
    `Margen positivo estimado: ${currency(availableMargin)}. Los indicadores son descriptivos, no proyecciones.`
  ];
  insightText.forEach((item, i) => {
    const paragraphs = doc.splitTextToSize(String(item), CW - 23);
    const h = Math.max(13, 6 + paragraphs.length * 4.2);
    if (y + h > H - 34) {
      doc.addPage();
      chapterHeader('02', 'Lectura del mes', monthLabel(month));
      y = 48;
    }
    fill('white'); doc.rect(M, y, CW, h, 'F');
    fill(i % 2 === 0 ? 'sand' : 'jade'); doc.rect(M, y, 1, h, 'F');
    font(7.5, 'bold', 'courier'); ink('muted');
    doc.text(String(i + 1).padStart(2, '0'), M + 4, y + 6.2);
    font(8.7); ink('ink');
    doc.text(paragraphs, M + 13, y + 6.2);
    y += h + 2;
  });

  y += 9;
  if (y > 180) {
    doc.addPage(); chapterHeader('03', 'Libro mayor', monthLabel(month)); y = 48;
  }
  sectionTitle('05', 'Registro de movimientos', y);
  y += 10;

  const dateX = M + 4, typeX = M + 27, categoryX = M + 50, detailX = M + 92, amountX = W - M - 4;
  function tableHeader() {
    fill('night'); doc.rect(M, y, CW, 10, 'F');
    tracked('FECHA', dateX, y + 6.5, 'cream', 7.2);
    tracked('TIPO', typeX, y + 6.5, 'cream', 7.2);
    tracked('CATEGORIA', categoryX, y + 6.5, 'cream', 7.2);
    tracked('DETALLE', detailX, y + 6.5, 'cream', 7.2);
    font(7.2, 'bold', 'courier'); ink('cream'); doc.text('IMPORTE', amountX, y + 6.5, { align: 'right' });
    y += 10;
  }
  tableHeader();
  if (!movements.length) {
    font(9); ink('muted'); doc.text('Sin movimientos registrados para el mes seleccionado.', M + 4, y + 10);
  }
  // No truncation at 600 entries: every recorded movement is represented.
  movements.forEach((movement, i) => {
    if (y + 10 > H - 25) {
      doc.addPage(); chapterHeader('03', 'Libro mayor', monthLabel(month));
      y = 45;
      tableHeader();
    }
    const h = 10.2;
    if (i % 2 === 0) { fill('white'); doc.rect(M, y, CW, h, 'F'); }
    line(y + h, M, W - M);
    font(7.9, 'normal'); ink('muted'); doc.text(String(movement.date || '').slice(2), dateX, y + 6.2);
    font(8.2, 'bold'); ink('ink'); doc.text(movement.type, typeX, y + 6.2);
    font(8.2); doc.text(short(movement.category, 39, 8.2), categoryX, y + 6.2);
    ink('muted'); doc.text(short(movement.detail, 42, 8.2), detailX, y + 6.2);
    font(8.5, 'bold', 'courier'); ink(movement.amount < 0 ? 'coral' : 'jade');
    doc.text(short(`${movement.amount < 0 ? '-' : '+'}${currency(Math.abs(movement.amount))}`, 37, 8.5), amountX, y + 6.2, { align: 'right' });
    y += h;
  });

  const count = doc.getNumberOfPages();
  for (let i = 1; i <= count; i++) footer(i, count);
  doc.setProperties({
    title: `Finance | Informe Established ${month}`,
    subject: 'Informe mensual de ingresos, gastos y libro mayor',
    author: 'Finance by YORU',
    creator: 'Finance Established'
  });
  doc.save(`finance-established-${month}.pdf`);
}
