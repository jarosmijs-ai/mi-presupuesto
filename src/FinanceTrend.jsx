import React, { useMemo, useState } from 'react';
import { changeMonth } from './monthUtils';

// Historical totals are derived from the *existing* local-first ledgers.
// Never cache, normalize, migrate or write financial information here.
const MONEY = new Intl.NumberFormat('es-GT', {
  style: 'currency', currency: 'GTQ', maximumFractionDigits: 2
});
const COMPACT = new Intl.NumberFormat('es-GT', {
  notation: 'compact', maximumFractionDigits: 1
});
const MONTH = new Intl.DateTimeFormat('es-GT', { month: 'short' });
const FULL_MONTH = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric' });

export function financialHistory(incomes = [], expenses = [], referenceMonth, count = 6) {
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(referenceMonth)
    ? referenceMonth
    : new Date().toISOString().slice(0, 7);

  const sumMonths = (items) => {
    const totals = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      const key = String(item?.date || '').slice(0, 7);
      const amount = Number(item?.amount);
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key) ||
          !Number.isFinite(amount) || amount <= 0) continue;
      totals.set(key, (totals.get(key) || 0) + amount);
    }
    return totals;
  };

  const earned = sumMonths(incomes);
  const spent = sumMonths(expenses);
  return Array.from({ length: count }, (_, index) => {
    const key = changeMonth(validMonth, index + 1 - count);
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return {
      key,
      short: MONTH.format(date).replace('.', ''),
      label: FULL_MONTH.format(date),
      income: earned.get(key) || 0,
      expense: spent.get(key) || 0
    };
  });
}

// Horizontal Bézier handles preserve a smooth, non-overshooting curve in Y.
// Values always stay inside the chart's numeric range, even with spikes.
function smoothPath(points) {
  if (!points.length) return '';
  return points.slice(1).reduce((path, point, index) => {
    const prev = points[index];
    const dx = (point.x - prev.x) * .44;
    return `${path} C${(prev.x + dx).toFixed(2)},${prev.y.toFixed(2)} ${(point.x - dx).toFixed(2)},${point.y.toFixed(2)} ${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  }, `M${points[0].x},${points[0].y}`);
}

export default function FinanceTrend({ incomes, expenses, month, privateMode = false }) {
  const history = useMemo(
    () => financialHistory(incomes, expenses, month),
    [incomes, expenses, month]
  );
  const [selectedKey, setSelectedKey] = useState(null);
  const selectedIndex = Math.max(0, history.findIndex((item) => item.key === selectedKey));
  const activeIndex = selectedKey && history.some((item) => item.key === selectedKey)
    ? selectedIndex : history.length - 1;
  const selected = history[activeIndex];
  const hasActivity = history.some(({ income, expense }) => income > 0 || expense > 0);

  const left = 18, right = 594, top = 20, bottom = 158;
  const highest = Math.max(1, ...history.flatMap(({ income, expense }) => [income, expense]));
  const coords = (field) => history.map((item, i) => ({
    x: left + (right - left) * i / Math.max(1, history.length - 1),
    y: bottom - (item[field] / highest) * (bottom - top)
  }));
  const incomePoints = coords('income');
  const expensePoints = coords('expense');
  const incomePath = smoothPath(incomePoints);
  const expensePath = smoothPath(expensePoints);
  const area = (path) => `${path} L${right},${bottom} L${left},${bottom} Z`;

  return (
    <section className="y-trend" aria-label="Tendencia histórica de ingresos y gastos">
      <div className="y-trend-heading">
        <div>
          <span className="y-trend-kicker">02 / PANORAMA HISTÓRICO <span aria-hidden="true">· 推移</span></span>
          <h2>El pulso <em>de tus finanzas.</em></h2>
          <p>Ingresos y gastos reales de los seis meses hasta el mes activo.</p>
        </div>
        <span className="y-trend-range">06 MESES / GTQ</span>
      </div>
      {privateMode ? (
        <div className="y-trend-empty" role="status">Histórico oculto. Desactiva la privacidad de montos para visualizar la tendencia.</div>
      ) : !hasActivity ? (
        <div className="y-trend-empty">Tu tendencia aparecerá cuando registres ingresos o gastos. No usamos datos de ejemplo.</div>
      ) : (
        <>
          <div className="y-trend-details" aria-live="polite">
            <div className="y-trend-selected"><span>MES SELECCIONADO</span><strong>{selected.label}</strong></div>
            <div className="y-trend-metric is-income"><span>INGRESOS</span><strong>{MONEY.format(selected.income)}</strong></div>
            <div className="y-trend-metric is-expense"><span>GASTOS</span><strong>{MONEY.format(selected.expense)}</strong></div>
          </div>
          <div className="y-trend-plot">
            <svg viewBox="0 0 612 183" role="img" aria-label="Curvas suaves que comparan ingresos y gastos durante los últimos seis meses; selecciona un mes abajo para conocer sus valores.">
              <defs>
                <linearGradient id="finance-income-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#93d1b3" stopOpacity=".22"/>
                  <stop offset="100%" stopColor="#93d1b3" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="finance-expense-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e9a096" stopOpacity=".12"/>
                  <stop offset="100%" stopColor="#e9a096" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {[top, (top + bottom) / 2, bottom].map((y) => (
                <line className="y-trend-grid" key={y} x1={left} x2={right} y1={y} y2={y}/>
              ))}
              <text className="y-trend-axis" x={right} y={top - 7} textAnchor="end">{'Q ' + COMPACT.format(highest)}</text>
              <path className="y-trend-area" fill="url(#finance-income-fill)" d={area(incomePath)}/>
              <path className="y-trend-area" fill="url(#finance-expense-fill)" d={area(expensePath)}/>
              <path className="y-trend-line is-income" d={incomePath} pathLength="100"/>
              <path className="y-trend-line is-expense" d={expensePath} pathLength="100"/>
              <line className="y-trend-crosshair" x1={incomePoints[activeIndex].x} x2={incomePoints[activeIndex].x} y1={top} y2={bottom}/>
              <circle className="y-trend-dot is-income" cx={incomePoints[activeIndex].x} cy={incomePoints[activeIndex].y} r="5"/>
              <circle className="y-trend-dot is-expense" cx={expensePoints[activeIndex].x} cy={expensePoints[activeIndex].y} r="5"/>
            </svg>
            <div className="y-trend-months" aria-label="Seleccionar mes de la gráfica">
              {history.map((item) => (
                <button key={item.key} type="button" aria-pressed={selected.key === item.key}
                  aria-label={`${item.label}: ingresos ${MONEY.format(item.income)}, gastos ${MONEY.format(item.expense)}`}
                  onClick={() => setSelectedKey(item.key)}>
                  {item.short}
                </button>
              ))}
            </div>
          </div>
          <div className="y-trend-footer">
            <span><i className="is-income" /> Ingresos</span>
            <span><i className="is-expense" /> Gastos</span>
            <small>Desliza tu atención, no tus datos · registro local</small>
          </div>
        </>
      )}
    </section>
  );
}
