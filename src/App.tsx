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
  getMonthKey,
} from './utils/financeCalculations';
import { getThisMonthRange } from './utils/dateUtils';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import {
  getSyncConfig,
  saveSyncConfig,
  executeSync,
  recordDeletedExpense,
  getDeletedExpensesQueue,
} from './utils/syncManager';

import { SummaryCards } from './components/SummaryCards';
import { PieChart } from './components/PieChart';
import type { PieChartItem } from './components/PieChart';
import { PeriodComparator } from './components/PeriodComparator';
import { ExpenseList } from './components/ExpenseList';
import { SettingsView } from './components/SettingsView';
import { AddExpenseModal } from './components/AddExpenseModal';
import { ConfirmModal } from './components/ConfirmModal';

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
  const inflationSettingsRef = useRef<InflationSettings>(inflationSettings);
  
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
  const [comparePreset, setComparePreset] = useState<'month' | 'week' | 'day'>('month');

  // Sincronización en la nube (Cloudflare D1)
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => getSyncConfig());
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string>('');
  const syncDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isStandalone,
    showInstallGuide,
    setShowInstallGuide,
    promptInstall,
  } = useOnlineStatus();

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
        const pendingDeletes = new Set(getDeletedExpensesQueue().map((d) => d.id));
        const liveMap = new Map(expensesRef.current.map((e) => [e.id, e]));
        const finalMap = new Map<string, Expense>();

        for (const exp of result.updatedExpenses) {
          if (pendingDeletes.has(exp.id)) continue;
          const live = liveMap.get(exp.id);
          if (live && (live.updatedAt || 0) > (exp.updatedAt || 0)) {
            finalMap.set(exp.id, live);
          } else {
            finalMap.set(exp.id, exp);
          }
        }

        for (const live of expensesRef.current) {
          if (!pendingDeletes.has(live.id) && !finalMap.has(live.id)) {
            finalMap.set(live.id, live);
          }
        }

        const reconciled = Array.from(finalMap.values()).sort((a, b) => {
          const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          if (timeDiff !== 0) return timeDiff;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        expensesRef.current = reconciled;
        setExpenses(reconciled);
        saveExpenses(reconciled);
      }
      if (result.updatedSettings) {
        const liveSettings = inflationSettingsRef.current;
        if ((result.updatedSettings.updatedAt || 0) >= (liveSettings.updatedAt || 0)) {
          inflationSettingsRef.current = result.updatedSettings;
          setInflationSettings(result.updatedSettings);
          saveInflationSettings(result.updatedSettings);
        }
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
    let initTimer: ReturnType<typeof setTimeout> | null = null;
    const currentCfg = getSyncConfig();
    if (currentCfg.householdId.trim().length >= 3) {
      initTimer = setTimeout(() => {
        runSync(currentCfg);
      }, 0);
    }

    const handleOnline = () => {
      const cfg = getSyncConfig();
      if (cfg.householdId.trim().length >= 3) {
        runSync(cfg);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      if (initTimer) clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
    };
  }, [runSync]);

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
    expensesRef.current = expenses;
    saveExpenses(expenses);
  }, [expenses]);

  useEffect(() => {
    inflationSettingsRef.current = inflationSettings;
    saveInflationSettings(inflationSettings);
  }, [inflationSettings]);

  const indices = useMemo(() => {
    const expenseMonths = expenses.map(e => {
      const d = new Date(e.timestamp);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    return computeCumulativePriceIndices(
      inflationSettings.rates,
      [...expenseMonths, inflationSettings.baseMonthKey]
    );
  }, [inflationSettings.rates, inflationSettings.baseMonthKey, expenses]);

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
      baseMonthKey: getMonthKey(new Date()),
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
            {!isStandalone && (
              <button
                type="button"
                className="btn-install-header"
                onClick={promptInstall}
                aria-label="Instalar aplicación"
                title="Instalar en la pantalla de inicio"
              >
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
                  <span>Anotar Gasto</span>
                </button>

                <SummaryCards
                  expenses={expenses}
                  settings={inflationSettings}
                  indices={indices}
                  onSelectPeriodComparison={(period) => {
                    setComparePreset(period);
                    navigateToTab('compare');
                  }}
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
                key={comparePreset}
                expenses={expenses}
                settings={inflationSettings}
                indices={indices}
                initialPreset={comparePreset}
              />
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-pane animate-fade-in">
            <div className="subview-centered-container">
              <SettingsView
                key={`${syncConfig.householdId}-${syncConfig.apiUrl}`}
                expenses={expenses}
                settings={inflationSettings}
                indices={indices}
                onUpdateSettings={(newSettings) => {
                  const stamped = { ...newSettings, updatedAt: Date.now() };
                  inflationSettingsRef.current = stamped;
                  setInflationSettings(stamped);
                  saveInflationSettings(stamped);
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
      {isAddModalOpen && (
        <AddExpenseModal
          key={expenseToEdit ? `edit-${expenseToEdit.id}` : 'create-new'}
          isOpen={isAddModalOpen}
          expenseToEdit={expenseToEdit}
          onClose={() => {
            setIsAddModalOpen(false);
            setExpenseToEdit(null);
          }}
          onSaveExpense={handleSaveExpense}
          allExpenses={expenses}
        />
      )}

      {/* GUÍA RÁPIDA DE INSTALACIÓN PWA SI EL NAVEGADOR NO DISPARA PROMPT AUTOMÁTICO */}
      <ConfirmModal
        isOpen={showInstallGuide}
        title="Instalar en tu teléfono"
        message="En Android (Chrome): toca el menú ⋮ arriba a la derecha y elige «Instalar aplicación» o «Agregar a la pantalla principal». En iPhone (Safari): toca Compartir y elige «Agregar a inicio»."
        confirmLabel="Entendido"
        cancelLabel="Cerrar"
        isDestructive={false}
        onConfirm={() => setShowInstallGuide(false)}
        onCancel={() => setShowInstallGuide(false)}
      />
    </div>
  );
};

export default App;
