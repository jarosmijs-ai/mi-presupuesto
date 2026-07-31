import React, { useMemo, useState } from 'react';

import {
  getMonthlyLoanBreakdown,
  compareLoanScenarios,
  calculateRequiredExtraForTargetMonths
} from './loanCalculator';

import {
  loadLoanSettings,
  saveLoanSettings,
  resetLoanSettings
} from './loanSettings';

import {
  calculateExtraPaymentCapacity,
  evaluateSuggestedExtraPayment
} from './budgetAdvisor';

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ'
});

const dateFormatter = new Intl.DateTimeFormat('es-GT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric'
});

export default function LoanPanel({
  monthlyIncome,
  budgets
}) {
  const [loan, setLoan] = useState(() =>
    loadLoanSettings()
  );

  const [extraPayment, setExtraPayment] = useState(0);
  const [monthsToReduce, setMonthsToReduce] = useState(6);
  const [showSettings, setShowSettings] = useState(false);

  const [minimumReserve, setMinimumReserve] = useState(() => {
    try {
      const saved = localStorage.getItem(
        'minimum-reserve'
      );

      return saved ? Number(saved) : 1000;
    } catch {
      return 1000;
    }
  });

  const normalizedLoan = useMemo(
    () => ({
      currentBalance: Number(
        loan.currentBalance || 0
      ),

      monthlyInterestRate:
        Number(loan.monthlyInterestRate || 0) /
        100,

      biweeklyPrincipalPayment: Number(
        loan.biweeklyPrincipalPayment || 0
      ),

      biweeklyAdminFee: Number(
        loan.biweeklyAdminFee || 0
      ),

      biweeklyLifeInsurance: Number(
        loan.biweeklyLifeInsurance || 0
      ),

      biweeklyOtherInsurance: Number(
        loan.biweeklyOtherInsurance || 0
      ),

      contractualEndDate:
        loan.contractualEndDate
    }),
    [loan]
  );

  const breakdown = useMemo(
    () =>
      getMonthlyLoanBreakdown(
        normalizedLoan
      ),
    [normalizedLoan]
  );

  const comparison = useMemo(
    () =>
      compareLoanScenarios({
        balance:
          normalizedLoan.currentBalance,

        monthlyRate:
          normalizedLoan.monthlyInterestRate,

        regularMonthlyPayment:
          breakdown.monthlyPrincipalPayment,

        extraMonthlyPayment:
          Number(extraPayment || 0)
      }),
    [
      normalizedLoan.currentBalance,
      normalizedLoan.monthlyInterestRate,
      breakdown.monthlyPrincipalPayment,
      extraPayment
    ]
  );

  const base = comparison.baseScenario;
  const extra = comparison.extraScenario;

  const targetTotalMonths = Math.max(
    1,
    base.months -
      Number(monthsToReduce || 0)
  );

  const suggestedPayment = useMemo(
    () =>
      calculateRequiredExtraForTargetMonths({
        balance:
          normalizedLoan.currentBalance,

        monthlyRate:
          normalizedLoan.monthlyInterestRate,

        regularMonthlyPayment:
          breakdown.monthlyPrincipalPayment,

        targetMonths:
          targetTotalMonths
      }),
    [
      normalizedLoan.currentBalance,
      normalizedLoan.monthlyInterestRate,
      breakdown.monthlyPrincipalPayment,
      targetTotalMonths
    ]
  );

  const suggestedExtra =
    suggestedPayment.requiredExtraPayment || 0;

  const suggestedComparison = useMemo(
    () =>
      compareLoanScenarios({
        balance:
          normalizedLoan.currentBalance,

        monthlyRate:
          normalizedLoan.monthlyInterestRate,

        regularMonthlyPayment:
          breakdown.monthlyPrincipalPayment,

        extraMonthlyPayment:
          suggestedExtra
      }),
    [
      normalizedLoan.currentBalance,
      normalizedLoan.monthlyInterestRate,
      breakdown.monthlyPrincipalPayment,
      suggestedExtra
    ]
  );

  const budgetCapacity = useMemo(
    () =>
      calculateExtraPaymentCapacity({
        monthlyIncome,
        budgets,

        loanMonthlyTotal:
          breakdown.monthlyTotalPayment,

        minimumReserve
      }),
    [
      monthlyIncome,
      budgets,
      breakdown.monthlyTotalPayment,
      minimumReserve
    ]
  );

  const budgetEvaluation = useMemo(
    () =>
      evaluateSuggestedExtraPayment({
        suggestedExtraPayment:
          suggestedExtra,

        affordableExtraPayment:
          budgetCapacity.affordableExtraPayment
      }),
    [
      suggestedExtra,
      budgetCapacity.affordableExtraPayment
    ]
  );

  function updateLoanField(field, value) {
    setLoan((current) => ({
      ...current,
      [field]: value
    }));
  }

  function handleSaveSettings() {
    saveLoanSettings(loan);
    setShowSettings(false);
  }

  function handleResetSettings() {
    const defaults = resetLoanSettings();
    setLoan(defaults);
  }

  function applySuggestedPayment() {
    setExtraPayment(suggestedExtra);
  }

  function updateMinimumReserve(value) {
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

  const contractualDate =
    normalizedLoan.contractualEndDate
      ? new Date(
          `${normalizedLoan.contractualEndDate}T12:00:00`
        )
      : null;

  const capacityStatusLabel = {
    affordable: 'Abono viable',
    'partially-affordable':
      'Supera tu capacidad',
    'not-affordable':
      'Sin capacidad disponible',
    'not-needed':
      'No requiere abono'
  }[budgetEvaluation.status];

  return (
    <section className="panel loan-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            PRÉSTAMO
          </span>

          <h2>
            Proyección y abonos adicionales
          </h2>
        </div>

        <div className="loan-heading-actions">
          <span className="loan-status">
            {Number(
              loan.monthlyInterestRate || 0
            ).toFixed(2)}
            % mensual
          </span>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setShowSettings(
                (current) => !current
              )
            }
          >
            {showSettings
              ? 'Cerrar ajustes'
              : 'Editar préstamo'}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="loan-settings-box">
          <div className="loan-settings-heading">
            <div>
              <span className="eyebrow">
                CONFIGURACIÓN
              </span>

              <h3>Datos del préstamo</h3>
            </div>

            <button
              type="button"
              className="reset-button"
              onClick={handleResetSettings}
            >
              Restablecer
            </button>
          </div>

          <div className="loan-settings-grid">
            <SettingsField
              label="Saldo actual"
              value={loan.currentBalance}
              onChange={(value) =>
                updateLoanField(
                  'currentBalance',
                  value
                )
              }
            />

            <SettingsField
              label="Interés mensual (%)"
              value={loan.monthlyInterestRate}
              step="0.01"
              onChange={(value) =>
                updateLoanField(
                  'monthlyInterestRate',
                  value
                )
              }
            />

            <SettingsField
              label="Pago principal quincenal"
              value={
                loan.biweeklyPrincipalPayment
              }
              onChange={(value) =>
                updateLoanField(
                  'biweeklyPrincipalPayment',
                  value
                )
              }
            />

            <SettingsField
              label="Administración quincenal"
              value={loan.biweeklyAdminFee}
              onChange={(value) =>
                updateLoanField(
                  'biweeklyAdminFee',
                  value
                )
              }
            />

            <SettingsField
              label="Seguro de vida y desempleo"
              value={
                loan.biweeklyLifeInsurance
              }
              onChange={(value) =>
                updateLoanField(
                  'biweeklyLifeInsurance',
                  value
                )
              }
            />

            <SettingsField
              label="Otro seguro quincenal"
              value={
                loan.biweeklyOtherInsurance
              }
              onChange={(value) =>
                updateLoanField(
                  'biweeklyOtherInsurance',
                  value
                )
              }
            />

            <label className="settings-field">
              <span>
                Fecha contractual final
              </span>

              <input
                type="date"
                value={
                  loan.contractualEndDate || ''
                }
                onChange={(event) =>
                  updateLoanField(
                    'contractualEndDate',
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleSaveSettings}
          >
            Guardar configuración
          </button>
        </div>
      )}

      <div className="loan-summary-grid">
        <LoanValue
          label="Saldo actual"
          value={currency.format(
            normalizedLoan.currentBalance
          )}
        />

        <LoanValue
          label="Pago mensual total"
          value={currency.format(
            breakdown.monthlyTotalPayment
          )}
        />

        <LoanValue
          label="Aplicado al préstamo"
          value={currency.format(
            breakdown.monthlyPrincipalPayment
          )}
        />

        <LoanValue
          label="Seguros y administración"
          value={currency.format(
            breakdown.monthlyFees
          )}
        />
      </div>

      <div className="loan-breakdown">
        <div>
          <span>
            Pago quincenal al préstamo
          </span>

          <strong>
            {currency.format(
              normalizedLoan
                .biweeklyPrincipalPayment
            )}
          </strong>
        </div>

        <div>
          <span>
            Administración mensual
          </span>

          <strong>
            {currency.format(
              breakdown.monthlyAdminFee
            )}
          </strong>
        </div>

        <div>
          <span>
            Seguro de vida y desempleo
          </span>

          <strong>
            {currency.format(
              breakdown.monthlyLifeInsurance
            )}
          </strong>
        </div>

        <div>
          <span>
            Otro seguro mensual
          </span>

          <strong>
            {currency.format(
              breakdown.monthlyOtherInsurance
            )}
          </strong>
        </div>
      </div>

      <div className="extra-payment-box">
        <div>
          <span className="eyebrow">
            SIMULADOR
          </span>

          <h3>Abono extra mensual</h3>

          <p>
            Ingresa una cantidad adicional que
            pagarías directamente a capital.
          </p>
        </div>

        <label>
          <span>Monto adicional</span>

          <div className="extra-payment-input">
            <span>Q</span>

            <input
              type="number"
              min="0"
              step="50"
              value={extraPayment}
              onChange={(event) =>
                setExtraPayment(
                  Number(
                    event.target.value || 0
                  )
                )
              }
            />
          </div>
        </label>
      </div>

      <div className="scenario-grid">
        <ScenarioCard
          title="Sin abono adicional"
          months={base.months}
          endDate={base.estimatedEndDate}
          interest={base.totalInterest}
          payment={
            breakdown.monthlyPrincipalPayment
          }
        />

        <ScenarioCard
          title="Con abono adicional"
          months={extra.months}
          endDate={extra.estimatedEndDate}
          interest={extra.totalInterest}
          payment={
            breakdown.monthlyPrincipalPayment +
            Number(extraPayment || 0)
          }
          highlighted
        />
      </div>

      <div className="loan-savings">
        <div>
          <span>Meses reducidos</span>

          <strong>
            {comparison.monthsSaved}
          </strong>
        </div>

        <div>
          <span>
            Intereses estimados ahorrados
          </span>

          <strong>
            {currency.format(
              comparison.interestSaved
            )}
          </strong>
        </div>

        <div>
          <span>
            Fecha contractual registrada
          </span>

          <strong>
            {contractualDate
              ? dateFormatter.format(
                  contractualDate
                )
              : 'Sin fecha'}
          </strong>
        </div>
      </div>

      <div className="target-reduction-box">
        <div>
          <span className="eyebrow">
            RECOMENDACIÓN
          </span>

          <h3>
            ¿Cuántos meses quieres reducir?
          </h3>

          <p>
            La app calculará cuánto deberías
            abonar adicionalmente cada mes.
          </p>
        </div>

        <div className="target-buttons">
          {[3, 6, 12, 18].map(
            (months) => (
              <button
                key={months}
                type="button"
                className={
                  Number(monthsToReduce) ===
                  months
                    ? 'target-button active'
                    : 'target-button'
                }
                onClick={() =>
                  setMonthsToReduce(months)
                }
              >
                {months} meses
              </button>
            )
          )}
        </div>

        <label className="custom-months">
          <span>
            Otra cantidad de meses
          </span>

          <input
            type="number"
            min="1"
            max={Math.max(
              1,
              base.months - 1
            )}
            value={monthsToReduce}
            onChange={(event) =>
              setMonthsToReduce(
                Number(
                  event.target.value || 1
                )
              )
            }
          />
        </label>

        <div className="suggestion-result">
          <div>
            <span>
              Abono extra mensual sugerido
            </span>

            <strong>
              {currency.format(
                suggestedExtra
              )}
            </strong>
          </div>

          <div>
            <span>
              Pago mensual al crédito
            </span>

            <strong>
              {currency.format(
                breakdown
                  .monthlyPrincipalPayment +
                  suggestedExtra
              )}
            </strong>
          </div>

          <div>
            <span>
              Pago mensual total con cargos
            </span>

            <strong>
              {currency.format(
                breakdown
                  .monthlyTotalPayment +
                  suggestedExtra
              )}
            </strong>
          </div>

          <div>
            <span>
              Nueva fecha estimada
            </span>

            <strong>
              {dateFormatter.format(
                suggestedComparison
                  .extraScenario
                  .estimatedEndDate
              )}
            </strong>
          </div>

          <div>
            <span>
              Reducción estimada
            </span>

            <strong>
              {
                suggestedComparison
                  .monthsSaved
              }{' '}
              meses
            </strong>
          </div>

          <div>
            <span>
              Intereses estimados ahorrados
            </span>

            <strong>
              {currency.format(
                suggestedComparison
                  .interestSaved
              )}
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="primary-button suggestion-button"
          onClick={applySuggestedPayment}
        >
          Usar abono sugerido
        </button>
      </div>

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
              Este cálculo considera tus
              presupuestos, el pago completo del
              préstamo y una reserva mínima.
            </p>
          </div>

          <span
            className={`capacity-status ${budgetEvaluation.status}`}
          >
            {capacityStatusLabel}
          </span>
        </div>

        <div className="capacity-grid">
          <CapacityValue
            label="Ingreso mensual"
            value={currency.format(
              budgetCapacity.monthlyIncome
            )}
          />

          <CapacityValue
            label="Presupuestos sin préstamo"
            value={currency.format(
              budgetCapacity.categoryBudgets
            )}
          />

          <CapacityValue
            label="Pago total del préstamo"
            value={currency.format(
              budgetCapacity.loanPayment
            )}
          />

          <CapacityValue
            label="Gastos comprometidos"
            value={currency.format(
              budgetCapacity.committedExpenses
            )}
          />
        </div>

        <div className="reserve-control">
          <label>
            <span>
              Reserva mínima mensual
            </span>

            <div className="reserve-input">
              <span>Q</span>

              <input
                type="number"
                min="0"
                step="100"
                value={minimumReserve}
                onChange={(event) =>
                  updateMinimumReserve(
                    event.target.value
                  )
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
                budgetCapacity
                  .affordableExtraPayment
              )}
            </strong>
          </div>
        </div>

        <div className="capacity-comparison">
          <div>
            <span>
              Abono recomendado
            </span>

            <strong>
              {currency.format(
                suggestedExtra
              )}
            </strong>
          </div>

          <div>
            <span>
              Capacidad según presupuesto
            </span>

            <strong>
              {currency.format(
                budgetCapacity
                  .affordableExtraPayment
              )}
            </strong>
          </div>

          <div>
            <span>
              {budgetEvaluation.status ===
              'affordable'
                ? 'Dinero restante después del abono'
                : 'Cantidad que falta liberar'}
            </span>

            <strong>
              {currency.format(
                budgetEvaluation.difference
              )}
            </strong>
          </div>
        </div>

        <p
          className={`capacity-message ${budgetEvaluation.status}`}
        >
          {budgetEvaluation.message}
        </p>
      </div>

      <p className="loan-disclaimer">
        Esta es una estimación basada en la tasa
        mensual configurada. El cálculo real puede
        variar según cómo el banco aplique
        intereses, pagos quincenales, seguros y
        abonos a capital.
      </p>
    </section>
  );
}

function LoanValue({
  label,
  value
}) {
  return (
    <article className="loan-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CapacityValue({
  label,
  value
}) {
  return (
    <article className="capacity-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  step = '0.01'
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>

      <input
        type="number"
        min="0"
        step={step}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />
    </label>
  );
}

function ScenarioCard({
  title,
  months,
  endDate,
  interest,
  payment,
  highlighted = false
}) {
  return (
    <article
      className={
        highlighted
          ? 'scenario-card highlighted'
          : 'scenario-card'
      }
    >
      <span className="scenario-title">
        {title}
      </span>

      <strong className="scenario-date">
        {dateFormatter.format(endDate)}
      </strong>

      <div className="scenario-details">
        <div>
          <span>
            Duración estimada
          </span>

          <strong>
            {months} meses
          </strong>
        </div>

        <div>
          <span>
            Pago al crédito
          </span>

          <strong>
            {currency.format(payment)}
          </strong>
        </div>

        <div>
          <span>
            Intereses estimados
          </span>

          <strong>
            {currency.format(interest)}
          </strong>
        </div>
      </div>
    </article>
  );
}