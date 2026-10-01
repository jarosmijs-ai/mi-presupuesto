import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function replaceOnce(code, search, replacement, label) {
  if (!code.includes(search)) {
    throw new Error(`[liquid-v42] No se encontró el bloque: ${label}`);
  }
  return code.replace(search, replacement);
}

function transformApp(source) {
  let code = source.replace(/\r\n/g, '\n');

  code = replaceOnce(
    code,
    "  const [activeSection, setActiveSection] = useState('home');",
    `  const [activeSection, setActiveSection] = useState(() => {\n    const saved = loadState('active-section', 'home');\n\n    return NAV_ITEMS.some((item) => item.id === saved)\n      ? saved\n      : 'home';\n  });`,
    'estado de navegación'
  );

  code = replaceOnce(
    code,
    `  const [selectedMonth, setSelectedMonth] = useState(() =>\n    getCurrentMonthKey()\n  );`,
    `  const [selectedMonth, setSelectedMonth] = useState(() =>\n    loadState('selected-month', getCurrentMonthKey())\n  );`,
    'mes seleccionado'
  );

  code = replaceOnce(
    code,
    `    date: createDateForMonth(getCurrentMonthKey()),`,
    `    date: createDateForMonth(\n      loadState('selected-month', getCurrentMonthKey())\n    ),`,
    'fecha inicial del movimiento'
  );

  code = replaceOnce(
    code,
    `  const projectedExtra = Math.max(\n    0,\n    remaining - 1000\n  );`,
    `  const projectedExtra = Math.max(\n    0,\n    remaining - 1000\n  );\n\n  const scheduledLoanTotal = Number(\n    budgets['Préstamo'] || 3982.52\n  );\n\n  const scheduledLoanPayments = useMemo(() => {\n    const first = Math.round(\n      (scheduledLoanTotal / 2) * 100\n    ) / 100;\n\n    const second = Math.max(\n      0,\n      Math.round(\n        (scheduledLoanTotal - first) * 100\n      ) / 100\n    );\n\n    return [first, second];\n  }, [scheduledLoanTotal]);\n\n  const loanPaymentStatus = useMemo(\n    () => ({\n      1: filteredExpenses.some(\n        (expense) =>\n          expense.source === 'scheduled-loan' &&\n          Number(expense.loanPaymentNumber) === 1\n      ),\n      2: filteredExpenses.some(\n        (expense) =>\n          expense.source === 'scheduled-loan' &&\n          Number(expense.loanPaymentNumber) === 2\n      )\n    }),\n    [filteredExpenses]\n  );`,
    'cálculo de cuotas del préstamo'
  );

  code = replaceOnce(
    code,
    `  function selectMonth(monthDifference) {`,
    `  function getLoanPaymentDate(paymentNumber) {\n    const [year, month] = selectedMonth\n      .split('-')\n      .map(Number);\n\n    if (paymentNumber === 1) {\n      return \`${'${selectedMonth}'}-15\`;\n    }\n\n    const lastDay = new Date(\n      year,\n      month,\n      0\n    ).getDate();\n\n    return \`${'${selectedMonth}'}-${'${String(lastDay).padStart(2, \'0\')}'}\`;\n  }\n\n  function markLoanPaymentPaid(\n    paymentNumber,\n    customAmount\n  ) {\n    if (loanPaymentStatus[paymentNumber]) {\n      return;\n    }\n\n    const fallbackAmount =\n      scheduledLoanPayments[paymentNumber - 1] || 0;\n\n    const amount = Number(\n      customAmount ?? fallbackAmount\n    );\n\n    if (!amount || amount <= 0) {\n      return;\n    }\n\n    const nextExpense = {\n      id: createId(),\n      category: 'Préstamo',\n      amount,\n      date: getLoanPaymentDate(paymentNumber),\n      note: \`Pago ${'${paymentNumber}'} de 2 · Cuota del préstamo\`,\n      source: 'scheduled-loan',\n      loanPaymentNumber: paymentNumber\n    };\n\n    const next = [nextExpense, ...expenses];\n\n    setExpenses(next);\n    saveBasicState({\n      nextExpenses: next\n    });\n  }\n\n  function selectMonth(monthDifference) {`,
    'registro de pagos del préstamo'
  );

  code = replaceOnce(
    code,
    `    setSelectedMonth(nextMonth);\n    cancelExpenseEdit();`,
    `    setSelectedMonth(nextMonth);\n    localStorage.setItem(\n      'selected-month',\n      JSON.stringify(nextMonth)\n    );\n    cancelExpenseEdit();`,
    'persistencia al cambiar de mes'
  );

  code = replaceOnce(
    code,
    `    setSelectedMonth(currentMonth);\n    cancelExpenseEdit();`,
    `    setSelectedMonth(currentMonth);\n    localStorage.setItem(\n      'selected-month',\n      JSON.stringify(currentMonth)\n    );\n    cancelExpenseEdit();`,
    'persistencia al volver al mes actual'
  );

  code = replaceOnce(
    code,
    `  function openSection(sectionId) {\n    setActiveSection(sectionId);`,
    `  function openSection(sectionId) {\n    setActiveSection(sectionId);\n    localStorage.setItem(\n      'active-section',\n      JSON.stringify(sectionId)\n    );`,
    'persistencia de sección'
  );

  code = replaceOnce(
    code,
    `            <section className="home-actions">`,
    `            <section className="scheduled-payments glass-panel">\n              <div className="scheduled-payments-heading">\n                <div>\n                  <span className="eyebrow">\n                    PAGOS DEL MES\n                  </span>\n                  <h2>Préstamo en 2 pagos</h2>\n                  <p>\n                    Marca cada cuota únicamente cuando el pago ya se haya realizado.\n                  </p>\n                </div>\n\n                <span className="payment-counter">\n                  {[1, 2].filter(\n                    (number) => loanPaymentStatus[number]\n                  ).length}\n                  /2 pagados\n                </span>\n              </div>\n\n              <div className="scheduled-payment-grid">\n                {[1, 2].map((paymentNumber) => (\n                  <LoanPaymentCard\n                    key={paymentNumber}\n                    paymentNumber={paymentNumber}\n                    amount={\n                      scheduledLoanPayments[\n                        paymentNumber - 1\n                      ]\n                    }\n                    paid={\n                      loanPaymentStatus[paymentNumber]\n                    }\n                    onPaid={() =>\n                      markLoanPaymentPaid(\n                        paymentNumber\n                      )\n                    }\n                  />\n                ))}\n              </div>\n\n              <div className="scheduled-payment-note">\n                <span>＋</span>\n                Los abonos extra a capital se mantienen separados de estas dos cuotas.\n              </div>\n            </section>\n\n            <section className="home-actions">`,
    'tarjetas de pagos en Inicio'
  );

  code = replaceOnce(
    code,
    `            <LoanPanel\n              monthlyIncome={effectiveIncome}\n              budgets={budgets}\n            />`,
    `            <LoanPanel\n              monthlyIncome={effectiveIncome}\n              budgets={budgets}\n              selectedMonthLabel={formatMonthLabel(\n                selectedMonth\n              )}\n              paymentStatus={loanPaymentStatus}\n              installmentAmounts={scheduledLoanPayments}\n              onMarkPaymentPaid={markLoanPaymentPaid}\n            />`,
    'propiedades del panel de préstamo'
  );

  code = replaceOnce(
    code,
    `function SummaryCard({`,
    `function LoanPaymentCard({\n  paymentNumber,\n  amount,\n  paid,\n  onPaid\n}) {\n  return (\n    <article\n      className={\n        paid\n          ? 'scheduled-payment-card paid'\n          : 'scheduled-payment-card'\n      }\n    >\n      <div className="payment-card-topline">\n        <span>\n          {paymentNumber === 1\n            ? 'PRIMERA QUINCENA'\n            : 'SEGUNDA QUINCENA'}\n        </span>\n\n        <span\n          className={\n            paid\n              ? 'payment-status paid'\n              : 'payment-status pending'\n          }\n        >\n          {paid ? 'Pagado' : 'Pendiente'}\n        </span>\n      </div>\n\n      <div className="payment-card-main">\n        <div>\n          <small>\n            Préstamo · Pago {paymentNumber} de 2\n          </small>\n          <strong>{currency.format(amount)}</strong>\n        </div>\n\n        <span className="payment-sequence">\n          {paymentNumber}/2\n        </span>\n      </div>\n\n      <button\n        type="button"\n        className={\n          paid\n            ? 'payment-paid-button is-paid'\n            : 'payment-paid-button'\n        }\n        onClick={onPaid}\n        disabled={paid}\n      >\n        {paid ? '✓ Ya registrado' : '✓ Ya se pagó'}\n      </button>\n    </article>\n  );\n}\n\nfunction SummaryCard({`,
    'componente de cuota'
  );

  return code;
}

