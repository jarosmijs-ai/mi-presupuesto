import React, { useMemo, useState } from 'react';

const MONEY = new Intl.NumberFormat('es-GT', {
  style: 'currency', currency: 'GTQ', maximumFractionDigits: 2
});
const WEEK = ['01–07', '08–14', '15–21', '22–28', '29–31'];

export function expenseWeeks(expenses = [], month = '') {
  const validMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;
  const lastDay = validMonth
    ? new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
    : 0;
  const totals = [0, 0, 0, 0, 0];
  if (!validMonth) return WEEK.map((range, i) => ({ index: i, label: range, total: 0 }));
  for (const item of Array.isArray(expenses) ? expenses : []) {
    const date = String(item?.date || '');
    const day = Number(date.slice(8, 10));
    const amount = Number(item?.amount);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(month + '-') ||
        !Number.isInteger(day) || day < 1 || day > lastDay ||
        !Number.isFinite(amount) || amount <= 0) continue;
    totals[Math.min(4, Math.floor((day - 1) / 7))] += amount;
  }
  return totals.map((total, index) => ({ index, label: WEEK[index], total }));
}

export default function ExpenseRhythm({ expenses, month, privateMode = false }) {
  const weeks = useMemo(() => expenseWeeks(expenses, month), [expenses, month]);
  const [selection, setSelection] = useState(2);
  const active = weeks[selection] || weeks[2];
  const total = weeks.reduce((sum, week) => sum + week.total, 0);
  const max = Math.max(1, ...weeks.map((week) => week.total));
  const peak = weeks.reduce((best, week) => week.total > best.total ? week : best, weeks[0]);
  const selectedShare = total > 0 ? Math.round((active.total / total) * 100) : 0;

  return (
    <section className="y-rhythm" aria-label="Comparación de gastos dentro del mes">
      <div className="y-rhythm-header">
        <div>
          <span className="y-rhythm-kicker">02 / CADENCIA DE GASTO <span aria-hidden="true">· 支出</span></span>
          <h2>El ritmo <em>del mes.</em></h2>
          <p>Cinco tramos de siete días. Compara cuándo se concentra tu gasto.</p>
        </div>
        <div className="y-rhythm-stamp" aria-hidden="true">MONTHLY<br/>FIELD NOTES<br/>— 05</div>
      </div>
      {privateMode ? (
        <div className="y-rhythm-empty" role="status">Comparativa oculta mientras la privacidad de montos esté activa.</div>
      ) : total <= 0 ? (
        <div className="y-rhythm-empty">No hay gastos registrados en este mes. La gráfica se mostrará con tus movimientos reales.</div>
      ) : (
        <>
          <div className="y-rhythm-summary" aria-live="polite">
            <div><span>TRAMO SELECCIONADO</span><strong>DÍAS {active.label}</strong></div>
            <div><span>GASTOS DEL TRAMO</span><strong>{MONEY.format(active.total)}</strong></div>
            <div><span>PESO EN EL MES</span><strong>{selectedShare}%</strong></div>
          </div>
          <div className="y-rhythm-chart">
            {weeks.map((week) => {
              const height = Math.max(2, (week.total / max) * 100);
              return (
                <button
                  className={week.index === selection ? 'is-selected' : ''}
                  key={week.index} type="button"
                  aria-pressed={week.index === selection}
                  aria-label={`Días ${week.label}, gastos ${MONEY.format(week.total)}`}
                  onClick={() => setSelection(week.index)}
                >
                  <span className="y-rhythm-rail">
                    <span className="y-rhythm-bar" style={{ height: `${height}%` }} />
                    <span className="y-rhythm-orbit" style={{ bottom: `${height}%` }} />
                  </span>
                  <span className="y-rhythm-week">W.0{week.index + 1}</span>
                  <span className="y-rhythm-dates">{week.label}</span>
                </button>
              );
            })}
          </div>
          <div className="y-rhythm-footer">
            <span><span className="y-rhythm-signal"/> MAYOR ACTIVIDAD · DÍAS {peak.label}</span>
            <span>ACUMULADO {MONEY.format(total)}</span>
          </div>
        </>
      )}
    </section>
  );
}
