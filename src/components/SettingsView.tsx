import React, { useState } from 'react';
import type { Expense, InflationSettings } from '../types/finance';
import {
  formatMonthName,
  getMonthKey,
} from '../utils/financeCalculations';
import {
  exportBackupJSON,
  exportExpensesCSV,
  generateDemoData,
} from '../utils/storage';
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';

interface SettingsViewProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  onUpdateSettings: (newSettings: InflationSettings) => void;
  onRestoreData: (expenses: Expense[], settings: InflationSettings) => void;
  onClearData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  expenses,
  settings,
  onUpdateSettings,
  onRestoreData,
  onClearData,
}) => {
  const [newMonthInput, setNewMonthInput] = useState('');
  const [newRateInput, setNewRateInput] = useState('');

  const expenseMonths = expenses.map(e => getMonthKey(e.timestamp));
  const allMonths = Array.from(new Set([...Object.keys(settings.rates), ...expenseMonths])).filter(Boolean);
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
    setNewMonthInput('');
    setNewRateInput('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.expenses && Array.isArray(json.expenses)) {
          onRestoreData(json.expenses, json.inflation || settings);
          alert('Datos restaurados correctamente.');
        }
      } catch {
        alert('Archivo no válido.');
      }
    };
    reader.readAsText(file);
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
          <select
            className="simple-input"
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
            <button type="submit" className="btn-add-rate" title="Agregar mes">
              <Plus size={18} />
            </button>
          </form>

          <div className="simple-rates-list">
            {allMonths.map((monthKey) => {
              const isBase = monthKey === settings.baseMonthKey;
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
                      value={settings.rates[monthKey] !== undefined ? settings.rates[monthKey] : ''}
                      placeholder="0.0"
                      onChange={(e) => handleRateChange(monthKey, e.target.value)}
                    />
                    <span className="rate-percent-sign">%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. COPIAS DE SEGURIDAD (OFFLINE) */}
      <div className="simple-card">
        <h3 className="simple-section-title">Copias de Seguridad</h3>

        <div className="simple-backup-buttons">
          <button
            className="btn-simple-backup"
            onClick={() => exportBackupJSON(expenses, settings)}
          >
            <Download size={18} />
            <span>Descargar Copia (JSON)</span>
          </button>

          <button
            className="btn-simple-backup"
            onClick={() => exportExpensesCSV(expenses)}
          >
            <FileSpreadsheet size={18} />
            <span>Exportar a Excel (CSV)</span>
          </button>

          <label className="btn-simple-backup file-label">
            <Upload size={18} />
            <span>Restaurar Copia</span>
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <button
            className="btn-simple-backup"
            onClick={() => {
              if (confirm('¿Cargar datos de ejemplo con gastos de demostración?')) {
                const demo = generateDemoData();
                onRestoreData(demo.expenses, demo.inflation);
              }
            }}
          >
            <RefreshCw size={18} />
            <span>Cargar Datos de Ejemplo</span>
          </button>
        </div>

        <div className="simple-danger-area">
          <button
            className="btn-simple-danger"
            onClick={() => {
              if (confirm('¿Borrar todos los gastos registrados?')) {
                onClearData();
              }
            }}
          >
            <Trash2 size={16} />
            <span>Borrar todos los gastos</span>
          </button>
        </div>
      </div>
    </div>
  );
};
