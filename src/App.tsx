import React, { useState, useEffect, useMemo } from 'react';
import type { Expense, InflationSettings } from './types/finance';
import {
  loadExpenses,
  saveExpenses,
  loadInflationSettings,
  saveInflationSettings,
} from './utils/storage';
import {
  computeCumulativePriceIndices,
  calculatePeriodSummary,
  normalizeCategoryName,
} from './utils/financeCalculations';
import { getThisMonthRange } from './utils/dateUtils';
import { useOnlineStatus } from './hooks/useOnlineStatus';

import { SummaryCards } from './components/SummaryCards';
import { PieChart } from './components/PieChart';
import type { PieChartItem } from './components/PieChart';
import { PeriodComparator } from './components/PeriodComparator';
import { ExpenseList } from './components/ExpenseList';
import { SettingsView } from './components/SettingsView';
import { AddExpenseModal } from './components/AddExpenseModal';

import {
  Plus,
  Home,
  Scale,
  Settings,
  Download,
  ArrowLeft,
} from 'lucide-react';

const TAB_STORAGE_KEY = 'finanzas_active_tab_v1';

export const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  const [inflationSettings, setInflationSettings] = useState<InflationSettings>(() => loadInflationSettings());
  
  // Recordar la última pestaña activa para que nunca se reinicie al volver de otra app
  const [activeTab, setActiveTab] = useState<'home' | 'compare' | 'settings'>(() => {
    try {
      const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
      return (saved === 'compare' || saved === 'settings') ? saved : 'home';
    } catch {
      return 'home';
    }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { isInstallable, promptInstall } = useOnlineStatus();

  // Guardar pestaña en sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  // Manejar el botón "Atrás" del navegador / celular (History API)
  useEffect(() => {
    const handlePopState = () => {
      if (isAddModalOpen) {
        setIsAddModalOpen(false);
      } else if (activeTab !== 'home') {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAddModalOpen, activeTab]);

  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    saveInflationSettings(inflationSettings);
  }, [inflationSettings]);

  const indices = useMemo(() => {
    const expenseMonths = expenses.map(e => {
      const d = new Date(e.timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    return computeCumulativePriceIndices(inflationSettings.rates, expenseMonths);
  }, [inflationSettings.rates, expenses]);

  const handleAddExpense = (newExpense: Expense) => {
    const normalizedExpense: Expense = {
      ...newExpense,
      category: normalizeCategoryName(newExpense.category),
      amount: Math.round(newExpense.amount),
    };
    setExpenses(prev => [normalizedExpense, ...prev]);
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  };

  const handleRestoreData = (newExpenses: Expense[], newSettings: InflationSettings) => {
    setExpenses(newExpenses);
    setInflationSettings(newSettings);
  };

  const handleClearData = () => {
    setExpenses([]);
    setInflationSettings({
      rates: {},
      baseMonthKey: new Date().toISOString().slice(0, 7),
      enabled: false,
    });
  };

  const navigateToTab = (tab: 'home' | 'compare' | 'settings') => {
    if (tab !== activeTab) {
      window.history.pushState({ tab }, '');
      setActiveTab(tab);
    }
  };

  // Resumen del mes actual para el gráfico de torta
  const thisMonthRange = getThisMonthRange();
  const currentMonthSummary = useMemo(() => {
    return calculatePeriodSummary(
      expenses,
      'Mes Actual',
      thisMonthRange.start,
      thisMonthRange.end,
      inflationSettings,
      indices
    );
  }, [expenses, thisMonthRange.start, thisMonthRange.end, inflationSettings, indices]);

  const pieChartData: PieChartItem[] = useMemo(() => {
    return currentMonthSummary.categoryBreakdown.map(item => ({
      label: item.category,
      value: inflationSettings.enabled ? item.constant : item.nominal,
      percentage: item.percentage,
      color: item.color,
    }));
  }, [currentMonthSummary, inflationSettings.enabled]);

  return (
    <div className="app-responsive-shell">
      {/* BARRA SUPERIOR ADAPTABLE (PC Y CELULAR) */}
      <header className="app-top-header">
        <div className="header-content-inner">
          <div className="header-left">
            {/* Botón Volver cuando no está en Inicio */}
            {activeTab !== 'home' ? (
              <button
                className="btn-back-header"
                onClick={() => setActiveTab('home')}
                aria-label="Volver al inicio"
              >
                <ArrowLeft size={20} />
                <span>Volver</span>
              </button>
            ) : (
              <div className="brand-badge-box">
                <div className="app-logo-icon">$</div>
                <h1 className="app-main-title">Gastos del Hogar</h1>
              </div>
            )}
          </div>

          {/* Navegación para pantallas de escritorio (PC) */}
          <nav className="desktop-nav-tabs">
            <button
              className={`desktop-tab-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => navigateToTab('home')}
            >
              <Home size={18} />
              <span>Inicio</span>
            </button>
            <button
              className={`desktop-tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
              onClick={() => navigateToTab('compare')}
            >
              <Scale size={18} />
              <span>Comparar</span>
            </button>
            <button
              className={`desktop-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => navigateToTab('settings')}
            >
              <Settings size={18} />
              <span>Ajustes</span>
            </button>
          </nav>

          <div className="header-right">
            {isInstallable && (
              <button className="btn-install-header" onClick={promptInstall} title="Instalar en la pantalla de inicio">
                <Download size={17} />
                <span className="desktop-only-text">Instalar</span>
              </button>
            )}

            {/* Acceso directo a ajustes en celular */}
            <button
              className={`btn-settings-header ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => navigateToTab(activeTab === 'settings' ? 'home' : 'settings')}
              aria-label="Ajustes"
              title="Ajustes e Inflación"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA DE CONTENIDO PRINCIPAL ADAPTABLE */}
      <main className="app-main-viewport">
        {/* PESTAÑA 1: INICIO (ADAPTABLE MOBILE Y PC) */}
        {activeTab === 'home' && (
          <div className="tab-pane animate-fade-in">
            {/* En PC se organiza en layout de 2 columnas balanceadas; en móvil en 1 columna */}
            <div className="dashboard-responsive-grid">
              {/* Columna Izquierda / Principal */}
              <div className="dashboard-col-main">
                {/* Botón Gigante para Anotar Gasto */}
                <button
                  className="btn-hero-anotar"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  <Plus size={26} strokeWidth={2.6} />
                  <span>+ Anotar Gasto</span>
                </button>

                {/* Resúmenes: Hoy, Esta Semana, Este Mes */}
                <SummaryCards
                  expenses={expenses}
                  settings={inflationSettings}
                  indices={indices}
                  onSelectPeriodComparison={() => navigateToTab('compare')}
                />

                {/* Lista de Últimos Gastos */}
                <ExpenseList
                  expenses={expenses}
                  settings={inflationSettings}
                  indices={indices}
                  onDeleteExpense={handleDeleteExpense}
                />
              </div>

              {/* Columna Derecha: Gráfico de Torta / Dona */}
              <div className="dashboard-col-chart">
                <PieChart
                  data={pieChartData}
                  title="En qué se fue la plata este mes"
                />
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: COMPARAR */}
        {activeTab === 'compare' && (
          <div className="tab-pane animate-fade-in">
            <div className="subview-centered-container">
              <PeriodComparator
                expenses={expenses}
                settings={inflationSettings}
                indices={indices}
              />
            </div>
          </div>
        )}

        {/* PESTAÑA 3: AJUSTES */}
        {activeTab === 'settings' && (
          <div className="tab-pane animate-fade-in">
            <div className="subview-centered-container">
              <SettingsView
                expenses={expenses}
                settings={inflationSettings}
                indices={indices}
                onUpdateSettings={setInflationSettings}
                onRestoreData={handleRestoreData}
                onClearData={handleClearData}
              />
            </div>
          </div>
        )}
      </main>

      {/* BARRA INFERIOR DE NAVEGACIÓN (VISIBLE SÓLO EN CELULARES) */}
      <nav className="mobile-bottom-nav">
        <button
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => navigateToTab('home')}
        >
          <Home size={22} />
          <span>Inicio</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'compare' ? 'active' : ''}`}
          onClick={() => navigateToTab('compare')}
        >
          <Scale size={22} />
          <span>Comparar</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => navigateToTab('settings')}
        >
          <Settings size={22} />
          <span>Ajustes</span>
        </button>
      </nav>

      {/* MODAL PARA AGREGAR GASTO */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddExpense={handleAddExpense}
        allExpenses={expenses}
      />
    </div>
  );
};

export default App;
