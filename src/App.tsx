import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Expense, InflationSettings, SyncConfig, SyncState } from './types/finance';
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
import {
  getSyncConfig,
  saveSyncConfig,
  executeSync,
  recordDeletedExpense,
} from './utils/syncManager';

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

  const expensesRef = useRef<Expense[]>(expenses);
  expensesRef.current = expenses;

  const inflationSettingsRef = useRef<InflationSettings>(inflationSettings);
  inflationSettingsRef.current = inflationSettings;
  
  const [activeTab, setActiveTab] = useState<'home' | 'compare' | 'settings'>(() => {
    try {
      const saved = sessionStorage.getItem(TAB_STORAGE_KEY);
      return (saved === 'compare' || saved === 'settings') ? saved : 'home';
    } catch {
      return 'home';
    }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);

  // Sincronización en la nube (Cloudflare D1)
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => getSyncConfig());
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const syncDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isInstallable, promptInstall } = useOnlineStatus();

  // Función de sincronización bidireccional silenciosa
  const runSync = useCallback(async (customConfig?: SyncConfig, customExpenses?: Expense[]) => {
    const cfg = customConfig || getSyncConfig();
    if (!cfg.householdId.trim()) {
      setSyncState('idle');
      return;
    }

    const expsToSync = customExpenses || expensesRef.current;
    const inflToSync = inflationSettingsRef.current;

    const result = await executeSync(expsToSync, inflToSync, (state, msg) => {
      setSyncState(state);
      if (msg) setSyncMessage(msg);
    });

    if (result.success) {
      if (result.updatedExpenses) {
        // SEGURIDAD CRÍTICA: Nunca permitir que una respuesta vacía del servidor borre gastos locales
        const safeExpenses = (result.updatedExpenses.length > 0 || expsToSync.length === 0)
          ? result.updatedExpenses
          : expsToSync;

        expensesRef.current = safeExpenses;
        setExpenses(safeExpenses);
        saveExpenses(safeExpenses);
      }
      if (result.updatedSettings) {
        inflationSettingsRef.current = result.updatedSettings;
        setInflationSettings(result.updatedSettings);
        saveInflationSettings(result.updatedSettings);
      }
      setSyncConfig(getSyncConfig());
    }
  }, []);

  // Ejecución retardada para no saturar la red al escribir o editar
  const triggerDebouncedSync = useCallback((customExpenses?: Expense[]) => {
    const cfg = getSyncConfig();
    if (!cfg.householdId.trim()) return;
    if (syncDebounceTimer.current) clearTimeout(syncDebounceTimer.current);
    syncDebounceTimer.current = setTimeout(() => {
      runSync(cfg, customExpenses || expensesRef.current);
    }, 1200);
  }, [runSync]);

  // Sincronización inicial al montar o al recuperar señal de internet
  useEffect(() => {
    // Purgar de inmediato cualquier gasto de demo residual del estado en memoria
    const demoItems = expenses.filter(e => typeof e.id === 'string' && e.id.startsWith('demo-'));
    if (demoItems.length > 0) {
      demoItems.forEach(e => recordDeletedExpense(e.id));
      const cleanList = expenses.filter(e => !(typeof e.id === 'string' && e.id.startsWith('demo-')));
      setExpenses(cleanList);
      saveExpenses(cleanList);

      if (cleanList.length === 0) {
        const cleanInf: InflationSettings = {
          rates: {},
          baseMonthKey: new Date().toISOString().slice(0, 7),
          enabled: false,
          updatedAt: Date.now(),
        };
        setInflationSettings(cleanInf);
        saveInflationSettings(cleanInf);
      }
      triggerDebouncedSync();
    }

    const currentCfg = getSyncConfig();
    if (currentCfg.householdId.trim().length >= 3) {
      runSync(currentCfg);
    }

    const handleOnline = () => {
      const cfg = getSyncConfig();
      if (cfg.householdId.trim().length >= 3) {
        runSync(cfg);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []); // Se ejecuta únicamente una vez al montar, NUNCA en cada pulsación de tecla

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    const handlePopState = () => {
      // La tarjeta de gasto NO se cierra por popstate ni backspace
      if (activeTab !== 'home') {
        setActiveTab('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeTab]);

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

  // Manejador unificado para crear o editar gasto
  const handleSaveExpense = (savedExpense: Expense) => {
    const now = Date.now();
    const normalized: Expense = {
      ...savedExpense,
      category: normalizeCategoryName(savedExpense.category),
      amount: Math.round(savedExpense.amount),
      updatedAt: now,
    };

    let nextExpenses: Expense[];
    if (expenseToEdit) {
      // Edición: actualizar el elemento existente
      nextExpenses = expensesRef.current.map(e => e.id === normalized.id ? normalized : e);
      setExpenseToEdit(null);
    } else {
      // Creación: agregar arriba
      nextExpenses = [normalized, ...expensesRef.current];
    }

    // Persistencia síncrona inmediata en Ref, Estado y LocalStorage
    expensesRef.current = nextExpenses;
    setExpenses(nextExpenses);
    saveExpenses(nextExpenses);

    triggerDebouncedSync(nextExpenses);
  };

  const handleOpenEdit = (expense: Expense) => {
    setExpenseToEdit(expense);
    setIsAddModalOpen(true);
  };

  const handleDeleteExpense = (id: string) => {
    recordDeletedExpense(id);
    const nextExpenses = expensesRef.current.filter(e => e.id !== id);
    expensesRef.current = nextExpenses;
    setExpenses(nextExpenses);
    saveExpenses(nextExpenses);
    triggerDebouncedSync(nextExpenses);
  };

  const handleRestoreData = (newExpenses: Expense[], newSettings: InflationSettings) => {
    expensesRef.current = newExpenses;
    inflationSettingsRef.current = newSettings;
    setExpenses(newExpenses);
    setInflationSettings(newSettings);
    saveExpenses(newExpenses);
    saveInflationSettings(newSettings);
    triggerDebouncedSync(newExpenses);
  };

  const handleClearData = () => {
    // 1. Encolar todos los IDs actuales como eliminados para que Cloudflare D1 los borre de la nube
    expensesRef.current.forEach(e => {
      if (e.id) recordDeletedExpense(e.id);
    });

    const cleanInf: InflationSettings = {
      rates: {},
      baseMonthKey: new Date().toISOString().slice(0, 7),
      enabled: false,
      updatedAt: Date.now(),
    };

    expensesRef.current = [];
    inflationSettingsRef.current = cleanInf;
    setExpenses([]);
    setInflationSettings(cleanInf);
    saveExpenses([]);
    saveInflationSettings(cleanInf);
    triggerDebouncedSync([]);
  };

  const navigateToTab = (tab: 'home' | 'compare' | 'settings') => {
    if (tab !== activeTab) {
      window.history.pushState({ tab }, '');
      setActiveTab(tab);
    }
  };

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
      {/* BARRA SUPERIOR ADAPTABLE */}
      <header className="app-top-header">
        <div className="header-content-inner">
          <div className="header-left">
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

      {/* ÁREA DE CONTENIDO */}
      <main className="app-main-viewport">
        {activeTab === 'home' && (
          <div className="tab-pane animate-fade-in">
            <div className="dashboard-responsive-grid">
              <div className="dashboard-col-main">
                <button
                  className="btn-hero-anotar"
                  onClick={() => {
                    setExpenseToEdit(null);
                    setIsAddModalOpen(true);
                  }}
                >
                  <Plus size={26} strokeWidth={2.6} />
                  <span>+ Anotar Gasto</span>
                </button>

                <SummaryCards
                  expenses={expenses}
                  settings={inflationSettings}
                  indices={indices}
                  onSelectPeriodComparison={() => navigateToTab('compare')}
                />

                <ExpenseList
                  expenses={expenses}
                  settings={inflationSettings}
                  indices={indices}
                  onEditExpense={handleOpenEdit}
                  onDeleteExpense={handleDeleteExpense}
                />
              </div>

              <div className="dashboard-col-chart">
                <PieChart
                  data={pieChartData}
                  title="En qué se fue la plata este mes"
                />
              </div>
            </div>
          </div>
        )}

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

        {activeTab === 'settings' && (
          <div className="tab-pane animate-fade-in">
            <div className="subview-centered-container">
              <SettingsView
                expenses={expenses}
                settings={inflationSettings}
                indices={indices}
                onUpdateSettings={(newSettings) => {
                  setInflationSettings(newSettings);
                  triggerDebouncedSync();
                }}
                onRestoreData={handleRestoreData}
                onClearData={handleClearData}
                syncConfig={syncConfig}
                syncState={syncState}
                syncMessage={syncMessage}
                onUpdateSyncConfig={(newConfig) => {
                  setSyncConfig(newConfig);
                  saveSyncConfig(newConfig);
                }}
                onTriggerSync={async (customConfig) => {
                  await runSync(customConfig);
                }}
              />
            </div>
          </div>
        )}
      </main>

      {/* BARRA INFERIOR DE NAVEGACIÓN */}
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

      {/* MODAL PARA AGREGAR O EDITAR GASTO */}
      <AddExpenseModal
        isOpen={isAddModalOpen}
        expenseToEdit={expenseToEdit}
        onClose={() => {
          setIsAddModalOpen(false);
          setExpenseToEdit(null);
        }}
        onSaveExpense={handleSaveExpense}
        allExpenses={expenses}
      />
    </div>
  );
};

export default App;
