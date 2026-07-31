export const DEFAULT_LOAN_SETTINGS = {
  currentBalance: 105712.37,
  monthlyInterestRate: 1,
  biweeklyPrincipalPayment: 1802.7,
  biweeklyAdminFee: 12.5,
  biweeklyLifeInsurance: 162.56,
  biweeklyOtherInsurance: 13.5,
  contractualEndDate: '2029-07-16'
};

const STORAGE_KEY = 'loan-settings';

export function loadLoanSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return DEFAULT_LOAN_SETTINGS;
    }

    return {
      ...DEFAULT_LOAN_SETTINGS,
      ...JSON.parse(saved)
    };
  } catch {
    return DEFAULT_LOAN_SETTINGS;
  }
}

export function saveLoanSettings(settings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings)
  );
}

export function resetLoanSettings() {
  localStorage.removeItem(STORAGE_KEY);

  return DEFAULT_LOAN_SETTINGS;
}