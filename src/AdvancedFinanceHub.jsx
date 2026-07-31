import React, { useEffect, useMemo, useState } from 'react';

const KEYS = {
  recurring: 'premium-recurring-expenses',
  goals: 'premium-savings-goals',
  onboarding: 'premium-onboarding-complete',
  expenses: 'expenses',
  incomes: 'incomes'
};

const currency = new Intl.NumberFormat('es-GT', {
  style: 'currency',
  currency: 'GTQ',
  maximumFractionDigits: 2
});

const categories = [
  'Gasolina',
  'Teléfono',
  'Luz',
  'Internet',
  'Comidas',
  'Préstamo',
  'Otros'
];

function safeLoad(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function safeSave(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function dateForDay(day) {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(Math.max(Number(day) || 1, 1), lastDay);
  return `${currentMonthKey()}-${String(safeDay).padStart(2, '0')}`;
}

function normalizeText(value) {
  return String(value || '').trim().toLocaleLowerCase('es');
}

function getTransactions() {
  const expenses = safeLoad(KEYS.expenses, []).map((item) => ({
    ...item,
    type: 'expense',
    searchable: `${item.category || ''} ${item.note || ''}`
  }));

  const incomes = safeLoad(KEYS.incomes, []).map((item) => ({
    ...item,
    type: 'income',
    searchable: `${item.source || item.description || item.note || 'Ingreso'}`
  }));

  return [...expenses, ...incomes].sort((a, b) =>
    String(b.date || '').localeCompare(String(a.date || ''))
  );
}

function EmptyState({ title, copy }) {
  return (
    <div className="finance-empty-state">
      <span>✦</span>
      <strong>{title}</strong>
      <p>{copy}</p>
    </div>
  );
}

export default function AdvancedFinanceHub() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showOnboarding, setShowOnboarding] = useState(
    () => localStorage.getItem(KEYS.onboarding) !== 'true'
  );
  const [recurring, setRecurring] = useState(() => safeLoad(KEYS.recurring, []));
  const [goals, setGoals] = useState(() => safeLoad(KEYS.goals, []));
  const [transactions, setTransactions] = useState(() => getTransactions());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [recurringForm, setRecurringForm] = useState({
    name: '',
    amount: '',
    day: '1',
    category: 'Otros'
  });
  const [goalForm, setGoalForm] = useState({
    name: '',
    target: '',
    saved: '',
    deadline: ''
  });

  useEffect(() => {
    const refresh = () => setTransactions(getTransactions());
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const expenseTotal = useMemo(
    () => transactions
      .filter((item) => item.type === 'expense' && String(item.date || '').startsWith(currentMonthKey()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [transactions]
  );

  const incomeTotal = useMemo(
    () => transactions
      .filter((item) => item.type === 'income' && String(item.date || '').startsWith(currentMonthKey()))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    return transactions.filter((item) => {
      const matchesQuery = !normalizedQuery || normalizeText(item.searchable).includes(normalizedQuery);
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesQuery && matchesType && matchesCategory;
    });
  }, [transactions, query, typeFilter, categoryFilter]);

  const goalTotals = useMemo(() => ({
    target: goals.reduce((sum, goal) => sum + Number(goal.target || 0), 0),
    saved: goals.reduce((sum, goal) => sum + Number(goal.saved || 0), 0)
  }), [goals]);

  function completeOnboarding() {
    localStorage.setItem(KEYS.onboarding, 'true');
    setShowOnboarding(false);
    setOpen(true);
  }

  function addRecurring(event) {
    event.preventDefault();
    const amount = Number(recurringForm.amount);
    if (!recurringForm.name.trim() || amount <= 0) return;

    const next = [...recurring, {
      id: createId(),
      name: recurringForm.name.trim(),
      amount,
      day: Number(recurringForm.day) || 1,
      category: recurringForm.category,
      active: true
    }];

    setRecurring(next);
    safeSave(KEYS.recurring, next);
    setRecurringForm({ name: '', amount: '', day: '1', category: 'Otros' });
  }

  function toggleRecurring(id) {
    const next = recurring.map((item) =>
      item.id === id ? { ...item, active: !item.active } : item
    );
    setRecurring(next);
    safeSave(KEYS.recurring, next);
  }

  function removeRecurring(id) {
    if (!window.confirm('¿Eliminar este gasto recurrente?')) return;
    const next = recurring.filter((item) => item.id !== id);
    setRecurring(next);
    safeSave(KEYS.recurring, next);
  }

  function applyRecurring() {
    const month = currentMonthKey();
    const expenses = safeLoad(KEYS.expenses, []);
    const existingKeys = new Set(
      expenses
        .filter((item) => String(item.date || '').startsWith(month))
        .map((item) => item.recurringId)
        .filter(Boolean)
    );

    const pending = recurring
      .filter((item) => item.active && !existingKeys.has(item.id))
      .map((item) => ({
        id: createId(),
        recurringId: item.id,
        category: item.category,
        amount: Number(item.amount),
        date: dateForDay(item.day),
        note: `${item.name} · recurrente`
      }));

    if (!pending.length) {
      window.alert('Todos los gastos recurrentes activos ya están registrados este mes.');
      return;
    }

    safeSave(KEYS.expenses, [...pending, ...expenses]);
    window.alert(`${pending.length} gasto${pending.length === 1 ? '' : 's'} recurrente${pending.length === 1 ? '' : 's'} agregado${pending.length === 1 ? '' : 's'}.`);
    window.location.reload();
  }

  function addGoal(event) {
    event.preventDefault();
    const target = Number(goalForm.target);
    const saved = Number(goalForm.saved || 0);
    if (!goalForm.name.trim() || target <= 0) return;

    const next = [...goals, {
      id: createId(),
      name: goalForm.name.trim(),
      target,
      saved: Math.max(0, saved),
      deadline: goalForm.deadline
    }];

    setGoals(next);
    safeSave(KEYS.goals, next);
    setGoalForm({ name: '', target: '', saved: '', deadline: '' });
  }

  function addToGoal(goal) {
    const input = window.prompt(`¿Cuánto deseas agregar a “${goal.name}”?`, '100');
    if (input === null) return;
    const amount = Number(input);
    if (!amount || amount <= 0) return;

    const next = goals.map((item) =>
      item.id === goal.id
        ? { ...item, saved: Number(item.saved || 0) + amount }
        : item
    );
    setGoals(next);
    safeSave(KEYS.goals, next);
  }

  function removeGoal(id) {
    if (!window.confirm('¿Eliminar esta meta de ahorro?')) return;
    const next = goals.filter((goal) => goal.id !== id);
    setGoals(next);
    safeSave(KEYS.goals, next);
  }

  function openHub(tab = 'overview') {
    setActiveTab(tab);
    setTransactions(getTransactions());
    setOpen(true);
  }

  const overallGoalProgress = goalTotals.target
    ? Math.min(100, Math.round((goalTotals.saved / goalTotals.target) * 100))
    : 0;

  return (
    <>
      <button
        type="button"
        className="finance-hub-fab"
        onClick={() => openHub('overview')}
        aria-label="Abrir herramientas avanzadas"
      >
        <span>✦</span>
        <strong>Plan</strong>
      </button>

      {showOnboarding && (
        <div className="finance-modal-backdrop" role="presentation">
          <section className="finance-onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
            <span className="finance-kicker">MI PRESUPUESTO PRO</span>
            <h2 id="onboarding-title">Convierte tus registros en un plan.</h2>
            <p>Automatiza pagos fijos, establece metas y encuentra movimientos en segundos.</p>
            <div className="onboarding-feature-grid">
              <article><span>↻</span><strong>Gastos recurrentes</strong><small>Regístralos cada mes sin duplicados.</small></article>
              <article><span>◎</span><strong>Metas de ahorro</strong><small>Mide tu avance con claridad.</small></article>
              <article><span>⌕</span><strong>Buscador avanzado</strong><small>Filtra ingresos y gastos.</small></article>
            </div>
            <button type="button" className="finance-primary-button" onClick={completeOnboarding}>Comenzar</button>
          </section>
        </div>
      )}

      {open && (
        <div
          className="finance-drawer-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="finance-drawer" role="dialog" aria-modal="true" aria-label="Herramientas financieras avanzadas">
            <header className="finance-drawer-header">
              <div><span className="finance-kicker">CENTRO FINANCIERO</span><h2>Plan y automatización</h2></div>
              <button type="button" className="finance-close-button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            </header>

            <nav className="finance-tabs" aria-label="Secciones avanzadas">
              {[
                ['overview', 'Resumen'],
                ['recurring', 'Recurrentes'],
                ['goals', 'Metas'],
                ['search', 'Buscar']
              ].map(([id, label]) => (
                <button key={id} type="button" className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>
              ))}
            </nav>

            <div className="finance-drawer-body">
              {activeTab === 'overview' && (
                <div className="finance-overview">
                  <div className="finance-metric-grid">
                    <article><span>Ingresos del mes</span><strong>{currency.format(incomeTotal)}</strong></article>
                    <article><span>Gastos del mes</span><strong>{currency.format(expenseTotal)}</strong></article>
                    <article><span>Balance registrado</span><strong className={incomeTotal - expenseTotal < 0 ? 'negative' : ''}>{currency.format(incomeTotal - expenseTotal)}</strong></article>
                    <article><span>Ahorro en metas</span><strong>{currency.format(goalTotals.saved)}</strong></article>
                  </div>

                  <section className="finance-insight-card">
                    <span className="finance-kicker">SIGUIENTE MEJOR ACCIÓN</span>
                    <h3>{recurring.length ? 'Registra tus pagos fijos del mes' : 'Configura tus primeros gastos recurrentes'}</h3>
                    <p>{recurring.length ? 'La app evita duplicados y conserva la fecha y categoría de cada pago.' : 'Agrega internet, teléfono, préstamo y otros pagos que se repiten.'}</p>
                    <button type="button" className="finance-primary-button" onClick={() => setActiveTab('recurring')}>{recurring.length ? 'Revisar recurrentes' : 'Crear recurrente'}</button>
                  </section>

                  <section className="finance-progress-summary">
                    <div><span>Progreso total de metas</span><strong>{overallGoalProgress}%</strong></div>
                    <div className="finance-progress-track"><span style={{ width: `${overallGoalProgress}%` }} /></div>
                    <small>{currency.format(goalTotals.saved)} de {currency.format(goalTotals.target)}</small>
                  </section>
                </div>
              )}

              {activeTab === 'recurring' && (
                <div className="finance-section-stack">
                  <form className="finance-form" onSubmit={addRecurring}>
                    <div className="finance-section-heading"><div><span className="finance-kicker">AUTOMATIZACIÓN</span><h3>Nuevo gasto recurrente</h3></div></div>
                    <label>Nombre<input value={recurringForm.name} onChange={(event) => setRecurringForm({ ...recurringForm, name: event.target.value })} placeholder="Ej. Internet" required /></label>
                    <div className="finance-form-row">
                      <label>Monto<input type="number" min="0.01" step="0.01" value={recurringForm.amount} onChange={(event) => setRecurringForm({ ...recurringForm, amount: event.target.value })} placeholder="Q 0.00" required /></label>
                      <label>Día<input type="number" min="1" max="31" value={recurringForm.day} onChange={(event) => setRecurringForm({ ...recurringForm, day: event.target.value })} required /></label>
                    </div>
                    <label>Categoría<select value={recurringForm.category} onChange={(event) => setRecurringForm({ ...recurringForm, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
                    <button className="finance-primary-button" type="submit">Guardar recurrente</button>
                  </form>

                  {!!recurring.length && <button type="button" className="finance-apply-button" onClick={applyRecurring}>↻ Registrar activos en este mes</button>}

                  <div className="finance-list">
                    {recurring.map((item) => (
                      <article className="finance-list-item" key={item.id}>
                        <div className="finance-list-icon">↻</div>
                        <div className="finance-list-copy"><strong>{item.name}</strong><small>{item.category} · día {item.day}</small></div>
                        <div className="finance-list-value"><strong>{currency.format(item.amount)}</strong><button type="button" onClick={() => toggleRecurring(item.id)}>{item.active ? 'Activo' : 'Pausado'}</button></div>
                        <button type="button" className="finance-delete-button" onClick={() => removeRecurring(item.id)} aria-label={`Eliminar ${item.name}`}>×</button>
                      </article>
                    ))}
                    {!recurring.length && <EmptyState title="Sin gastos recurrentes" copy="Agrega tus pagos fijos para registrarlos cada mes con un toque." />}
                  </div>
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="finance-section-stack">
                  <form className="finance-form" onSubmit={addGoal}>
                    <div className="finance-section-heading"><div><span className="finance-kicker">OBJETIVOS</span><h3>Nueva meta de ahorro</h3></div></div>
                    <label>Nombre<input value={goalForm.name} onChange={(event) => setGoalForm({ ...goalForm, name: event.target.value })} placeholder="Ej. Fondo de emergencia" required /></label>
                    <div className="finance-form-row">
                      <label>Meta<input type="number" min="1" step="0.01" value={goalForm.target} onChange={(event) => setGoalForm({ ...goalForm, target: event.target.value })} required /></label>
                      <label>Ahorrado<input type="number" min="0" step="0.01" value={goalForm.saved} onChange={(event) => setGoalForm({ ...goalForm, saved: event.target.value })} /></label>
                    </div>
                    <label>Fecha objetivo<input type="date" value={goalForm.deadline} onChange={(event) => setGoalForm({ ...goalForm, deadline: event.target.value })} /></label>
                    <button className="finance-primary-button" type="submit">Crear meta</button>
                  </form>

                  <div className="finance-goal-grid">
                    {goals.map((goal) => {
                      const percentage = Math.min(100, Math.round((Number(goal.saved || 0) / Number(goal.target || 1)) * 100));
                      return (
                        <article className="finance-goal-card" key={goal.id}>
                          <div className="finance-goal-top"><div><small>{goal.deadline ? `Meta: ${goal.deadline}` : 'Sin fecha límite'}</small><h3>{goal.name}</h3></div><strong>{percentage}%</strong></div>
                          <div className="finance-progress-track"><span style={{ width: `${percentage}%` }} /></div>
                          <p>{currency.format(goal.saved)} de {currency.format(goal.target)}</p>
                          <div className="finance-goal-actions"><button type="button" onClick={() => addToGoal(goal)}>＋ Agregar ahorro</button><button type="button" onClick={() => removeGoal(goal.id)}>Eliminar</button></div>
                        </article>
                      );
                    })}
                    {!goals.length && <EmptyState title="Sin metas todavía" copy="Define algo concreto: emergencia, viaje, enganche o pago de deuda." />}
                  </div>
                </div>
              )}

              {activeTab === 'search' && (
                <div className="finance-section-stack">
                  <div className="finance-search-panel">
                    <label className="finance-search-input">⌕<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por categoría o nota" /></label>
                    <div className="finance-filter-row">
                      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option></select>
                      <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">Todas las categorías</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
                    </div>
                    <small>{filteredTransactions.length} movimiento{filteredTransactions.length === 1 ? '' : 's'} encontrado{filteredTransactions.length === 1 ? '' : 's'}</small>
                  </div>

                  <div className="finance-list">
                    {filteredTransactions.slice(0, 100).map((item) => (
                      <article className="finance-list-item" key={`${item.type}-${item.id}`}>
                        <div className={`finance-list-icon ${item.type}`}>{item.type === 'income' ? '↑' : '↓'}</div>
                        <div className="finance-list-copy"><strong>{item.type === 'income' ? (item.source || item.description || 'Ingreso') : (item.category || 'Gasto')}</strong><small>{item.note || item.date || 'Sin detalle'}{item.note && item.date ? ` · ${item.date}` : ''}</small></div>
                        <div className="finance-list-value"><strong className={item.type === 'expense' ? 'negative' : ''}>{item.type === 'expense' ? '−' : '+'}{currency.format(item.amount || 0)}</strong></div>
                      </article>
                    ))}
                    {!filteredTransactions.length && <EmptyState title="Sin resultados" copy="Prueba otra palabra o cambia los filtros." />}
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
