/**
 * MOTOR DE SINCRONIZACIÓN LOCAL-FIRST (OFFLINE-FIRST)
 * Finanzas Del Hogar - Sincronización en segundo plano con Cloudflare D1
 */

import type { Expense, InflationSettings, SyncConfig, SyncState } from '../types/finance';

const SYNC_CONFIG_KEY = 'finanzas_sync_config_v1';
const DELETED_EXPENSES_QUEUE_KEY = 'finanzas_deleted_queue_v1';

export const DEFAULT_API_URL = 'https://finanzas-hogar-api.finanzas-del-hogar.workers.dev';
export const DEFAULT_HOUSEHOLD_ID = 'hogar-principal';

/**
 * Genera un código de hogar amigable (ej: hogar-marta-842)
 */
export function generateHouseholdId(): string {
  const words = ['hogar', 'casa', 'familia'];
  const names = ['marta', 'casa', 'central', 'hogar'];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = names[Math.floor(Math.random() * names.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${w}-${n}-${num}`;
}

/**
 * Obtiene la configuración de sincronización guardada
 */
export function getSyncConfig(): SyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        householdId:
          parsed.householdId !== undefined ? parsed.householdId : DEFAULT_HOUSEHOLD_ID,
        apiUrl: parsed.apiUrl?.trim() ? parsed.apiUrl.trim() : DEFAULT_API_URL,
        lastSyncedAt: parsed.lastSyncedAt || null,
        autoSync: parsed.autoSync !== undefined ? parsed.autoSync : true,
      };
    }
  } catch {}

  return {
    householdId: DEFAULT_HOUSEHOLD_ID,
    apiUrl: DEFAULT_API_URL,
    lastSyncedAt: null,
    autoSync: true,
  };
}

/**
 * Guarda la configuración de sincronización
 */
export function saveSyncConfig(config: SyncConfig): void {
  try {
    localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
  } catch (err) {
    console.error('Error guardando configuración de sync:', err);
  }
}

/**
 * Obtiene la cola local de IDs eliminados para propagar al servidor (tombstones)
 */
export function getDeletedExpensesQueue(): Array<{ id: string; updatedAt: number }> {
  try {
    const raw = localStorage.getItem(DELETED_EXPENSES_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Agrega un ID a la cola de eliminados
 */
export function recordDeletedExpense(id: string): void {
  try {
    const current = getDeletedExpensesQueue().filter((item) => item.id !== id);
    current.push({ id, updatedAt: Date.now() });
    localStorage.setItem(DELETED_EXPENSES_QUEUE_KEY, JSON.stringify(current));
  } catch {}
}

/**
 * Limpia de la cola únicamente los IDs que fueron enviados y confirmados
 */
export function removeSyncedDeletedExpenses(syncedItems: Array<{ id: string; updatedAt: number }>): void {
  try {
    const syncedMap = new Map(syncedItems.map((i) => [i.id, i.updatedAt]));
    const remaining = getDeletedExpensesQueue().filter((item) => {
      const syncedTime = syncedMap.get(item.id);
      return syncedTime === undefined || item.updatedAt > syncedTime;
    });
    if (remaining.length === 0) {
      localStorage.removeItem(DELETED_EXPENSES_QUEUE_KEY);
    } else {
      localStorage.setItem(DELETED_EXPENSES_QUEUE_KEY, JSON.stringify(remaining));
    }
  } catch {}
}

/**
 * Limpia la cola de eliminados confirmados
 */
export function clearDeletedExpensesQueue(): void {
  try {
    localStorage.removeItem(DELETED_EXPENSES_QUEUE_KEY);
  } catch {}
}

export interface SyncResult {
  success: boolean;
  message?: string;
  updatedExpenses?: Expense[];
  updatedSettings?: InflationSettings;
}

/**
 * Ejecuta la sincronización bidireccional atómica con Cloudflare D1
 */
export async function executeSync(
  currentExpenses: Expense[],
  currentSettings: InflationSettings,
  onStatusChange?: (state: SyncState, message?: string) => void
): Promise<SyncResult> {
  const config = getSyncConfig();

  // Si no hay código de hogar, la app trabaja en modo puramente local (sin servidor)
  if (!config.householdId.trim()) {
    onStatusChange?.('idle', 'Modo local (sin código de hogar)');
    return { success: true };
  }

  // Si no hay conexión a internet, se queda en modo offline silencioso
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    onStatusChange?.('offline', 'Sin conexión (guardado en el teléfono)');
    return { success: false, message: 'Sin conexión' };
  }

  onStatusChange?.('syncing', 'Sincronizando con Cloudflare D1...');

  try {
    const baseUrl = (config.apiUrl?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
    const syncUrl = `${baseUrl}/api/sync`;

    const deletedItems = getDeletedExpensesQueue();
    const effectiveExpenses = Array.isArray(currentExpenses) ? currentExpenses : [];

    const now = Date.now();
    const payloadExpenses = [
      ...effectiveExpenses.map((e) => ({
        id: e.id,
        name: e.name,
        amount: Math.round(e.amount),
        category: e.category,
        timestamp: e.timestamp,
        notes: e.notes || undefined,
        deleted: false,
        updatedAt: e.updatedAt || now,
      })),
      ...deletedItems.map((d) => ({
        id: d.id,
        name: 'Eliminado',
        amount: 0,
        category: 'Otros',
        timestamp: new Date().toISOString(),
        deleted: true,
        updatedAt: d.updatedAt,
      })),
    ];

    const payload = {
      householdId: config.householdId.trim(),
      since: 0,
      expenses: payloadExpenses,
      inflationSettings: {
        rates: currentSettings.rates,
        baseMonthKey: currentSettings.baseMonthKey,
        enabled: currentSettings.enabled,
        updatedAt: currentSettings.updatedAt ?? 0,
      },
    };

    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error del servidor: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Respuesta de sincronización no exitosa');
    }

    // Limpiamos únicamente los eliminados que fueron sincronizados en este lote
    removeSyncedDeletedExpenses(deletedItems);

    // Obtenemos los eliminados que hayan ocurrido mientras la petición estaba en vuelo
    const pendingDeletes = new Map(
      getDeletedExpensesQueue().map((d) => [d.id, d.updatedAt])
    );

    // Actualizamos la fecha del último sync
    const newSyncTime = data.serverTime || Date.now();
    saveSyncConfig({
      ...config,
      lastSyncedAt: newSyncTime,
    });

    // Fusión de gastos (Merge LWW con el servidor)
    const serverExpenses = data.serverExpenses || [];
    let mergedExpenses = effectiveExpenses.filter((e) => !pendingDeletes.has(e.id));

    for (const sExp of serverExpenses) {
      const pendingDeleteTime = pendingDeletes.get(sExp.id);
      if (sExp.deleted || (pendingDeleteTime !== undefined && pendingDeleteTime >= (sExp.updatedAt || 0))) {
        // Si el servidor o la cola local en vuelo lo marca como eliminado, lo quitamos
        mergedExpenses = mergedExpenses.filter((e) => e.id !== sExp.id);
      } else {
        // Si el servidor devuelve un gasto de demo/basura residual, no aceptarlo y marcarlo como eliminado
        if (typeof sExp.id === 'string' && sExp.id.startsWith('demo-')) {
          recordDeletedExpense(sExp.id);
          mergedExpenses = mergedExpenses.filter((e) => e.id !== sExp.id);
          continue;
        }

        const localIdx = mergedExpenses.findIndex((e) => e.id === sExp.id);
        const serverExpenseObj: Expense = {
          id: sExp.id,
          name: sExp.name,
          amount: Math.round(sExp.amount),
          category: sExp.category,
          timestamp: sExp.timestamp,
          notes: sExp.notes,
          updatedAt: sExp.updatedAt,
        };

        if (localIdx >= 0) {
          // Si existe, actualizamos si el servidor tiene una versión igual o más nueva
          const local = mergedExpenses[localIdx];
          if ((sExp.updatedAt || 0) >= (local.updatedAt || 0)) {
            mergedExpenses[localIdx] = serverExpenseObj;
          }
        } else {
          // Si no existe localmente, lo insertamos arriba
          mergedExpenses.unshift(serverExpenseObj);
        }
      }
    }

    // Reordenar por timestamp descendente (con desempate por updatedAt)
    mergedExpenses.sort((a, b) => {
      const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

    // Fusión de inflación si vino actualizada
    let mergedSettings = currentSettings;
    if (data.serverInflationSettings) {
      const sInf = data.serverInflationSettings;
      if ((sInf.updatedAt || 0) >= (currentSettings.updatedAt || 0)) {
        mergedSettings = {
          rates: sInf.rates || currentSettings.rates,
          baseMonthKey: sInf.baseMonthKey || currentSettings.baseMonthKey,
          enabled: sInf.enabled !== undefined ? sInf.enabled : currentSettings.enabled,
          updatedAt: sInf.updatedAt,
        };
      }
    }

    onStatusChange?.('synced', 'Sincronizado con la nube');
    return {
      success: true,
      updatedExpenses: mergedExpenses,
      updatedSettings: mergedSettings,
    };
  } catch (err: any) {
    console.warn('Sincronización en segundo plano falló de forma segura:', err?.message);
    onStatusChange?.('error', 'No se pudo contactar la nube (datos seguros en el teléfono)');
    return {
      success: false,
      message: err?.message || 'Error de conexión',
    };
  }
}
