export function getCurrentMonthKey() {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(
    today.getMonth() + 1
  ).padStart(2, '0');

  return `${year}-${month}`;
}

export function getMonthKeyFromDate(dateValue) {
  if (!dateValue) {
    return getCurrentMonthKey();
  }

  return String(dateValue).slice(0, 7);
}

export function formatMonthLabel(monthKey) {
  if (!monthKey) {
    return '';
  }

  const [year, month] = monthKey
    .split('-')
    .map(Number);

  const date = new Date(
    year,
    month - 1,
    1
  );

  return new Intl.DateTimeFormat(
    'es-GT',
    {
      month: 'long',
      year: 'numeric'
    }
  ).format(date);
}

export function changeMonth(
  monthKey,
  amount
) {
  const [year, month] = monthKey
    .split('-')
    .map(Number);

  const date = new Date(
    year,
    month - 1 + amount,
    1
  );

  const nextYear = date.getFullYear();

  const nextMonth = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  return `${nextYear}-${nextMonth}`;
}

export function filterItemsByMonth(
  items,
  monthKey
) {
  return (items || []).filter(
    (item) =>
      getMonthKeyFromDate(item.date) ===
      monthKey
  );
}
