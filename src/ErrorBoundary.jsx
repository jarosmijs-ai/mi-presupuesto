import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Error no controlado en Mi Presupuesto:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="app-crash-screen" role="alert">
        <div className="app-crash-card">
          <span className="app-crash-icon">
            <AlertTriangle size={28} />
          </span>
          <span className="eyebrow">RECUPERACIÓN SEGURA</span>
          <h1>La aplicación necesita reiniciarse</h1>
          <p>
            Tus datos permanecen guardados en este dispositivo. Recarga la
            aplicación para continuar.
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={18} />
            Recargar aplicación
          </button>
        </div>
      </main>
    );
  }
}
