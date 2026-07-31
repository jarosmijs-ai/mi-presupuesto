export function calculateExtraPaymentCapacity({
  monthlyIncome,
  budgets,
  loanMonthlyTotal,
  minimumReserve = 1000
}) {
  const income = Math.max(
    0,
    Number(monthlyIncome || 0)
  );

  const reserve = Math.max(
    0,
    Number(minimumReserve || 0)
  );

  const categoryBudgets = Object.entries(
    budgets || {}
  ).reduce((total, [category, amount]) => {
    if (category === 'Préstamo') {
      return total;
    }

    return total + Math.max(
      0,
      Number(amount || 0)
    );
  }, 0);

  const loanPayment = Math.max(
    0,
    Number(loanMonthlyTotal || 0)
  );

  const committedExpenses =
    categoryBudgets + loanPayment;

  const availableBeforeReserve =
    income - committedExpenses;

  const affordableExtraPayment = Math.max(
    0,
    availableBeforeReserve - reserve
  );

  return {
    monthlyIncome: income,
    categoryBudgets,
    loanPayment,
    committedExpenses,
    minimumReserve: reserve,
    availableBeforeReserve,
    affordableExtraPayment
  };
}

export function evaluateSuggestedExtraPayment({
  suggestedExtraPayment,
  affordableExtraPayment
}) {
  const suggested = Math.max(
    0,
    Number(suggestedExtraPayment || 0)
  );

  const affordable = Math.max(
    0,
    Number(affordableExtraPayment || 0)
  );

  if (suggested === 0) {
    return {
      status: 'not-needed',
      difference: 0,
      message:
        'No necesitas un abono adicional para este objetivo.'
    };
  }

  if (affordable <= 0) {
    return {
      status: 'not-affordable',
      difference: suggested,
      message:
        'Tu presupuesto actual no deja capacidad para un abono adicional.'
    };
  }

  if (affordable >= suggested) {
    return {
      status: 'affordable',
      difference: affordable - suggested,
      message:
        'El abono sugerido cabe dentro de tu presupuesto mensual.'
    };
  }

  return {
    status: 'partially-affordable',
    difference: suggested - affordable,
    message:
      'El abono sugerido supera tu capacidad mensual actual.'
  };
}