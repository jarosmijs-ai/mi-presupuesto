import React from 'react';
import ReactDOM from 'react-dom/client';

import GodApp from './GodApp.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import ComponentBoundary from './ComponentBoundary.jsx';
import UpdatePrompt from './UpdatePrompt.jsx';
import AdvancedFinanceHub from './AdvancedFinanceHub.jsx';
import ProductCenter from './ProductCenter.jsx';
import SecurityGate from './SecurityGate.jsx';
import FinancialDataBridge from './FinancialDataBridge.jsx';
import AutoCloudSync from './AutoCloudSync.jsx';
import FinancialIntegrityLayer from './FinancialIntegrityLayer.jsx';
import RecurringPaymentNormalizer from './RecurringPaymentNormalizer.jsx';

import './styles.css';
import './premium.css';
import './advanced-finance.css';
import './product.css';
import './visual-polish.css';
import './primary-biometric.css';
import './financial-integrity.css';
import './god.css';

import { registerServiceWorker } from './registerServiceWorker';

const Safe = ({ name, children }) => (
  <ComponentBoundary name={name}>{children}</ComponentBoundary>
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityGate>
        <Safe name="Integridad financiera"><FinancialIntegrityLayer /></Safe>
        <Safe name="Normalización de pagos"><RecurringPaymentNormalizer /></Safe>
        <Safe name="Puente de datos"><FinancialDataBridge /></Safe>
        <Safe name="Sincronización automática"><AutoCloudSync /></Safe>

        <ComponentBoundary name="Mi Presupuesto" fallback={null}>
          <GodApp />
        </ComponentBoundary>

        <Safe name="Plan y metas"><AdvancedFinanceHub /></Safe>
        <Safe name="Ajustes y reportes"><ProductCenter /></Safe>
        <Safe name="Actualizaciones"><UpdatePrompt /></Safe>
      </SecurityGate>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
