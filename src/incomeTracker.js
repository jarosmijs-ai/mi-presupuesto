const STORAGE_KEY = 'monthly-incomes';

export function loadIncomes() {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEY
    );

    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(
      'No se pudieron cargar los ingresos:',
      error
    );

    return [];
  }
}

export function saveIncomes(incomes) {
  try {
    const safeIncomes = Array.isArray(
      incomes
    )
      ? incomes
      : [];

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(safeIncomes)
    );
  } catch (error) {
    console.error(
      'No se pudieron guardar los ingresos:',
      error
    );
  }
}

export function calculateTotalIncome(
  incomes
) {
  return (incomes || []).reduce(
    (total, income) =>
      total +
      Number(income.amount || 0),
    0
  );
}

export function createIncome({
  type,
  amount,
  date,
  note
}) {
  return {
    id: createIncomeId(),

    type:
      type || 'Primera quincena',

    amount:
      Number(amount || 0),

    date:
      date ||
      new Date()
        .toISOString()
        .slice(0, 10),

    note:
      note || ''
  };
}

export function updateIncomeById(
  incomes,
  incomeId,
  changes
) {
  const safeIncomes = Array.isArray(
    incomes
  )
    ? incomes
    : [];

  return safeIncomes.map((income) => {
    if (income.id !== incomeId) {
      return income;
    }

    return {
      ...income,
      ...changes,

      amount: Number(
        changes.amount ?? income.amount ?? 0
      ),

      type:
        changes.type ??
        income.type ??
        'Primera quincena',

      date:
        changes.date ??
        income.date ??
        new Date()
          .toISOString()
          .slice(0, 10),

      note:
        changes.note ??
        income.note ??
        ''
    };
  });
}

export function removeIncomeById(
  incomes,
  incomeId
) {
  const safeIncomes = Array.isArray(
    incomes
  )
    ? incomes
    : [];

  return safeIncomes.filter(
    (income) =>
      income.id !== incomeId
  );
}

function createIncomeId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}