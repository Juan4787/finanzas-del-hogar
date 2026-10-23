import type { Expense, InflationSettings, PeriodSummary, ComparisonResult } from '../types/finance';

/**
 * Normaliza el nombre de una categoría para que "nafta", "Nafta", "NAFTA "
 * o cualquier variante de mayúsculas/minúsculas se unifique siempre como la misma categoría.
 * Si queda vacía, retorna "Otros".
 */
export function normalizeCategoryName(rawCategory?: string): string {
  if (!rawCategory) return 'Otros';
  const trimmed = rawCategory.trim();
  if (!trimmed) return 'Otros';

  // Preservar siglas cortas como ABL o DGI
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }

  // Capitaliza cada palabra de la categoría
  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Paleta de colores distintivos y armoniosos para el gráfico de torta y categorías.
 */
export const CATEGORY_COLORS = [
  '#f97316', // Naranja vibrante (como Expensas)
  '#ef4444', // Rojo coral (Deportes)
  '#3b82f6', // Azul eléctrico (Abl)
  '#eab308', // Amarillo ámbar (Dietética)
  '#22c55e', // Verde esmeralda (Electricidad)
  '#a855f7', // Púrpura
  '#06b6d4', // Cian
  '#ec4899', // Rosa
  '#84cc16', // Lima
  '#14b8a6', // Turquesa
  '#6366f1', // Índigo
  '#64748b', // Pizarra para 'Otros'
];

/**
 * Obtiene el color correspondiente a una categoría de forma determinística
 */
export function getCategoryColor(categoryName: string, index = 0): string {
  const normalized = normalizeCategoryName(categoryName).toLowerCase();
  if (normalized === 'otros' || normalized === 'otro') {
    return '#64748b';
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash + index) % (CATEGORY_COLORS.length - 1);
  return CATEGORY_COLORS[colorIndex];
}

/**
 * Formatea un monto entero en moneda local sin centavos (ej: $ 15.400)
 */
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount || 0);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Obtiene la clave de mes 'YYYY-MM' a partir de una fecha ISO o timestamp
 */
