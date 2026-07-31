import React, { useMemo, useState } from 'react';

import {
  calculateExtraPaymentCapacity,
  evaluateSuggestedExtraPayment
} from './budgetAdvisor';

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ'
});

export default function BudgetCapacityBox({
  monthlyIncome,
  budgets,
  loanMonthlyTotal,
  suggestedExtraPayment
}) {
  const [minimumReserve, setMinimumReserve] =
    useState(() => {
      try {
        const saved = localStorage.getItem(
          'minimum-reserve'
        );

        return saved ? Number(saved) : 1000;
      } catch {
        return 1000;
      }
    });

  const capacity = useMemo(
    () =>
      calculateExtraPaymentCapacity({
        monthlyIncome,
        budgets,
        loanMonthlyTotal,
        minimumReserve
      }),
    [
      monthlyIncome,
      budgets,
      loanMonthlyTotal,
      minimumReserve
    ]
  );

  const evaluation = useMemo(
    () =>
      evaluateSuggestedExtraPayment({
        suggestedExtraPayment,
        affordableExtraPayment:
          capacity.affordableExtraPayment
      }),
    [
      suggestedExtraPayment,
      capacity.affordableExtraPayment
    ]
  );

  function updateReserve(value) {
    const nextValue = Math.max(
      0,
      Number(value || 0)
    );

    setMinimumReserve(nextValue);

    localStorage.setItem(
      'minimum-reserve',
      String(nextValue)
    );
  }

  const statusLabel = {
    affordable: 'Abono viable',
    'partially-affordable':
      'Supera tu capacidad',
    'not-affordable':
      'Sin capacidad disponible',
    'not-needed':
      'No requiere abono'
  }[evaluation.status];

  return (
    <div className="budget-capacity-box">
      <div className="budget-capacity-heading">
        <div>
          <span className="eyebrow">
            PRESUPUESTO INTELIGENTE
          </span>

          <h3>
            Capacidad real para abonar
          </h3>

          <p>
            El cálculo reserva dinero para todos
            tus presupuestos, el préstamo y tu
            fondo mínimo.
          </p>
        </div>

        <span
          className={`capacity-status ${evaluation.status}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="capacity-grid">
        <CapacityValue
          label="Ingreso mensual"
          value={currency.format(
            capacity.monthlyIncome
          )}
        />

        <CapacityValue
          label="Presupuestos sin préstamo"
          value={currency.format(
            capacity.categoryBudgets
          )}
        />

        <CapacityValue
          label="Pago total del préstamo"
          value={currency.format(
            capacity.loanPayment
          )}
        />

        <CapacityValue
          label="Gastos comprometidos"
          value={currency.format(
            capacity.committedExpenses
          )}
        />
      </div>

      <div className="reserve-control">
        <label>
          <span>Reserva mínima mensual</span>

          <div className="reserve-input">
            <span>Q</span>

            <input
              type="number"
              min="0"
              step="100"
              value={minimumReserve}
              onChange={(event) =>
                updateReserve(event.target.value)
              }
            />
          </div>
        </label>

        <div className="capacity-result">
          <span>
            Capacidad máxima para abono extra
          </span>

          <strong>
            {currency.format(
              capacity.affordableExtraPayment
            )}
          </strong>
        </div>
      </div>

      <div className="capacity-comparison">
        <div>
          <span>Abono recomendado</span>

          <strong>
            {currency.format(
              suggestedExtraPayment
            )}
          </strong>
        </div>

        <div>
          <span>
            Capacidad según presupuesto
          </span>

          <strong>
            {currency.format(
              capacity.affordableExtraPayment
            )}
          </strong>
        </div>

        <div>
          <span>
            {evaluation.status === 'affordable'
              ? 'Dinero restante después del abono'
              : 'Cantidad que falta liberar'}
          </span>

          <strong>
            {currency.format(
              evaluation.difference
            )}
          </strong>
        </div>
      </div>

      <p
        className={`capacity-message ${evaluation.status}`}
      >
        {evaluation.message}
      </p>
    </div>
  );
}

function CapacityValue({ label, value }) {
  return (
    <article className="capacity-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}