import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
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

import { registerServiceWorker } from './registerServiceWorker';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityGate>
        <App />
        <AdvancedFinanceHub />
        <ProductCenter />
        <UXConsolidation />
        <IncomeAverageCard />
        <HistoryBaselineGuard />
        <FinancialInsightsDashboard />
        <IncomeUsageCard />
        <LoanSafetyAdvisor />
        <UpdatePrompt />
      </SecurityGate>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
