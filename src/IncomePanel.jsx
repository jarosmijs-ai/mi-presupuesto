import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import {
  saveIncomes,
  calculateTotalIncome,
  createIncome,
  updateIncomeById
} from './incomeTracker';

import {
  formatMonthLabel
} from './monthUtils';

const currency = new Intl.NumberFormat(
  'es-GT',
  {
    style: 'currency',
    currency: 'GTQ'
  }
);

const EMPTY_EDIT_FORM = {
  type: 'Primera quincena',
  amount: '',
  date: '',
  note: ''
};

function createDateForMonth(monthKey) {
  const today = new Date();

  const currentMonth =
    `${today.getFullYear()}-${String(
      today.getMonth() + 1
    ).padStart(2, '0')}`;

  if (monthKey === currentMonth) {
    return today
      .toISOString()
      .slice(0, 10);
  }

  return `${monthKey}-01`;
}

export default function IncomePanel({
  selectedMonth,
  incomes = [],
  allIncomes = [],
  onIncomeChange
}) {
  const [form, setForm] = useState({
    type: 'Primera quincena',
    amount: '',
    date: createDateForMonth(
      selectedMonth
    ),
    note: ''
  });

  const [
    editingIncomeId,
    setEditingIncomeId
  ] = useState(null);

  const [
    editForm,
    setEditForm
  ] = useState(EMPTY_EDIT_FORM);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      date: createDateForMonth(
        selectedMonth
      )
    }));

    cancelIncomeEdit();
  }, [selectedMonth]);

  const totalIncome = useMemo(
    () => calculateTotalIncome(incomes),
    [incomes]
  );

  function addIncome(event) {
    event.preventDefault();

    const amount = Number(form.amount);

    if (!amount || amount <= 0) {
      return;
    }

    const newIncome = createIncome({
      ...form,
      amount
    });

    const next = [
      newIncome,
      ...allIncomes
    ];

    saveIncomes(next);
    onIncomeChange(next);

    setForm({
      ...form,
      amount: '',
      note: ''
    });
  }

  function removeIncome(id) {
    const shouldRemove = window.confirm(
      '¿Eliminar este ingreso?'
    );

    if (!shouldRemove) {
      return;
    }

    const next = allIncomes.filter(
      (income) => income.id !== id
    );

    saveIncomes(next);
    onIncomeChange(next);

    if (editingIncomeId === id) {
      cancelIncomeEdit();
    }
  }

  function startIncomeEdit(income) {
    setEditingIncomeId(income.id);

    setEditForm({
      type:
        income.type ||
        'Primera quincena',
      amount:
        String(income.amount || ''),
      date:
        income.date ||
        createDateForMonth(
          selectedMonth
        ),
      note:
        income.note || ''
    });
  }

  function cancelIncomeEdit() {
    setEditingIncomeId(null);
    setEditForm(EMPTY_EDIT_FORM);
  }

  function saveIncomeEdit(event) {
    event.preventDefault();

    const amount = Number(
      editForm.amount
    );

    if (!amount || amount <= 0) {
      return;
    }

    const next = updateIncomeById(
      allIncomes,
      editingIncomeId,
      {
        ...editForm,
        amount
      }
    );

    saveIncomes(next);
    onIncomeChange(next);
    cancelIncomeEdit();
  }

  return (
    <section className="panel income-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">
            INGRESOS DEL MES
          </span>

          <h2>
            {formatMonthLabel(
              selectedMonth
            )}
          </h2>
        </div>

        <strong>
          {currency.format(totalIncome)}
        </strong>
      </div>

      <form
        className="income-form"
        onSubmit={addIncome}
      >
        <label>
          Tipo de ingreso

          <IncomeTypeSelect
            value={form.type}
            onChange={(value) =>
              setForm({
                ...form,
                type: value
              })
            }
          />
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
            value={form.date}
            onChange={(event) =>
              setForm({
                ...form,
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
            placeholder="Ej. primera quincena"
            value={form.note}
            onChange={(event) =>
              setForm({
                ...form,
                note:
                  event.target.value
              })
            }
          />
        </label>

        <button
          type="submit"
          className="primary-button"
        >
          Agregar ingreso
        </button>
      </form>

      <div className="income-list">
        {incomes.length === 0 ? (
          <div className="empty-state">
            <p>
              No hay ingresos registrados
              en{' '}
              {formatMonthLabel(
                selectedMonth
              )}
              .
            </p>
          </div>
        ) : (
          incomes.map((income) => {
            const isEditing =
              editingIncomeId ===
              income.id;

            return (
              <article
                className={
                  isEditing
                    ? 'income-item income-item-editing'
                    : 'income-item'
                }
                key={income.id}
              >
                {!isEditing ? (
                  <>
                    <div>
                      <strong>
                        {income.type}
                      </strong>

                      <span>
                        {income.note ||
                          'Sin descripción'}
                        {' · '}
                        {income.date}
                      </span>
                    </div>

                    <strong className="income-amount">
                      +
                      {currency.format(
                        income.amount
                      )}
                    </strong>

                    <div className="item-actions">
                      <button
                        type="button"
                        className="edit-icon-button"
                        onClick={() =>
                          startIncomeEdit(
                            income
                          )
                        }
                        aria-label="Editar ingreso"
                      >
                        ✎
                      </button>

                      <button
                        type="button"
                        className="icon-button"
                        onClick={() =>
                          removeIncome(
                            income.id
                          )
                        }
                        aria-label="Eliminar ingreso"
                      >
                        ×
                      </button>
                    </div>
                  </>
                ) : (
                  <form
                    className="inline-edit-form"
                    onSubmit={saveIncomeEdit}
                  >
                    <div className="inline-edit-heading">
                      <div>
                        <span className="eyebrow">
                          EDITANDO INGRESO
                        </span>

                        <strong>
                          Corrige los datos del registro
                        </strong>
                      </div>

                      <button
                        type="button"
                        className="inline-close-button"
                        onClick={cancelIncomeEdit}
                        aria-label="Cancelar edición"
                      >
                        ×
                      </button>
                    </div>

                    <div className="inline-edit-grid">
                      <label>
                        Tipo de ingreso

                        <IncomeTypeSelect
                          value={editForm.type}
                          onChange={(value) =>
                            setEditForm({
                              ...editForm,
                              type: value
                            })
                          }
                        />
                      </label>

                      <label>
                        Monto

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
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
                          value={editForm.date}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
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
                          value={editForm.note}
                          onChange={(event) =>
                            setEditForm({
                              ...editForm,
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
                        onClick={cancelIncomeEdit}
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
          })
        )}
      </div>
    </section>
  );
}

function IncomeTypeSelect({
  value,
  onChange
}) {
  return (
    <select
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
    >
      <option>
        Primera quincena
      </option>

      <option>
        Segunda quincena
      </option>

      <option>Bono</option>
      <option>Comisión</option>
      <option>Otro ingreso</option>
    </select>
  );
}