function transformLoanPanel(source) {
  let code = source.replace(/\r\n/g, '\n');

  code = replaceOnce(
    code,
    `export default function LoanPanel({\n  monthlyIncome,\n  budgets\n}) {`,
    `export default function LoanPanel({\n  monthlyIncome,\n  budgets,\n  selectedMonthLabel = '',\n  paymentStatus = {},\n  installmentAmounts,\n  onMarkPaymentPaid\n}) {`,
    'props de LoanPanel'
  );

  code = replaceOnce(
    code,
    `  const comparison = useMemo(`,
    `  const splitMonthlyPayment = useMemo(() => {\n    if (\n      Array.isArray(installmentAmounts) &&\n      installmentAmounts.length === 2\n    ) {\n      return installmentAmounts.map((value) =>\n        Math.max(0, Number(value || 0))\n      );\n    }\n\n    const total = Number(\n      breakdown.monthlyTotalPayment || 0\n    );\n\n    const first = Math.round(\n      (total / 2) * 100\n    ) / 100;\n\n    return [\n      first,\n      Math.max(\n        0,\n        Math.round((total - first) * 100) / 100\n      )\n    ];\n  }, [\n    installmentAmounts,\n    breakdown.monthlyTotalPayment\n  ]);\n\n  const comparison = useMemo(`,
    'cálculo de pagos divididos'
  );

  code = replaceOnce(
    code,
    `            Proyección y abonos adicionales`,
    `            Cuotas, saldo y abonos adicionales`,
    'título de préstamo'
  );

  code = replaceOnce(
    code,
    `      <div className="loan-breakdown">`,
    `      <div className="loan-installments">\n        <div className="loan-installments-heading">\n          <div>\n            <span className="eyebrow">\n              CUOTAS DEL MES\n            </span>\n            <h3>2 pagos, una sola cuota mensual</h3>\n            <p>\n              {selectedMonthLabel\n                ? \`Estado de ${'${selectedMonthLabel}'}. \`\n                : ''}\n              Cada pago se registra por separado.\n            </p>\n          </div>\n\n          <span className="loan-installment-total">\n            {currency.format(\n              splitMonthlyPayment.reduce(\n                (sum, value) => sum + value,\n                0\n              )\n            )}\n            <small> total mensual</small>\n          </span>\n        </div>\n\n        <div className="loan-installment-grid">\n          {[1, 2].map((paymentNumber) => {\n            const paid = Boolean(\n              paymentStatus[paymentNumber]\n            );\n\n            const amount =\n              splitMonthlyPayment[\n                paymentNumber - 1\n              ];\n\n            return (\n              <article\n                key={paymentNumber}\n                className={\n                  paid\n                    ? 'loan-installment-card paid'\n                    : 'loan-installment-card'\n                }\n              >\n                <div>\n                  <span>\n                    Pago {paymentNumber} de 2\n                  </span>\n                  <strong>\n                    {currency.format(amount)}\n                  </strong>\n                </div>\n\n                <button\n                  type="button"\n                  className="loan-installment-action"\n                  disabled={paid}\n                  onClick={() =>\n                    onMarkPaymentPaid?.(\n                      paymentNumber,\n                      amount\n                    )\n                  }\n                >\n                  {paid\n                    ? '✓ Pagado'\n                    : '✓ Ya se pagó'}\n                </button>\n              </article>\n            );\n          })}\n        </div>\n      </div>\n\n      <div className="loan-breakdown">`,
    'cuotas dentro del préstamo'
  );

  return code;
}

function liquidBudgetPlugin() {
  return {
    name: 'mi-presupuesto-liquid-v42',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.split('?')[0];

      if (cleanId.endsWith('/src/App.jsx')) {
        return {
          code: transformApp(code),
          map: null
        };
      }

      if (cleanId.endsWith('/src/LoanPanel.jsx')) {
        return {
          code: transformLoanPanel(code),
          map: null
        };
      }

      if (cleanId.endsWith('/src/main.jsx')) {
        const next = replaceOnce(
          code,
          `import './styles.css';`,
          `import './styles.css';\nimport './liquid-v42.css';`,
          'import del tema Liquid Glass'
        );

        return { code: next, map: null };
      }

      return null;
    }
  };
}

export default defineConfig({
  plugins: [liquidBudgetPlugin(), react()]
});
