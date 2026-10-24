import React, { useState } from 'react';
import type { Expense, InflationSettings, SyncConfig, SyncState } from '../types/finance';
import {
  formatMonthName,
  getMonthKey,
  normalizeCategoryName,
} from '../utils/financeCalculations';
import {
  exportBackupJSON,
  exportExpensesCSV,
} from '../utils/storage';
import { generateHouseholdId, DEFAULT_API_URL } from '../utils/syncManager';
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  Plus,
  Cloud,
  CloudOff,
  Check,
  AlertCircle,
  Copy,
  Sparkles,
  X,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface SettingsViewProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  onUpdateSettings: (newSettings: InflationSettings) => void;
  onRestoreData: (expenses: Expense[], settings: InflationSettings) => void;
  onClearData: () => void;
  syncConfig: SyncConfig;
  syncState: SyncState;
  syncMessage: string;
  onUpdateSyncConfig: (config: SyncConfig) => void;
  onTriggerSync: (customConfig?: SyncConfig) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  expenses,
  settings,
  onUpdateSettings,
  onRestoreData,
  onClearData,
  syncConfig,
  syncState,
  syncMessage,
  onUpdateSyncConfig,
  onTriggerSync,
}) => {
  const [newMonthInput, setNewMonthInput] = useState(() => {
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    return getMonthKey(prev);
  });
  const [newRateInput, setNewRateInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [localHouseholdId, setLocalHouseholdId] = useState(syncConfig.householdId || '');
  const [localApiUrl, setLocalApiUrl] = useState(syncConfig.apiUrl || DEFAULT_API_URL);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleSaveAndSync = () => {
    const nextHousehold = localHouseholdId.trim();
    const nextApiUrl = localApiUrl.trim() || DEFAULT_API_URL;
    setLocalApiUrl(nextApiUrl);

    const hasEndpointChanged =
      nextHousehold !== syncConfig.householdId || nextApiUrl !== syncConfig.apiUrl;

    const updated: SyncConfig = {
      ...syncConfig,
      householdId: nextHousehold,
      apiUrl: nextApiUrl,
      lastSyncedAt: hasEndpointChanged ? null : syncConfig.lastSyncedAt,
    };
    onUpdateSyncConfig(updated);
    onTriggerSync(updated);
  };

  const [confirmModalData, setConfirmModalData] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDestructive: boolean;
    onConfirm: () => void;
  } | null>(null);

  const expenseMonths = expenses.map(e => getMonthKey(e.timestamp));
  const allMonths = Array.from(
    new Set([
      settings.baseMonthKey,
      ...Object.keys(settings.rates),
      ...expenseMonths,
    ])
  ).filter(Boolean);
  allMonths.sort().reverse();

  const handleRateChange = (monthKey: string, rateVal: string) => {
    const num = parseFloat(rateVal);
    const updatedRates = { ...settings.rates };
    if (isNaN(num)) {
      delete updatedRates[monthKey];
    } else {
      updatedRates[monthKey] = num;
    }
    onUpdateSettings({ ...settings, rates: updatedRates });
  };

  const handleAddMonth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthInput) return;
    const num = parseFloat(newRateInput) || 0;
    onUpdateSettings({
      ...settings,
      rates: { ...settings.rates, [newMonthInput]: num },
    });
    setNewRateInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || !Array.isArray(json.expenses)) {
          setBackupFeedback({
            type: 'error',
            text: 'El archivo seleccionado no tiene un formato de respaldo válido.',
          });
          return;
        }

        const sanitizedExpenses: Expense[] = json.expenses
          .filter((item: any) => item && (item.name || item.amount))
          .map((item: any, idx: number) => ({
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `restored-${Date.now()}-${idx}`,
            name: String(item.name || 'Gasto').trim(),
            amount: Math.max(0, Math.round(Number(item.amount) || 0)),
            category: normalizeCategoryName(item.category),
            timestamp: item.timestamp || new Date().toISOString(),
            notes: item.notes ? String(item.notes) : undefined,
            updatedAt: Date.now(),
          }));

        const restoredInflation: InflationSettings = json.inflation
          ? {
              rates: json.inflation.rates || {},
              baseMonthKey: json.inflation.baseMonthKey || settings.baseMonthKey,
              enabled: Boolean(json.inflation.enabled),
              updatedAt: Date.now(),
            }
          : settings;

        if (expenses.length > 0) {
          setConfirmModalData({
            title: '¿Restaurar copia de seguridad?',
            message: `Se reemplazarán los gastos actuales por los ${sanitizedExpenses.length} gastos del archivo "${file.name}".`,
            confirmLabel: 'Sí, restaurar',
            isDestructive: false,
            onConfirm: () => {
              onRestoreData(sanitizedExpenses, restoredInflation);
              setConfirmModalData(null);
              setBackupFeedback({
                type: 'success',
                text: `Copia restaurada con éxito (${sanitizedExpenses.length} gastos cargados).`,
              });
            },
          });
        } else {
          onRestoreData(sanitizedExpenses, restoredInflation);
          setBackupFeedback({
            type: 'success',
            text: `Copia restaurada con éxito (${sanitizedExpenses.length} gastos cargados).`,
          });
        }
      } catch {
        setBackupFeedback({
          type: 'error',
          text: 'No se pudo leer el archivo JSON. Verifica que sea una copia válida.',
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="simple-settings-wrapper">
      {/* 1. SECCIÓN INFLACIÓN Y PRECIOS CONSTANTES */}
      <div className="simple-card">
        <h3 className="simple-section-title">Ajuste por Inflación</h3>

        <div className="simple-toggle-row">
          <div>
            <strong>Medir a Precios Constantes</strong>
            <div className="simple-toggle-sub">Actualiza gastos pasados a poder de compra real</div>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => onUpdateSettings({ ...settings, enabled: e.target.checked })}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="simple-field-group">
          <label className="simple-label">Mes de referencia (Precios de hoy):</label>
          <div className="custom-select-wrapper">
            <select
              className="simple-select"
              value={settings.baseMonthKey}
              onChange={(e) => onUpdateSettings({ ...settings, baseMonthKey: e.target.value })}
            >
              {allMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthName(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Carga Rápida de Inflación por Mes */}
        <div className="simple-inflation-table">
          <label className="simple-label">Inflación mensual (%):</label>

          <form onSubmit={handleAddMonth} className="simple-add-month-row">
            <input
              type="month"
              className="simple-input input-month"
              value={newMonthInput}
              onChange={(e) => setNewMonthInput(e.target.value)}
              placeholder="Mes"
              required
            />
            <input
              type="number"
              step="0.1"
              placeholder="% infl."
              className="simple-input input-rate"
              value={newRateInput}
              onChange={(e) => setNewRateInput(e.target.value)}
              required
            />
            <button type="submit" className="btn-add-rate" title="Guardar tasa">
              <Plus size={18} />
            </button>
          </form>

          <div className="simple-rates-list">
            {allMonths.map((monthKey) => {
              const isBase = monthKey === settings.baseMonthKey;
              const hasRate = settings.rates[monthKey] !== undefined;
              return (
                <div key={monthKey} className={`rate-row ${isBase ? 'is-base' : ''}`}>
                  <span className="rate-month-name">
                    {formatMonthName(monthKey)}
                    {isBase && <span className="pill-base">Base</span>}
                  </span>
                  <div className="rate-input-box">
                    <input
                      type="number"
                      step="0.1"
                      className="simple-rate-number"
                      aria-label={`Inflación de ${formatMonthName(monthKey)}`}
                      value={hasRate ? settings.rates[monthKey] : ''}
                      placeholder="0.0"
                      onChange={(e) => handleRateChange(monthKey, e.target.value)}
                    />
                    <span className="rate-percent-sign">%</span>
                    <button
                      type="button"
                      className="btn-action-icon btn-trash-delete"
                      title={hasRate ? 'Eliminar tasa' : 'Sin tasa cargada'}
                      aria-label={`Eliminar tasa de ${formatMonthName(monthKey)}`}
                      disabled={!hasRate}
                      onClick={() => {
                        if (!hasRate) return;
                        const updatedRates = { ...settings.rates };
                        delete updatedRates[monthKey];
                        onUpdateSettings({ ...settings, rates: updatedRates });
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.keys(settings.rates).length > 0 && (
            <button
              type="button"
              className="btn-clear-all-rates"
              onClick={() => {
                setConfirmModalData({
                  title: '¿Limpiar tasas de inflación?',
                  message: 'Se borrarán todas las tasas mensuales cargadas y se desactivará la vista a precios constantes.',
                  confirmLabel: 'Sí, limpiar tasas',
                  isDestructive: true,
                  onConfirm: () => {
                    onUpdateSettings({
                      ...settings,
                      rates: {},
                      enabled: false,
                    });
                    setConfirmModalData(null);
                  },
                });
              }}
            >
              <Trash2 size={14} />
              <span>Limpiar todas las tasas de inflación</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. COPIA EN LA NUBE Y SINCRONIZACIÓN (CLOUDFLARE D1) */}
      <div className="simple-card">
        <div className="section-title-with-badge">
          <h3 className="simple-section-title">Copia en la Nube y Sincronización</h3>
          <span className={`sync-status-badge badge-${syncState}`}>
            {syncState === 'syncing' && <RefreshCw size={12} className="spin-animation" />}
            {syncState === 'synced' && <Check size={12} />}
            {syncState === 'offline' && <CloudOff size={12} />}
            {syncState === 'error' && <AlertCircle size={12} />}
            {syncState === 'idle' && <Cloud size={12} />}
            <span>
              {syncState === 'synced' && 'Conectado a Cloudflare'}
              {syncState === 'syncing' && 'Sincronizando...'}
              {syncState === 'offline' && 'Sin conexión (guardado en el teléfono)'}
              {syncState === 'error' && 'Sin conexión con la nube'}
              {syncState === 'idle' && (syncConfig.householdId ? 'Listo para sincronizar' : 'Solo local (sin código)')}
            </span>
          </span>
        </div>

        <p className="simple-helper-hint">
          Sincroniza los gastos entre el teléfono de Marta y tu computadora en tiempo real a través de Cloudflare D1 (SQLite), sin contraseñas ni registros.
        </p>

        <div className="sync-settings-fields">
          <div className="simple-field">
            <label htmlFor="household-id-input" className="simple-label">
              Código del Hogar (Identificador familiar)
            </label>
            <div className="household-id-row">
              <div className="simple-input-with-clear" style={{ flex: 1, minWidth: 0 }}>
                <input
                  id="household-id-input"
                  type="text"
                  className="simple-input"
                  placeholder="Ej: hogar-familia"
                  value={localHouseholdId}
                  onChange={(e) => {
                    setLocalHouseholdId(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveAndSync();
                    }
                  }}
                />
                {localHouseholdId && (
                  <button
                    type="button"
                    className="btn-input-clear"
                    title="Limpiar código"
                    aria-label="Limpiar código"
                    onClick={() => setLocalHouseholdId('')}
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
              <button
                type="button"
                className="btn-action-icon"
                title="Generar código aleatorio"
                aria-label="Generar código aleatorio"
                onClick={() => {
                  const rnd = generateHouseholdId();
                  setLocalHouseholdId(rnd);
                }}
              >
                <Sparkles size={16} className="text-amber" />
              </button>
              {localHouseholdId && (
                <button
                  type="button"
                  className="btn-action-icon"
                  title="Copiar código"
                  aria-label="Copiar código"
                  onClick={() => {
                    navigator.clipboard?.writeText(localHouseholdId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check size={16} className="text-emerald" /> : <Copy size={16} />}
                </button>
              )}
            </div>
            {copied && <span className="copy-feedback-text">¡Código copiado al portapapeles!</span>}
          </div>

          <div className="simple-field">
            <label htmlFor="api-url-input" className="simple-label">
              URL de la API Cloudflare Worker <span className="label-sub">(opcional)</span>
            </label>
            <input
              id="api-url-input"
              type="text"
              className="simple-input"
              placeholder={DEFAULT_API_URL}
              value={localApiUrl}
              onChange={(e) => setLocalApiUrl(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveAndSync();
                }
              }}
            />
          </div>

          <button
            type="button"
            className="btn-simple-sync"
            disabled={(!localHouseholdId.trim() && !syncConfig.householdId) || syncState === 'syncing'}
            onClick={handleSaveAndSync}
          >
            <RefreshCw size={18} className={syncState === 'syncing' ? 'spin-animation' : ''} />
            <span>
              {syncState === 'syncing'
                ? 'Sincronizando...'
                : !localHouseholdId.trim() && syncConfig.householdId
                ? 'Desconectar de la nube (usar modo local)'
                : 'Conectar y Sincronizar'}
            </span>
          </button>

          {syncConfig.lastSyncedAt && (
            <div className="sync-last-time">
              Última sincronización: <strong>{new Date(syncConfig.lastSyncedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} hs ({new Date(syncConfig.lastSyncedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })})</strong>
            </div>
          )}

          {syncMessage && syncState !== 'idle' && (
            <div className="sync-message-hint">{syncMessage}</div>
          )}
        </div>
      </div>

      {/* 3. COPIAS DE SEGURIDAD (OFFLINE) */}
      <div className="simple-card">
        <h3 className="simple-section-title">Copias de Seguridad Manuales</h3>

        {backupFeedback && (
          <div
            className={`backup-feedback-banner ${
              backupFeedback.type === 'success' ? 'feedback-success' : 'feedback-error'
            }`}
            role="status"
          >
            {backupFeedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{backupFeedback.text}</span>
          </div>
        )}

        <div className="simple-backup-buttons">
          <button
            type="button"
            className="btn-simple-backup"
            onClick={() => exportBackupJSON(expenses, settings)}
          >
            <Download size={20} className="text-emerald" />
            <span>Descargar Copia (JSON)</span>
          </button>

          <button
            type="button"
            className="btn-simple-backup"
            onClick={() => exportExpensesCSV(expenses)}
          >
            <FileSpreadsheet size={20} className="text-blue" />
            <span>Exportar a Excel (CSV)</span>
          </button>

          <label className="btn-simple-backup file-label">
            <Upload size={20} className="text-amber" />
            <span>Restaurar Copia</span>
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

        </div>

        <div className="simple-danger-area">
          <button
            type="button"
            className="btn-simple-danger"
            onClick={() => {
              setConfirmModalData({
                title: '¿Borrar todos los gastos?',
                message: 'Esta acción eliminará todos los gastos registrados de la aplicación.',
                confirmLabel: 'Sí, borrar todo',
                isDestructive: true,
                onConfirm: () => {
                  onClearData();
                  setConfirmModalData(null);
                },
              });
            }}
          >
            <Trash2 size={16} />
            <span>Borrar todos los gastos</span>
          </button>
        </div>
      </div>

      {/* Modal de confirmación personalizado */}
      <ConfirmModal
        isOpen={Boolean(confirmModalData)}
        title={confirmModalData?.title || ''}
        message={confirmModalData?.message || ''}
        confirmLabel={confirmModalData?.confirmLabel || 'Aceptar'}
        isDestructive={confirmModalData?.isDestructive || false}
        onConfirm={() => confirmModalData?.onConfirm()}
        onCancel={() => setConfirmModalData(null)}
      />
    </div>
  );
};
