import React, { useMemo, useState } from 'react';
import LoanPanel from './LoanPanel';
import IncomePanel from './IncomePanel';
import FinancialCharts from './FinancialCharts';
import BackupPanel from './BackupPanel';
import InstallAppButton from './InstallAppButton';

import {
  loadIncomes,
  calculateTotalIncome
} from './incomeTracker';

import {
  getCurrentMonthKey,
  changeMonth,
  formatMonthLabel,
  filterItemsByMonth
} from './monthUtils';

import {
  loadAllMonthlyBudgets,
  saveAllMonthlyBudgets,
  getBudgetForMonth,
  updateBudgetForMonth,
  copyBudgetBetweenMonths,
  resetBudgetForMonth
} from './monthlyBudgets';

const createIcon = (symbol) => {
  return function Icon({ size = 20 }) {
    return (
      <span
        aria-hidden="true"
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          display: 'inline-block'
        }}
      >
        {symbol}
      </span>
    );
  };
};

const ArrowDownCircle = createIcon('↓');
const Banknote = createIcon('💵');
const Fuel = createIcon('⛽');
const Home = createIcon('⌂');
const Plus = createIcon('+');
const ReceiptText = createIcon('🧾');
const Trash2 = createIcon('×');
const Utensils = createIcon('🍽');
const Wifi = createIcon('⌁');
const Smartphone = createIcon('📱');
const Zap = createIcon('⚡');

const categoryIcons = {
  Gasolina: Fuel,
  Teléfono: Smartphone,
  Luz: Zap,
  Internet: Wifi,
  Comidas: Utensils,
  Préstamo: Banknote,
  Otros: ReceiptText
};

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ'
});

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio', icon: '⌂' },
  { id: 'income', label: 'Ingresos', icon: '＋' },
  { id: 'expenses', label: 'Gastos', icon: '−' },
  { id: 'charts', label: 'Análisis', icon: '◔' },
  { id: 'loan', label: 'Préstamo', icon: 'Q' }
];

