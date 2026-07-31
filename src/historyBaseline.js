export const HISTORY_START_MONTH = '2026-08';
export const HISTORY_START_LABEL = 'agosto de 2026';

export function isWithinHistory(date) {
  const month = String(date || '').slice(0, 7);
  return /^\d{4}-\d{2}$/.test(month) && month >= HISTORY_START_MONTH;
}
