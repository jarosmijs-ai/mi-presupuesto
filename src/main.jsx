import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import ComponentBoundary from './ComponentBoundary.jsx';
import UpdatePrompt from './UpdatePrompt.jsx';
import AdvancedFinanceHub from './AdvancedFinanceHub.jsx';
import ProductCenter from './ProductCenter.jsx';
import SecurityGate from './SecurityGate.jsx';
import UXConsolidation from './UXConsolidation.jsx';
import IncomeAverageCard from './IncomeAverageCard.jsx';
import HistoryBaselineGuard from './HistoryBaselineGuard.jsx';
import FinancialInsightsDashboard from './FinancialInsightsDashboard.jsx';
import IncomeUsageCard from './IncomeUsageCard.jsx';
import LoanSafetyAdvisor from './LoanSafetyAdvisor.jsx';
import LoanCapitalTracker from './LoanCapitalTracker.jsx';
import CreditDecisionCenter from './CreditDecisionCenter.jsx';
import BiometricSettings from './BiometricSettings.jsx';
import FinancialDataBridge from './FinancialDataBridge.jsx';
import AutoCloudSync from './AutoCloudSync.jsx';
import SettingsEnhancements from './SettingsEnhancements.jsx';
import './styles.css';
import './premium.css';
import './advanced-finance.css';
import './product.css';
import './ux-consolidation.css';
import './income-average.css';
import './history-baseline.css';
import './financial-insights.css';
import './income-usage.css';
import './loan-safety-advisor.css';
import './loan-capital-tracker.css';
import './visual-polish.css';
import './credit-decision-center.css';
import './compact-summary.css';
import './minimal-shell.css';
import './primary-biometric.css';
import './sunset-palette.css';
import './settings-enhancements.css';

import { registerServiceWorker } from './registerServiceWorker';

const Safe = ({ name, children }) => (
  <ComponentBoundary name={name}>{children}</ComponentBoundary>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityGate>
        <Safe name="Puente de datos"><FinancialDataBridge /></Safe>
        <Safe name="Sincronización automática"><AutoCloudSync /></Safe>
        <ComponentBoundary name="Aplicación principal" fallback={null}><App /></ComponentBoundary>
        <Safe name="Planificación financiera"><AdvancedFinanceHub /></Safe>
        <Safe name="Configuración"><ProductCenter /></Safe>
        <Safe name="Biometría"><BiometricSettings /></Safe>
        <Safe name="Mejoras de configuración"><SettingsEnhancements /></Safe>
        <Safe name="Consolidación de interfaz"><UXConsolidation /></Safe>
        <Safe name="Promedio de ingresos"><IncomeAverageCard /></Safe>
        <Safe name="Historial"><HistoryBaselineGuard /></Safe>
        <Safe name="Análisis financiero"><FinancialInsightsDashboard /></Safe>
        <Safe name="Uso de ingresos"><IncomeUsageCard /></Safe>
        <Safe name="Asesor de préstamos"><LoanSafetyAdvisor /></Safe>
        <Safe name="Abonos reales a capital"><LoanCapitalTracker /></Safe>
        <Safe name="Centro de crédito"><CreditDecisionCenter /></Safe>
        <Safe name="Actualizaciones"><UpdatePrompt /></Safe>
      </SecurityGate>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
