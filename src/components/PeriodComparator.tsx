import React, { useState } from 'react';
import type { Expense, InflationSettings } from '../types/finance';
import {
  calculatePeriodSummary,
  comparePeriods,
  formatCurrency,
} from '../utils/financeCalculations';
import {
  getTodayRange,
  getYesterdayRange,
  getThisWeekRange,
  getLastWeekRange,
  getThisMonthRange,
  getLastMonthRange,
  dateInputToRange,
} from '../utils/dateUtils';
import { ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from 'lucide-react';

interface PeriodComparatorProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
}

type PresetOption = 'month' | 'week' | 'day' | 'custom';

export const PeriodComparator: React.FC<PeriodComparatorProps> = ({
  expenses,
  settings,
  indices,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<PresetOption>('month');
  const [showCustomRange, setShowCustomRange] = useState(false);

  const todayISO = new Date().toISOString().slice(0, 10);
  const [customStartA, setCustomStartA] = useState(todayISO);
  const [customEndA, setCustomEndA] = useState(todayISO);
  const [customStartB, setCustomStartB] = useState(todayISO);
  const [customEndB, setCustomEndB] = useState(todayISO);

  let rangeA: { start: string; end: string; label: string };
  let rangeB: { start: string; end: string; label: string };

  if (selectedPreset === 'month') {
    const rA = getThisMonthRange();
    const rB = getLastMonthRange();
    rangeA = { ...rA, label: 'Este Mes' };
    rangeB = { ...rB, label: 'Mes Pasado' };
  } else if (selectedPreset === 'week') {
    const rA = getThisWeekRange();
    const rB = getLastWeekRange();
    rangeA = { ...rA, label: 'Esta Semana' };
    rangeB = { ...rB, label: 'Semana Pasada' };
  } else if (selectedPreset === 'day') {
    const rA = getTodayRange();
    const rB = getYesterdayRange();
    rangeA = { ...rA, label: 'Hoy' };
    rangeB = { ...rB, label: 'Ayer' };
  } else {
    const rA = dateInputToRange(customStartA, customEndA);
    const rB = dateInputToRange(customStartB, customEndB);
    rangeA = { ...rA, label: 'Período A' };
    rangeB = { ...rB, label: 'Período B' };
  }

  const summaryA = calculatePeriodSummary(expenses, rangeA.label, rangeA.start, rangeA.end, settings, indices);
  const summaryB = calculatePeriodSummary(expenses, rangeB.label, rangeB.start, rangeB.end, settings, indices);
  const comparison = comparePeriods(summaryA, summaryB);

  const totalA = settings.enabled ? summaryA.totalConstant : summaryA.totalNominal;
  const totalB = settings.enabled ? summaryB.totalConstant : summaryB.totalNominal;
  const diff = settings.enabled ? comparison.differenceConstant : comparison.differenceNominal;
  const diffPct = Math.abs(settings.enabled ? comparison.differencePercentConstant : comparison.differencePercentNominal);

  const maxBar = Math.max(totalA, totalB, 1);
  const barPctA = (totalA / maxBar) * 100;
  const barPctB = (totalB / maxBar) * 100;

  return (
    <div className="simple-card">
      <h3 className="simple-section-title">Comparar Gastos</h3>

      {/* Selector simple con botones táctiles grandes */}
      <div className="simple-period-selector">
        <button
          className={`simple-pill-tab ${selectedPreset === 'month' ? 'active' : ''}`}
          onClick={() => { setSelectedPreset('month'); setShowCustomRange(false); }}
        >
          Mes a Mes
        </button>
        <button
          className={`simple-pill-tab ${selectedPreset === 'week' ? 'active' : ''}`}
          onClick={() => { setSelectedPreset('week'); setShowCustomRange(false); }}
        >
          Semana
        </button>
        <button
          className={`simple-pill-tab ${selectedPreset === 'day' ? 'active' : ''}`}
          onClick={() => { setSelectedPreset('day'); setShowCustomRange(false); }}
        >
          Hoy vs Ayer
        </button>
      </div>

      {/* Resultado Principal Ultra Claro para Marta */}
      <div className={`simple-comparison-hero ${diff > 0 ? 'hero-up' : diff < 0 ? 'hero-down' : 'hero-neutral'}`}>
        <div className="hero-status-row">
          {diff > 0 ? (
            <>
              <ArrowUpRight size={24} className="text-danger" />
              <span className="hero-title">Gastaste <strong>{formatCurrency(diff)}</strong> más</span>
            </>
          ) : diff < 0 ? (
            <>
              <ArrowDownRight size={24} className="text-emerald" />
              <span className="hero-title">Ahorraste <strong>{formatCurrency(Math.abs(diff))}</strong></span>
            </>
          ) : (
            <span className="hero-title">Gastaste lo mismo</span>
          )}
        </div>
        <div className="hero-subtext">
          {diff > 0 ? `Un aumento del ${diffPct}% respecto al período anterior` : diff < 0 ? `Una reducción del ${diffPct}% respecto al período anterior` : 'Sin variaciones'}
        </div>
      </div>

      {/* Tarjetas comparativas lado a lado */}
      <div className="simple-compare-grid">
        <div className="compare-col col-current">
          <span className="compare-col-label">{summaryA.periodLabel}</span>
          <div className="compare-col-number">{formatCurrency(totalA)}</div>
          <div className="simple-progress-bar">
            <div className="bar-fill fill-emerald" style={{ width: `${barPctA}%` }} />
          </div>
        </div>

        <div className="compare-col col-previous">
          <span className="compare-col-label">{summaryB.periodLabel}</span>
          <div className="compare-col-number">{formatCurrency(totalB)}</div>
          <div className="simple-progress-bar">
            <div className="bar-fill fill-blue" style={{ width: `${barPctB}%` }} />
          </div>
        </div>
      </div>

      {/* Desglose por categorías (combinando ambos períodos para ver ahorros e incrementos reales) */}
      {(() => {
        const allCategoryNames = Array.from(
          new Set([
            ...summaryA.categoryBreakdown.map((c) => c.category),
            ...summaryB.categoryBreakdown.map((c) => c.category),
          ])
        );

        if (allCategoryNames.length === 0) return null;

        const sortedDiffs = allCategoryNames
          .map((catName) => {
            const catA = summaryA.categoryBreakdown.find((b) => b.category === catName);
            const catB = summaryB.categoryBreakdown.find((b) => b.category === catName);
            const valA = catA ? (settings.enabled ? catA.constant : catA.nominal) : 0;
            const valB = catB ? (settings.enabled ? catB.constant : catB.nominal) : 0;
            const catDiff = valA - valB;
            const color = catA?.color || catB?.color || '#64748b';
            return { catName, valA, valB, catDiff, color };
          })
          .sort((a, b) => Math.abs(b.catDiff) - Math.abs(a.catDiff));

        return (
          <div className="simple-category-diff-section">
            <h4 className="simple-subheading">Diferencia por rubro</h4>
            <div className="simple-category-diff-list">
              {sortedDiffs.map(({ catName, valA, catDiff, color }) => (
                <div key={catName} className="simple-diff-row">
                  <div className="diff-name-group">
                    <span className="diff-dot" style={{ backgroundColor: color }} />
                    <span className="diff-name">{catName}</span>
                  </div>
                  <div className="diff-values">
                    <span className="diff-current">{formatCurrency(valA)}</span>
                    <span
                      className={`diff-change ${
                        catDiff > 0 ? 'text-danger' : catDiff < 0 ? 'text-emerald' : 'text-muted'
                      }`}
                    >
                      {catDiff > 0
                        ? `+${formatCurrency(catDiff)}`
                        : catDiff < 0
                        ? `-${formatCurrency(Math.abs(catDiff))}`
                        : '='}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Opciones avanzadas de fechas (Discreto para el ayudante) */}
      <div className="simple-advanced-toggle">
        <button
          className="btn-toggle-advanced"
          onClick={() => {
            setShowCustomRange(!showCustomRange);
            if (!showCustomRange) setSelectedPreset('custom');
          }}
        >
          <span>Elegir otras fechas específicas</span>
          {showCustomRange ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showCustomRange && (
          <div className="custom-dates-compact animate-fade-in">
            <div className="custom-date-group">
              <label className="simple-label">Período actual:</label>
              <div className="date-pair">
                <input type="date" className="simple-input" value={customStartA} onChange={(e) => setCustomStartA(e.target.value)} />
                <input type="date" className="simple-input" value={customEndA} onChange={(e) => setCustomEndA(e.target.value)} />
              </div>
            </div>
            <div className="custom-date-group">
              <label className="simple-label">Comparar contra:</label>
              <div className="date-pair">
                <input type="date" className="simple-input" value={customStartB} onChange={(e) => setCustomStartB(e.target.value)} />
                <input type="date" className="simple-input" value={customEndB} onChange={(e) => setCustomEndB(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
