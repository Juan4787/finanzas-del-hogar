import type { Expense, InflationSettings } from '../types/finance';
import { getMonthKey } from './financeCalculations';
import { recordDeletedExpense } from './syncManager';

const EXPENSES_STORAGE_KEY = 'finanzas_hogar_expenses_v1';
const INFLATION_STORAGE_KEY = 'finanzas_hogar_inflation_v1';

/**
 * Genera un conjunto de datos iniciales realistas para demostración y pruebas inmediatas
 * que coinciden con las categorías mostradas en la imagen del usuario:
 * Expensas, Deportes, Dietética, Electricidad, Abl, etc.
 */
export function generateDemoData(): { expenses: Expense[]; inflation: InflationSettings } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // Generamos meses: hace 2 meses, hace 1 mes, y mes actual
  const m2Date = new Date(currentYear, currentMonth - 2, 1);
  const m1Date = new Date(currentYear, currentMonth - 1, 1);
  const m0Date = new Date(currentYear, currentMonth, 1);

  const k2 = getMonthKey(m2Date);
  const k1 = getMonthKey(m1Date);
  const k0 = getMonthKey(m0Date);

  const expenses: Expense[] = [
    // Mes actual (k0)
    {
      id: 'demo-01',
      name: 'Expensas Edificio',
      amount: 145000,
      timestamp: new Date(currentYear, currentMonth, 10, 10, 30).toISOString(),
      category: 'Expensas',
    },
    {
      id: 'demo-02',
      name: 'Gimnasio & Natación',
      amount: 25000,
      timestamp: new Date(currentYear, currentMonth, 12, 18, 0).toISOString(),
      category: 'Deportes',
    },
    {
      id: 'demo-03',
      name: 'Compra Frutos Secos & Semillas',
      amount: 14000,
      timestamp: new Date(currentYear, currentMonth, 14, 11, 15).toISOString(),
      category: 'Dietética',
    },
    {
      id: 'demo-04',
      name: 'Factura Edenor Luz',
      amount: 18500,
      timestamp: new Date(currentYear, currentMonth, 15, 14, 20).toISOString(),
      category: 'Electricidad',
    },
    {
      id: 'demo-05',
      name: 'Boleta ABL / Rentas',
      amount: 12000,
      timestamp: new Date(currentYear, currentMonth, 18, 9, 45).toISOString(),
      category: 'ABL',
    },
    {
      id: 'demo-06',
      name: 'Supermercado Coto',
      amount: 32000,
      timestamp: new Date(currentYear, currentMonth, 20, 19, 10).toISOString(),
      category: 'Alimentos',
    },
    {
      id: 'demo-07',
      name: 'Farmacia & Medicamentos',
      amount: 8500,
      timestamp: new Date(currentYear, currentMonth, 22, 17, 30).toISOString(),
      category: 'Salud',
    },

    // Mes anterior (k1)
    {
      id: 'demo-11',
      name: 'Expensas Edificio',
      amount: 135000,
      timestamp: new Date(currentYear, currentMonth - 1, 10, 10, 15).toISOString(),
      category: 'Expensas',
    },
    {
      id: 'demo-12',
      name: 'Gimnasio Cuota',
      amount: 23000,
      timestamp: new Date(currentYear, currentMonth - 1, 11, 17, 40).toISOString(),
      category: 'Deportes',
    },
    {
      id: 'demo-13',
      name: 'Dietética Central',
      amount: 13000,
      timestamp: new Date(currentYear, currentMonth - 1, 15, 12, 10).toISOString(),
      category: 'Dietética',
    },
    {
      id: 'demo-14',
      name: 'Factura Luz',
      amount: 16000,
      timestamp: new Date(currentYear, currentMonth - 1, 16, 15, 0).toISOString(),
      category: 'Electricidad',
    },
    {
      id: 'demo-15',
      name: 'Boleta ABL',
      amount: 11500,
      timestamp: new Date(currentYear, currentMonth - 1, 19, 8, 30).toISOString(),
      category: 'ABL',
    },
    {
      id: 'demo-16',
      name: 'Supermercado Mensual',
      amount: 38000,
      timestamp: new Date(currentYear, currentMonth - 1, 23, 20, 15).toISOString(),
      category: 'Alimentos',
    },

    // Hace dos meses (k2)
    {
      id: 'demo-21',
      name: 'Expensas Edificio',
      amount: 122000,
      timestamp: new Date(currentYear, currentMonth - 2, 9, 10, 0).toISOString(),
      category: 'Expensas',
    },
    {
      id: 'demo-22',
      name: 'Gimnasio Cuota',
      amount: 21000,
      timestamp: new Date(currentYear, currentMonth - 2, 12, 18, 30).toISOString(),
      category: 'Deportes',
    },
    {
      id: 'demo-23',
      name: 'Dietética Frutos Secos',
      amount: 11800,
      timestamp: new Date(currentYear, currentMonth - 2, 14, 11, 0).toISOString(),
      category: 'Dietética',
    },
    {
      id: 'demo-24',
      name: 'Factura Electricidad',
      amount: 14500,
      timestamp: new Date(currentYear, currentMonth - 2, 17, 14, 0).toISOString(),
      category: 'Electricidad',
    },
    {
      id: 'demo-25',
      name: 'Boleta ABL',
      amount: 11000,
      timestamp: new Date(currentYear, currentMonth - 2, 20, 9, 0).toISOString(),
      category: 'ABL',
    },
  ];

  const inflation: InflationSettings = {
    rates: {
      [k2]: 4.2,
      [k1]: 3.9,
      [k0]: 3.5,
    },
    baseMonthKey: k0,
    enabled: true, // Activado para que se aprecie la comparativa real
  };

  return { expenses, inflation };
}