export function getMonthKey(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Nombre amigable en español de un mes 'YYYY-MM' (ej: "Octubre 2026")
 */
export function formatMonthName(monthKey: string): string {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  const date = new Date(year, month - 1, 1);
  const monthName = date.toLocaleDateString('es-ES', { month: 'long' });
  return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
}

/**
 * Calcula la tabla de Índices de Precios Acumulados (IPC Base 100)
 * para todas las fechas presentes en la configuración y los gastos.
 */
export function computeCumulativePriceIndices(
  rates: Record<string, number>,
  allMonthKeys: string[]
): Record<string, number> {
  const uniqueMonths = Array.from(new Set([...Object.keys(rates), ...allMonthKeys])).filter(Boolean);
  uniqueMonths.sort(); // Orden cronológico (ej: 2026-01, 2026-02, ...)

  const indices: Record<string, number> = {};
  if (uniqueMonths.length === 0) return indices;

  let currentIndex = 100.0;
  for (let i = 0; i < uniqueMonths.length; i++) {
    const m = uniqueMonths[i];
    const rate = rates[m] || 0; // Tasa en % para este mes
    if (i === 0) {
      // Mes inicial arranca en 100
      currentIndex = 100.0;
    } else {
      // El índice se actualiza con la inflación del período: IPC_t = IPC_{t-1} * (1 + rate / 100)
      currentIndex = currentIndex * (1 + rate / 100);
    }
    indices[m] = currentIndex;
  }

  return indices;
}

/**
 * Calcula el factor de ajuste por inflación para convertir un monto de `fromMonth` a precios constantes de `baseMonth`.
 * 
 * Fórmula matemática auditada:
 * Factor = IPC(baseMonth) / IPC(fromMonth)
 * Monto Constante = Monto Nominal * Factor
 */
export function getInflationFactor(
  fromMonth: string,
  baseMonth: string,
  indices: Record<string, number>
): { factor: number; explanation: string } {
  if (!fromMonth || !baseMonth || fromMonth === baseMonth) {
    return { factor: 1.0, explanation: 'Mismo mes: factor 1.0 (sin variación de poder adquisitivo)' };
  }

  const fromIndex = indices[fromMonth];
  const baseIndex = indices[baseMonth];

  if (!fromIndex || !baseIndex || fromIndex <= 0) {
    return { factor: 1.0, explanation: 'Índice no disponible, se mantiene factor 1.0' };
  }

  const factor = baseIndex / fromIndex;
  const percentChange = ((factor - 1) * 100).toFixed(1);
  const sign = Number(percentChange) >= 0 ? '+' : '';
  const explanation = `IPC Base (${baseMonth}) = ${baseIndex.toFixed(2)} / IPC Origen (${fromMonth}) = ${fromIndex.toFixed(2)} → Factor ${factor.toFixed(4)} (${sign}${percentChange}%)`;

  return { factor, explanation };
}

/**
 * Calcula el monto a precios constantes para un gasto dado (redondeado a entero sin centavos).
 */
export function getExpenseConstantAmount(
  expense: Expense,
  settings: InflationSettings,
  indices: Record<string, number>
): number {
  if (!settings.enabled) {
    return Math.round(expense.amount);
  }

  const expenseMonth = getMonthKey(expense.timestamp);
  const { factor } = getInflationFactor(expenseMonth, settings.baseMonthKey, indices);
  return Math.round(expense.amount * factor);
}

/**
 * Calcula el resumen de un período de gastos, con desglose nominal, constante y categorías unificadas.
 */
export function calculatePeriodSummary(
  expenses: Expense[],
  periodLabel: string,
  startDateStr: string,
  endDateStr: string,
  settings: InflationSettings,
  indices: Record<string, number>
): PeriodSummary {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const filtered = expenses.filter(e => {
    const t = new Date(e.timestamp).getTime();
    return t >= start.getTime() && t <= end.getTime();
  });

  let totalNominal = 0;
  let totalConstant = 0;
  const catMap: Record<string, { nominal: number; constant: number }> = {};

  filtered.forEach(exp => {
    const nominal = Math.round(exp.amount);
    const constant = getExpenseConstantAmount(exp, settings, indices);
    // Unificación estricta de categorías ("nafta" y "Nafta" quedan exactamente iguales)
    const cat = normalizeCategoryName(exp.category);

    totalNominal += nominal;
    totalConstant += constant;

    if (!catMap[cat]) {
      catMap[cat] = { nominal: 0, constant: 0 };
    }
    catMap[cat].nominal += nominal;
    catMap[cat].constant += constant;
  });

  // Días transcurridos en el rango
  const diffTime = Math.max(1, Math.abs(end.getTime() - start.getTime()));
  const days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  const activeTotal = settings.enabled ? totalConstant : totalNominal;

  const categoryBreakdown = Object.entries(catMap)
    .map(([catName, vals], idx) => {
      const activeCatVal = settings.enabled ? vals.constant : vals.nominal;
      const percentage = activeTotal > 0 ? (activeCatVal / activeTotal) * 100 : 0;
      return {
        category: catName,
        nominal: vals.nominal,
        constant: vals.constant,
        percentage: Number(percentage.toFixed(1)),
        color: getCategoryColor(catName, idx)
      };
    })
    .sort((a, b) => b.percentage - a.percentage);

  return {
    periodLabel,
    startDate: startDateStr,
    endDate: endDateStr,
    totalNominal,
    totalConstant,
    expenseCount: filtered.length,
    dailyAverageNominal: Math.round(totalNominal / days),
    dailyAverageConstant: Math.round(totalConstant / days),
    categoryBreakdown,
  };
}

/**
 * Compara dos períodos A y B auditando diferencias absolutas y porcentuales.
 */
export function comparePeriods(
  summaryA: PeriodSummary,
  summaryB: PeriodSummary
): ComparisonResult {
  const diffNominal = summaryA.totalNominal - summaryB.totalNominal;
  const diffPercentNominal = summaryB.totalNominal > 0 
    ? ((diffNominal / summaryB.totalNominal) * 100) 
    : 0;

  const diffConstant = summaryA.totalConstant - summaryB.totalConstant;
  const diffPercentConstant = summaryB.totalConstant > 0 
    ? ((diffConstant / summaryB.totalConstant) * 100) 
    : 0;

  return {
    periodA: summaryA,
    periodB: summaryB,
    differenceNominal: diffNominal,
    differencePercentNominal: Number(diffPercentNominal.toFixed(1)),
    differenceConstant: diffConstant,
    differencePercentConstant: Number(diffPercentConstant.toFixed(1)),
    dailyDiffNominal: summaryA.dailyAverageNominal - summaryB.dailyAverageNominal,
    dailyDiffConstant: summaryA.dailyAverageConstant - summaryB.dailyAverageConstant,
  };
}

/**
 * Sugerencia inteligente de categoría basada en historial de gastos:
 * 1. Si el nombre coincide con un gasto previo, sugiere la categoría previa normalizada.
 * 2. Si no coincide, sugiere la/**
 * Sugerencia inteligente de categoría:
 * 1. Si el nombre coincide con un gasto previo, sugiere la categoría previa normalizada.
 * 2. Si no coincide o no hay historial, sugiere 'Supermercado'.
 */
export function getSuggestedCategory(currentName: string, expenses: Expense[]): string {
  if (!expenses || expenses.length === 0) {
    return 'Supermercado';
  }

  const cleanName = currentName.trim().toLowerCase();

  if (cleanName.length >= 2) {
    const matchingExpenses = expenses.filter(e => 
      e.name.toLowerCase().includes(cleanName) || cleanName.includes(e.name.toLowerCase())
    );

    if (matchingExpenses.length > 0) {
      const matchCounts: Record<string, number> = {};
      matchingExpenses.forEach(e => {
        const cat = normalizeCategoryName(e.category);
        matchCounts[cat] = (matchCounts[cat] || 0) + 1;
      });

      const topMatch = Object.entries(matchCounts).sort((a, b) => b[1] - a[1])[0];
      if (topMatch && topMatch[1] > 0) {
        return topMatch[0];
      }
    }
  }

  return 'Supermercado';
}

/**
 * Categorías sugeridas fijas solicitadas por el usuario:
 * Supermercado, Gimnasio, Electricidad, Gas y Comida de Mascotas.
 * Se excluyen explícitamente de sugeridos: Expensas, Deporte, Alimentos.
 */
export function getTopFrequentCategories(_expenses: Expense[], _limit = 5): string[] {
  return [
    'Supermercado',
    'Gimnasio',
    'Electricidad',
    'Gas',
    'Comida de Mascotas',
  ];
}
