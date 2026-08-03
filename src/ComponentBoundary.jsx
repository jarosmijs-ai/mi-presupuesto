import React from 'react';

export default class ComponentBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const name = this.props.name || 'Componente';
    console.error(`${name} fue desactivado para proteger la aplicación:`, error, info);
    try {
      const previous = JSON.parse(localStorage.getItem('app-component-errors') || '[]');
      const next = Array.isArray(previous) ? previous.slice(-9) : [];
      next.push({
        name,
        message: error?.message || String(error),
        time: new Date().toISOString()
      });
      localStorage.setItem('app-component-errors', JSON.stringify(next));
    } catch {
      // Nunca bloquear la aplicación por el registro de diagnóstico.
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}
