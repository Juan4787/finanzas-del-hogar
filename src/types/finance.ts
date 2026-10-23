export interface Category {
  id: string; // ej: 'alimentos', 'servicios', o personalizada
  name: string; // ej: 'Alimentos', 'Expensas', 'Deportes'
  color: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number; // Monto entero sin centavos (ej: 15400)
  timestamp: string; // ISO 8601 (ej: 2026-10-23T16:20:00)
  category: string; // Nombre de la categoría (ej: 'Expensas', 'Alimentos', o 'Otros')
  notes?: string;
  updatedAt?: number; // Epoch ms para sincronización y resolución LWW
  deleted?: boolean; // Tombstone para sincronizar borrados
}

export interface MonthlyInflation {
  monthKey: string; // Formato 'YYYY-MM', ej: '2026-09'
  ratePercent: number; // Tasa de inflación mensual en %, ej: 3.5
}

export interface InflationSettings {
  rates: Record<string, number>; // monthKey -> ratePercent
  baseMonthKey: string; // Mes base de referencia para precios constantes (ej: '2026-10')
  enabled: boolean; // Si está activo el modo Precios Constantes en toda la app
  updatedAt?: number;
}

export interface SyncConfig {
  householdId: string;
  apiUrl: string;
  lastSyncedAt: number | null;
  autoSync: boolean;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface PeriodSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalNominal: number;
  totalConstant: number;
  expenseCount: number;
  dailyAverageNominal: number;
  dailyAverageConstant: number;
  categoryBreakdown: Array<{
    category: string;
    nominal: number;
    constant: number;
    percentage: number;
    color: string;
  }>;
}

export interface ComparisonResult {
  periodA: PeriodSummary;
  periodB: PeriodSummary;
  differenceNominal: number;
  differencePercentNominal: number;
  differenceConstant: number;
  differencePercentConstant: number;
  dailyDiffNominal: number;
  dailyDiffConstant: number;
}
