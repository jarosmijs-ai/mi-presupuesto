const STORAGE_KEY = 'monthly-budgets';

export const DEFAULT_MONTHLY_BUDGETS = {
  Gasolina: 1200,
  Teléfono: 350,
  Luz: 600,
  Internet: 400,
  Comidas: 2000,
  Préstamo: 3982.52,
  Otros: 500
};

export function loadAllMonthlyBudgets() {
  try {
    const saved = localStorage.getItem(
      STORAGE_KEY
    );

    return saved
      ? JSON.parse(saved)
      : {};
  } catch {
    return {};
  }
}

export function saveAllMonthlyBudgets(
  monthlyBudgets
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(monthlyBudgets)
  );
}

export function getBudgetForMonth(
  monthlyBudgets,
  monthKey
) {
  const savedBudget =
    monthlyBudgets?.[monthKey];

  if (savedBudget) {
    return {
      ...DEFAULT_MONTHLY_BUDGETS,
      ...savedBudget
    };
  }

  return {
    ...DEFAULT_MONTHLY_BUDGETS
  };
}

export function updateBudgetForMonth({
  monthlyBudgets,
  monthKey,
  category,
  amount
}) {
  const currentBudget =
    getBudgetForMonth(
      monthlyBudgets,
      monthKey
    );

  return {
    ...monthlyBudgets,

    [monthKey]: {
      ...currentBudget,
      [category]: Math.max(
        0,
        Number(amount || 0)
      )
    }
  };
}

export function copyBudgetBetweenMonths({
  monthlyBudgets,
  sourceMonth,
  destinationMonth
}) {
  const sourceBudget =
    getBudgetForMonth(
      monthlyBudgets,
      sourceMonth
    );

  return {
    ...monthlyBudgets,

    [destinationMonth]: {
      ...sourceBudget
    }
  };
}

export function resetBudgetForMonth({
  monthlyBudgets,
  monthKey
}) {
  return {
    ...monthlyBudgets,

    [monthKey]: {
      ...DEFAULT_MONTHLY_BUDGETS
    }
  };
}