function loadState(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function loadInitialMonthlyBudgets() {
  const savedMonthlyBudgets = loadAllMonthlyBudgets();
  const currentMonth = getCurrentMonthKey();

  if (!savedMonthlyBudgets[currentMonth]) {
    const oldBudget = loadState('budgets', null);

    if (oldBudget) {
      return {
        ...savedMonthlyBudgets,
        [currentMonth]: oldBudget
      };
    }
  }

  return savedMonthlyBudgets;
}

function createId() {
  if (
    typeof crypto !== 'undefined' &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function createDateForMonth(monthKey) {
  const today = new Date();

  if (monthKey === getCurrentMonthKey()) {
    return today.toISOString().slice(0, 10);
  }

  return `${monthKey}-01`;
}

export default function App() {
  const [activeSection, setActiveSection] = useState('home');

  const [income, setIncome] = useState(() =>
    loadState('income', 12000)
  );

  const [expenses, setExpenses] = useState(() =>
    loadState('expenses', [])
  );

  const [incomes, setIncomes] = useState(() =>
    loadIncomes()
  );

  const [monthlyBudgets, setMonthlyBudgets] = useState(() =>
    loadInitialMonthlyBudgets()
  );

  const [selectedMonth, setSelectedMonth] = useState(() =>
    getCurrentMonthKey()
  );

  const [form, setForm] = useState(() => ({
    category: 'Gasolina',
    amount: '',
    date: createDateForMonth(getCurrentMonthKey()),
    note: ''
  }));

  const [
    editingExpenseId,
    setEditingExpenseId
  ] = useState(null);

  const [
    expenseEditForm,
    setExpenseEditForm
  ] = useState({
    category: 'Gasolina',
    amount: '',
    date: '',
    note: ''
  });

  const budgets = useMemo(
    () =>
      getBudgetForMonth(
        monthlyBudgets,
        selectedMonth
      ),
    [monthlyBudgets, selectedMonth]
  );

  const filteredExpenses = useMemo(
    () =>
      filterItemsByMonth(
        expenses,
        selectedMonth
      ),
    [expenses, selectedMonth]
  );

  const filteredIncomes = useMemo(
    () =>
      filterItemsByMonth(
        incomes,
        selectedMonth
      ),
    [incomes, selectedMonth]
  );

  const totalSpent = useMemo(
    () =>
      filteredExpenses.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      ),
    [filteredExpenses]
  );

  const totalBudget = useMemo(
    () =>
      Object.values(budgets).reduce(
        (sum, value) =>
          sum + Number(value || 0),
        0
      ),
    [budgets]
  );

  const recordedIncome = useMemo(
    () =>
      calculateTotalIncome(
        filteredIncomes
      ),
    [filteredIncomes]
  );

  const effectiveIncome =
    recordedIncome > 0
      ? recordedIncome
      : income;

  const remaining =
    effectiveIncome - totalSpent;

  const projectedExtra = Math.max(
    0,
    remaining - 1000
  );

  function saveBasicState({
    nextIncome = income,
    nextExpenses = expenses
  } = {}) {
    localStorage.setItem(
      'income',
      JSON.stringify(nextIncome)
    );

    localStorage.setItem(
      'expenses',
      JSON.stringify(nextExpenses)
    );
  }

  function updateIncome(value) {
    const next = Number(value || 0);

    setIncome(next);

    saveBasicState({
      nextIncome: next
    });
  }

  function updateBudget(category, value) {
    const nextMonthlyBudgets =
      updateBudgetForMonth({
        monthlyBudgets,
        monthKey: selectedMonth,
        category,
        amount: value
      });

    setMonthlyBudgets(nextMonthlyBudgets);
    saveAllMonthlyBudgets(nextMonthlyBudgets);
  }

  function copyPreviousMonthBudget() {
    const previousMonth =
      changeMonth(selectedMonth, -1);

    const nextMonthlyBudgets =
      copyBudgetBetweenMonths({
        monthlyBudgets,
        sourceMonth: previousMonth,
        destinationMonth: selectedMonth
      });

    setMonthlyBudgets(nextMonthlyBudgets);
    saveAllMonthlyBudgets(nextMonthlyBudgets);
  }

  function resetSelectedMonthBudget() {
    const shouldReset = window.confirm(
      `¿Restablecer el presupuesto de ${formatMonthLabel(
        selectedMonth
      )}?`
    );

    if (!shouldReset) {
      return;
    }

    const nextMonthlyBudgets =
      resetBudgetForMonth({
        monthlyBudgets,
        monthKey: selectedMonth
      });

    setMonthlyBudgets(nextMonthlyBudgets);
    saveAllMonthlyBudgets(nextMonthlyBudgets);
  }

  function addExpense(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      return;
    }

    const nextExpense = {
      id: createId(),
      ...form,
      amount
    };

    const next = [
      nextExpense,
      ...expenses
    ];

    setExpenses(next);

    saveBasicState({
      nextExpenses: next
    });

    setForm({
      ...form,
      amount: '',
      note: ''
    });
  }

  function removeExpense(id) {
    const shouldRemove = window.confirm(
      '¿Eliminar este gasto?'
    );

    if (!shouldRemove) {
      return;
    }

    const next =
      expenses.filter(
        (expense) =>
          expense.id !== id
      );

    setExpenses(next);

    saveBasicState({
      nextExpenses: next
    });

    if (editingExpenseId === id) {
      cancelExpenseEdit();
    }
  }

  function startExpenseEdit(expense) {
    setEditingExpenseId(expense.id);

    setExpenseEditForm({
      category:
        expense.category || 'Otros',
      amount:
        String(expense.amount || ''),
      date:
        expense.date ||
        createDateForMonth(selectedMonth),
      note:
        expense.note || ''
    });
  }

  function cancelExpenseEdit() {
    setEditingExpenseId(null);

    setExpenseEditForm({
      category: 'Gasolina',
      amount: '',
      date: '',
      note: ''
    });
  }

  function saveExpenseEdit(event) {
    event.preventDefault();

    const amount = Number(
      expenseEditForm.amount
    );

    if (!amount || amount <= 0) {
      return;
    }

    const next = expenses.map(
      (expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              ...expenseEditForm,
              amount
            }
          : expense
    );

    setExpenses(next);

    saveBasicState({
      nextExpenses: next
    });

    cancelExpenseEdit();
  }

  function spentByCategory(category) {
    return filteredExpenses
      .filter(
        (expense) =>
          expense.category === category
      )
      .reduce(
        (sum, expense) =>
          sum + Number(expense.amount || 0),
        0
      );
  }

  function selectMonth(monthDifference) {
    const nextMonth =
      changeMonth(
        selectedMonth,
        monthDifference
      );

    setSelectedMonth(nextMonth);
    cancelExpenseEdit();

    setForm((current) => ({
      ...current,
      date: createDateForMonth(nextMonth)
    }));
  }

  function returnToCurrentMonth() {
    const currentMonth =
      getCurrentMonthKey();

    setSelectedMonth(currentMonth);
    cancelExpenseEdit();

    setForm((current) => ({
      ...current,
      date: createDateForMonth(currentMonth)
    }));
  }

  function openSection(sectionId) {
    setActiveSection(sectionId);

    window.requestAnimationFrame(() => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  const isCurrentMonth =
    selectedMonth === getCurrentMonthKey();

  const previousMonth =
    changeMonth(selectedMonth, -1);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">
            CONTROL FINANCIERO
          </span>

          <h1>Mi Presupuesto</h1>

          <p>
            Administra tus ingresos, gastos y posibles
            abonos a tu préstamo.
          </p>
        </div>

        <div className="income-box">
          <label htmlFor="income">
            Ingreso mensual estimado
          </label>

          <div className="money-input">
            <span>Q</span>

            <input
              id="income"
              type="number"
              min="0"
              value={income}
              onChange={(event) =>
                updateIncome(event.target.value)
              }
            />
          </div>
        </div>
      </header>

      <main className="mobile-page-content">
        <section className="month-selector">
          <button
            type="button"
            className="month-arrow"
            onClick={() => selectMonth(-1)}
            aria-label="Mes anterior"
          >
            ←
          </button>

          <div className="month-selector-copy">
            <span>MES SELECCIONADO</span>

            <strong>
              {formatMonthLabel(selectedMonth)}
            </strong>

            {!isCurrentMonth && (
              <button
                type="button"
                className="current-month-button"
                onClick={returnToCurrentMonth}
              >
                Volver al mes actual
              </button>
            )}
          </div>

          <button
            type="button"
            className="month-arrow"
            onClick={() => selectMonth(1)}
            aria-label="Mes siguiente"
          >
            →
          </button>
        </section>

        {activeSection === 'home' && (
          <section
            className="app-view"
            aria-label="Inicio"
          >
            <div className="mobile-view-heading">
              <div>
                <span className="eyebrow">
                  RESUMEN DEL MES
                </span>
                <h2>Tu panorama financiero</h2>
              </div>

              <span className="view-badge">
                {formatMonthLabel(selectedMonth)}
              </span>
            </div>

            <section className="summary-grid">
              <SummaryCard
                label={
                  recordedIncome > 0
                    ? 'Ingresos recibidos'
                    : 'Ingreso estimado'
                }
                value={currency.format(
                  effectiveIncome
                )}
                icon={Banknote}
                note={
                  recordedIncome > 0
                    ? `${filteredIncomes.length} ingresos registrados`
                    : 'No hay ingresos registrados'
                }
              />

              <SummaryCard
                label="Gastos registrados"
                value={currency.format(totalSpent)}
                icon={ArrowDownCircle}
                note={`${filteredExpenses.length} movimientos`}
              />

              <SummaryCard
                label="Disponible"
                value={currency.format(remaining)}
                icon={Home}
              />

              <SummaryCard
                label="Posible abono extra"
                value={currency.format(projectedExtra)}
                icon={Plus}
                note="Conservando Q1,000 de reserva"
              />
            </section>

            <section className="home-actions">
              <QuickAction
                title="Registrar ingreso"
                description="Agrega quincenas, bonos o comisiones."
                icon="＋"
                onClick={() => openSection('income')}
              />

              <QuickAction
                title="Registrar gasto"
                description="Controla tus movimientos del mes."
                icon="−"
                onClick={() => openSection('expenses')}
              />

              <QuickAction
                title="Revisar análisis"
                description="Consulta tus gráficas y presupuestos."
                icon="◔"
                onClick={() => openSection('charts')}
              />

              <QuickAction
                title="Simular préstamo"
                description="Calcula abonos y posibles ahorros."
                icon="Q"
                onClick={() => openSection('loan')}
              />
            </section>

            <BackupPanel />

            <InstallAppButton />
          </section>
        )}

        {activeSection === 'income' && (
          <section
            className="app-view"
            aria-label="Ingresos"
          >
            <div className="mobile-view-heading">
              <div>
                <span className="eyebrow">
                  DINERO RECIBIDO
                </span>
                <h2>Ingresos</h2>
              </div>

              <span className="view-total positive">
                {currency.format(recordedIncome)}
              </span>
            </div>

            <IncomePanel
              selectedMonth={selectedMonth}
              incomes={filteredIncomes}
              allIncomes={incomes}
              onIncomeChange={setIncomes}
            />
          </section>
        )}

        {activeSection === 'expenses' && (
          <section
            className="app-view"
            aria-label="Gastos"
          >
            <div className="mobile-view-heading">
              <div>
                <span className="eyebrow">
                  CONTROL DEL MES
                </span>
                <h2>Gastos y presupuesto</h2>
              </div>

              <span className="view-total negative">
                {currency.format(totalSpent)}
              </span>
            </div>

            <section className="content-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      NUEVO MOVIMIENTO
                    </span>

                    <h2>Registrar gasto</h2>
                  </div>
                </div>

                <form
                  className="expense-form"
                  onSubmit={addExpense}
                >
                  <label>
                    Categoría

                    <select
                      value={form.category}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          category: event.target.value
                        })
                      }
                    >
                      {Object.keys(budgets).map(
                        (category) => (
                          <option
                            key={category}
                            value={category}
                          >
                            {category}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    Monto

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={form.amount}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          amount: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Fecha

                    <input
                      type="date"
                      value={form.date}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          date: event.target.value
                        })
                      }
                    />
                  </label>

                  <label>
                    Nota

                    <input
                      type="text"
                      placeholder="Ej. gasolina de la semana"
                      value={form.note}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          note: event.target.value
                        })
                      }
                    />
                  </label>

                  <button
                    className="primary-button"
                    type="submit"
                  >
                    <Plus size={18} />
                    Agregar gasto
                  </button>
                </form>
              </div>

              <div className="panel">
                <div className="panel-heading budget-panel-heading">
                  <div>
                    <span className="eyebrow">
                      PLAN MENSUAL
                    </span>

                    <h2>
                      Presupuesto por categoría
                    </h2>
                  </div>

                  <div className="budget-heading-right">
                    <strong>
                      {currency.format(totalBudget)}
                    </strong>

                    <div className="budget-actions">
                      <button
                        type="button"
                        className="small-secondary-button"
                        onClick={copyPreviousMonthBudget}
                      >
                        Copiar{' '}
                        {formatMonthLabel(
                          previousMonth
                        )}
                      </button>

                      <button
                        type="button"
                        className="small-reset-button"
                        onClick={resetSelectedMonthBudget}
                      >
                        Restablecer
                      </button>
                    </div>
                  </div>
                </div>

                <div className="budget-list">
                  {Object.entries(budgets).map(
                    ([category, budget]) => {
                      const spent =
                        spentByCategory(category);

                      const percent =
                        budget > 0
                          ? Math.min(
                              (spent / budget) * 100,
                              100
                            )
                          : 0;

                      const Icon =
                        categoryIcons[category] ||
                        ReceiptText;

                      return (
                        <div
                          className="budget-row"
                          key={category}
                        >
                          <div className="category-icon">
                            <Icon size={18} />
                          </div>

                          <div className="budget-details">
                            <div className="budget-title">
                              <span>{category}</span>

                              <span>
                                {currency.format(spent)}
                                {' / '}
                                {currency.format(budget)}
                              </span>
                            </div>

                            <div className="progress-track">
                              <div
                                className="progress-value"
                                style={{
                                  width: `${percent}%`
                                }}
                              />
                            </div>
                          </div>

                          <input
                            className="budget-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={budget}
                            aria-label={`Presupuesto de ${category}`}
                            onChange={(event) =>
                              updateBudget(
                                category,
                                event.target.value
                              )
                            }
                          />
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    HISTORIAL
                  </span>

                  <h2>Gastos del mes</h2>
                </div>

                <span>
                  {filteredExpenses.length}{' '}
                  movimientos
                </span>
              </div>

              {filteredExpenses.length === 0 ? (
                <div className="empty-state">
                  <ReceiptText size={30} />

                  <p>
                    No hay gastos registrados en{' '}
                    {formatMonthLabel(selectedMonth)}.
                  </p>
                </div>
              ) : (
                <div className="transactions">
                  {filteredExpenses.map(
                    (expense) => {
                      const Icon =
                        categoryIcons[
                          expense.category
                        ] || ReceiptText;

                      const isEditing =
                        editingExpenseId ===
                        expense.id;

                      return (
                        <article
                          className={
                            isEditing
                              ? 'transaction transaction-editing'
                              : 'transaction'
                          }
                          key={expense.id}
                        >
                          {!isEditing ? (
                            <>
                              <div className="category-icon">
                                <Icon size={18} />
                              </div>

                              <div className="transaction-copy">
                                <strong>
                                  {expense.category}
                                </strong>

                                <span>
                                  {expense.note ||
                                    'Sin descripción'}
                                  {' · '}
                                  {expense.date}
                                </span>
                              </div>

                              <strong className="transaction-amount">
                                -
                                {currency.format(
                                  expense.amount
                                )}
                              </strong>

                              <div className="item-actions">
                                <button
                                  className="edit-icon-button"
                                  type="button"
                                  onClick={() =>
                                    startExpenseEdit(
                                      expense
                                    )
                                  }
                                  aria-label="Editar gasto"
                                >
                                  ✎
                                </button>

                                <button
                                  className="icon-button"
                                  type="button"
                                  onClick={() =>
                                    removeExpense(
                                      expense.id
                                    )
                                  }
                                  aria-label="Eliminar gasto"
                                >
                                  <Trash2 size={17} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <form
                              className="inline-edit-form"
                              onSubmit={saveExpenseEdit}
                            >
                              <div className="inline-edit-heading">
                                <div>
                                  <span className="eyebrow">
                                    EDITANDO GASTO
                                  </span>
                                  <strong>
                                    Corrige los datos del movimiento
                                  </strong>
                                </div>

                                <button
                                  type="button"
                                  className="inline-close-button"
                                  onClick={cancelExpenseEdit}
                                  aria-label="Cancelar edición"
                                >
                                  ×
                                </button>
                              </div>

                              <div className="inline-edit-grid">
                                <label>
                                  Categoría

                                  <select
                                    value={
                                      expenseEditForm.category
                                    }
                                    onChange={(event) =>
                                      setExpenseEditForm({
                                        ...expenseEditForm,
                                        category:
                                          event.target.value
                                      })
                                    }
                                  >
                                    {Object.keys(
                                      budgets
                                    ).map(
                                      (category) => (
                                        <option
                                          key={category}
                                          value={category}
                                        >
                                          {category}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </label>

                                <label>
                                  Monto

                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={
                                      expenseEditForm.amount
                                    }
                                    onChange={(event) =>
                                      setExpenseEditForm({
                                        ...expenseEditForm,
                                        amount:
                                          event.target.value
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Fecha

                                  <input
                                    type="date"
                                    value={
                                      expenseEditForm.date
                                    }
                                    onChange={(event) =>
                                      setExpenseEditForm({
                                        ...expenseEditForm,
                                        date:
                                          event.target.value
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Nota

                                  <input
                                    type="text"
                                    value={
                                      expenseEditForm.note
                                    }
                                    onChange={(event) =>
                                      setExpenseEditForm({
                                        ...expenseEditForm,
                                        note:
                                          event.target.value
                                      })
                                    }
                                  />
                                </label>
                              </div>

                              <div className="inline-edit-actions">
                                <button
                                  type="button"
                                  className="cancel-edit-button"
                                  onClick={cancelExpenseEdit}
                                >
                                  Cancelar
                                </button>

                                <button
                                  type="submit"
                                  className="save-edit-button"
                                >
                                  Guardar cambios
                                </button>
                              </div>
                            </form>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {activeSection === 'charts' && (
          <section
            className="app-view"
            aria-label="Análisis"
          >
            <FinancialCharts
              expenses={filteredExpenses}
              budgets={budgets}
            />
          </section>
        )}

        {activeSection === 'loan' && (
          <section
            className="app-view"
            aria-label="Préstamo"
          >
            <LoanPanel
              monthlyIncome={effectiveIncome}
              budgets={budgets}
            />
          </section>
        )}
      </main>

      <nav
        className="bottom-navigation"
        aria-label="Navegación principal"
      >
        {NAV_ITEMS.map((item) => {
          const isActive =
            activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={
                isActive
                  ? 'bottom-nav-item active'
                  : 'bottom-nav-item'
              }
              onClick={() =>
                openSection(item.id)
              }
              aria-current={
                isActive ? 'page' : undefined
              }
            >
              <span className="bottom-nav-icon">
                {item.icon}
              </span>

              <span className="bottom-nav-label">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  note
}) {
  return (
    <article className="summary-card">
      <div className="summary-icon">
        <Icon size={20} />
      </div>

      <span>{label}</span>
      <strong>{value}</strong>

      {note && <small>{note}</small>}
    </article>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onClick
}) {
  return (
    <button
      type="button"
      className="quick-action"
      onClick={onClick}
    >
      <span className="quick-action-icon">
        {icon}
      </span>

      <span className="quick-action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>

      <span className="quick-action-arrow">
        ›
      </span>
    </button>
  );
}