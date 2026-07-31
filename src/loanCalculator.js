export const DEFAULT_LOAN = {
  currentBalance: 105712.37,
  monthlyInterestRate: 0.01,
  biweeklyPrincipalPayment: 1802.7,
  biweeklyAdminFee: 12.5,
  biweeklyLifeInsurance: 162.56,
  biweeklyOtherInsurance: 13.5,
  contractualEndDate: '2029-07-16'
};

export function getMonthlyLoanBreakdown(loan = DEFAULT_LOAN) {
  const monthlyPrincipalPayment =
    loan.biweeklyPrincipalPayment * 2;

  const monthlyAdminFee =
    loan.biweeklyAdminFee * 2;

  const monthlyLifeInsurance =
    loan.biweeklyLifeInsurance * 2;

  const monthlyOtherInsurance =
    loan.biweeklyOtherInsurance * 2;

  const monthlyFees =
    monthlyAdminFee +
    monthlyLifeInsurance +
    monthlyOtherInsurance;

  const monthlyTotalPayment =
    monthlyPrincipalPayment + monthlyFees;

  return {
    monthlyPrincipalPayment,
    monthlyAdminFee,
    monthlyLifeInsurance,
    monthlyOtherInsurance,
    monthlyFees,
    monthlyTotalPayment
  };
}

export function calculateLoanProjection({
  balance,
  monthlyRate,
  regularMonthlyPayment,
  extraMonthlyPayment = 0,
  maxMonths = 600
}) {
  let currentBalance = Number(balance);
  let month = 0;
  let totalInterest = 0;
  let totalPrincipalPaid = 0;

  const payment =
    Number(regularMonthlyPayment) +
    Number(extraMonthlyPayment);

  const schedule = [];

  if (
    currentBalance <= 0 ||
    monthlyRate < 0 ||
    payment <= 0
  ) {
    return {
      months: 0,
      totalInterest: 0,
      totalPrincipalPaid: 0,
      totalPaid: 0,
      remainingBalance: currentBalance,
      schedule: []
    };
  }

  while (
    currentBalance > 0.01 &&
    month < maxMonths
  ) {
    month += 1;

    const interest =
      currentBalance * monthlyRate;

    let principal =
      payment - interest;

    if (principal <= 0) {
      return {
        months: month,
        totalInterest,
        totalPrincipalPaid,
        totalPaid:
          totalInterest +
          totalPrincipalPaid,
        remainingBalance: currentBalance,
        schedule,
        paymentTooLow: true
      };
    }

    if (principal > currentBalance) {
      principal = currentBalance;
    }

    const actualPayment =
      principal + interest;

    currentBalance -= principal;
    totalInterest += interest;
    totalPrincipalPaid += principal;

    schedule.push({
      month,
      interest,
      principal,
      payment: actualPayment,
      remainingBalance:
        Math.max(0, currentBalance)
    });
  }

  return {
    months: month,
    totalInterest,
    totalPrincipalPaid,
    totalPaid:
      totalInterest +
      totalPrincipalPaid,
    remainingBalance:
      Math.max(0, currentBalance),
    schedule,
    paymentTooLow: false
  };
}

export function calculateEstimatedEndDate(
  months,
  startDate = new Date()
) {
  const result = new Date(startDate);

  result.setMonth(
    result.getMonth() + Number(months)
  );

  return result;
}

export function compareLoanScenarios({
  balance = DEFAULT_LOAN.currentBalance,
  monthlyRate =
    DEFAULT_LOAN.monthlyInterestRate,
  regularMonthlyPayment =
    DEFAULT_LOAN.biweeklyPrincipalPayment * 2,
  extraMonthlyPayment = 0,
  startDate = new Date()
}) {
  const baseScenario =
    calculateLoanProjection({
      balance,
      monthlyRate,
      regularMonthlyPayment,
      extraMonthlyPayment: 0
    });

  const extraScenario =
    calculateLoanProjection({
      balance,
      monthlyRate,
      regularMonthlyPayment,
      extraMonthlyPayment
    });

  return {
    baseScenario: {
      ...baseScenario,
      estimatedEndDate:
        calculateEstimatedEndDate(
          baseScenario.months,
          startDate
        )
    },

    extraScenario: {
      ...extraScenario,
      estimatedEndDate:
        calculateEstimatedEndDate(
          extraScenario.months,
          startDate
        )
    },

    monthsSaved:
      baseScenario.months -
      extraScenario.months,

    interestSaved:
      baseScenario.totalInterest -
      extraScenario.totalInterest
  };
}
export function calculateRequiredExtraForTargetMonths({
  balance,
  monthlyRate,
  regularMonthlyPayment,
  targetMonths,
  maxExtraPayment = 100000,
  tolerance = 0.01
}) {
  const desiredMonths = Math.max(
    1,
    Math.floor(Number(targetMonths))
  );

  const baseScenario = calculateLoanProjection({
    balance,
    monthlyRate,
    regularMonthlyPayment,
    extraMonthlyPayment: 0
  });

  if (desiredMonths >= baseScenario.months) {
    return {
      requiredExtraPayment: 0,
      targetMonths: baseScenario.months,
      achievedMonths: baseScenario.months,
      possible: true
    };
  }

  let low = 0;
  let high = maxExtraPayment;
  let bestExtra = high;
  let bestScenario = null;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = (low + high) / 2;

    const scenario = calculateLoanProjection({
      balance,
      monthlyRate,
      regularMonthlyPayment,
      extraMonthlyPayment: middle
    });

    if (scenario.months <= desiredMonths) {
      bestExtra = middle;
      bestScenario = scenario;
      high = middle;
    } else {
      low = middle;
    }

    if (high - low < tolerance) {
      break;
    }
  }

  return {
    requiredExtraPayment:
      Math.ceil(bestExtra * 100) / 100,
    targetMonths: desiredMonths,
    achievedMonths:
      bestScenario?.months ?? desiredMonths,
    possible: Boolean(bestScenario)
  };
}