import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import UpdatePrompt from './UpdatePrompt.jsx';
import AdvancedFinanceHub from './AdvancedFinanceHub.jsx';
import ProductCenter from './ProductCenter.jsx';
import SecurityGate from './SecurityGate.jsx';
import './styles.css';
import './premium.css';
import './advanced-finance.css';
import './product.css';

import { registerServiceWorker } from './registerServiceWorker';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SecurityGate>
        <App />
        <AdvancedFinanceHub />
        <ProductCenter />
        <UpdatePrompt />
      </SecurityGate>
    </ErrorBoundary>
  </React.StrictMode>
);

registerServiceWorker();