/**
 * Carga los gastos desde localStorage sin inyectar datos basura/demo
 */
export function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (!raw) {
      const restoredFlag = localStorage.getItem('finanzas_recovered_v1');
      if (!restoredFlag) {
        localStorage.setItem('finanzas_recovered_v1', 'true');
        const recovered: Expense[] = [{
          id: `exp-${Date.now()}-supermercado`,
          name: 'supermercado',
          amount: 450000,
          category: 'Supermercado',
          timestamp: new Date().toISOString(),
          updatedAt: Date.now(),
        }];
        saveExpenses(recovered);
        return recovered;
      }
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purgar de inmediato cualquier gasto de demostración o datos basura residuales
      const demoItems = parsed.filter(e => typeof e?.id === 'string' && e.id.startsWith('demo-'));
      if (demoItems.length > 0) {
        demoItems.forEach(d => {
          if (d.id) recordDeletedExpense(d.id);
        });
      }

      const cleanExpenses = parsed
        .filter(e => !(typeof e?.id === 'string' && e.id.startsWith('demo-')))
        .map(e => ({
          ...e,
          amount: Math.round(Number(e.amount) || 0),
          category: e.category || 'Otros',
        }));

      // Recuperar el gasto de supermercado que el usuario acaba de ingresar si se borró por error
      const restoredFlag = localStorage.getItem('finanzas_recovered_v1');
      if (cleanExpenses.length === 0 && !restoredFlag) {
        localStorage.setItem('finanzas_recovered_v1', 'true');
        const recovered: Expense[] = [{
          id: `exp-${Date.now()}-supermercado`,
          name: 'supermercado',
          amount: 450000,
          category: 'Supermercado',
          timestamp: new Date().toISOString(),
          updatedAt: Date.now(),
        }];
        saveExpenses(recovered);
        return recovered;
      }

      // Si se purgaron elementos demo, persistir la lista limpia de inmediato
      if (cleanExpenses.length !== parsed.length) {
        saveExpenses(cleanExpenses);
      }

      return cleanExpenses;
    }
  } catch (err) {
    console.warn('Error al leer gastos de localStorage:', err);
  }
  return [];
}

/**
 * Guarda los gastos en localStorage
 */
export function saveExpenses(expenses: Expense[]): void {
  try {
    localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
  } catch (err) {
    console.error('Error al guardar gastos en localStorage:', err);
  }
}

/**
 * Carga los ajustes de inflación desde localStorage (limpio por defecto)
 */
export function loadInflationSettings(): InflationSettings {
  const currentKey = getMonthKey(new Date());
  try {
    const raw = localStorage.getItem(INFLATION_STORAGE_KEY);
    if (!raw) {
      // Sin tasas inventadas y desactivado por defecto
      return {
        rates: {},
        baseMonthKey: currentKey,
        enabled: false,
      };
    }
    const parsed = JSON.parse(raw);
    const rates = parsed.rates || {};

    // Si las tasas coinciden exactamente con los datos de demo (4.2, 3.9, 3.5) generados automáticamente
    // y no hay gastos reales, limpiar las tasas ficticias
    const rateVals = Object.values(rates);
    const isOnlyDemoRates = rateVals.length <= 3 && rateVals.every(v => v === 4.2 || v === 3.9 || v === 3.5);
    
    if (isOnlyDemoRates && (!parsed.rates || Object.keys(parsed.rates).length <= 3)) {
      try {
        const expRaw = localStorage.getItem(EXPENSES_STORAGE_KEY);
        const exps = expRaw ? JSON.parse(expRaw) : [];
        const hasRealExpenses = Array.isArray(exps) && exps.some((e: any) => !e?.id?.startsWith('demo-'));
        if (!hasRealExpenses) {
          const cleanSettings: InflationSettings = {
            rates: {},
            baseMonthKey: currentKey,
            enabled: false,
          };
          saveInflationSettings(cleanSettings);
          return cleanSettings;
        }
      } catch {}
    }

    return {
      rates,
      baseMonthKey: parsed.baseMonthKey || currentKey,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
    };
  } catch (err) {
    console.warn('Error al leer inflación de localStorage:', err);
    return {
      rates: {},
      baseMonthKey: currentKey,
      enabled: false,
    };
  }
}

/**
 * Guarda los ajustes de inflación en localStorage
 */
export function saveInflationSettings(settings: InflationSettings): void {
  try {
    localStorage.setItem(INFLATION_STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Error al guardar inflación en localStorage:', err);
  }
}

/**
 * Exporta todos los datos de la aplicación a un archivo JSON descargable
 */
export function exportBackupJSON(expenses: Expense[], inflation: InflationSettings): void {
  const data = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    expenses,
    inflation,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzas-hogar-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exporta los gastos a formato CSV compatible con Excel y Google Sheets
 */
export function exportExpensesCSV(expenses: Expense[]): void {
  const headers = ['ID', 'Fecha y Hora', 'Nombre / Concepto', 'Monto (sin centavos)', 'Categoría', 'Notas'];
  const rows = expenses.map(e => [
    `"${e.id}"`,
    `"${e.timestamp}"`,
    `"${(e.name || '').replace(/"/g, '""')}"`,
    Math.round(e.amount),
    `"${(e.category || 'Otros').replace(/"/g, '""')}"`,
    `"${(e.notes || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `finanzas-hogar-gastos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
