import React from 'react';
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
} from '../utils/dateUtils';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SummaryCardsProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  onSelectPeriodComparison?: (period: 'day' | 'week' | 'month') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  expenses,
  settings,
  indices,
  onSelectPeriodComparison,
}) => {
  // 1. HOY vs AYER
  const todayRange = getTodayRange();
  const yesterdayRange = getYesterdayRange();
  const todaySummary = calculatePeriodSummary(expenses, 'Hoy', todayRange.start, todayRange.end, settings, indices);
  const yesterdaySummary = calculatePeriodSummary(expenses, 'Ayer', yesterdayRange.start, yesterdayRange.end, settings, indices);
  const todayComparison = comparePeriods(todaySummary, yesterdaySummary);

  // 2. ESTA SEMANA
  const thisWeekRange = getThisWeekRange();
  const lastWeekRange = getLastWeekRange();
  const thisWeekSummary = calculatePeriodSummary(expenses, 'Esta Semana', thisWeekRange.start, thisWeekRange.end, settings, indices);
  const lastWeekSummary = calculatePeriodSummary(expenses, 'Semana Anterior', lastWeekRange.start, lastWeekRange.end, settings, indices);
  const weekComparison = comparePeriods(thisWeekSummary, lastWeekSummary);

  // 3. ESTE MES
  const thisMonthRange = getThisMonthRange();
  const lastMonthRange = getLastMonthRange();
  const thisMonthSummary = calculatePeriodSummary(expenses, 'Este Mes', thisMonthRange.start, thisMonthRange.end, settings, indices);
  const lastMonthSummary = calculatePeriodSummary(expenses, 'Mes Anterior', lastMonthRange.start, lastMonthRange.end, settings, indices);
  const monthComparison = comparePeriods(thisMonthSummary, lastMonthSummary);

  const getMetricData = (summary: typeof todaySummary, comparison: typeof todayComparison) => {
    const total = settings.enabled ? summary.totalConstant : summary.totalNominal;
    const diff = settings.enabled ? comparison.differenceConstant : comparison.differenceNominal;
    const diffPct = settings.enabled ? comparison.differencePercentConstant : comparison.differencePercentNominal;
    return { total, diff, diffPct };
  };

  const dayMetric = getMetricData(todaySummary, todayComparison);
  const weekMetric = getMetricData(thisWeekSummary, weekComparison);
  const monthMetric = getMetricData(thisMonthSummary, monthComparison);

  return (
    <div className="simple-summary-grid">
      {/* TARJETA HOY */}
      <div
        className="simple-stat-card"
        onClick={() => onSelectPeriodComparison?.('day')}
      >
        <span className="stat-label">Hoy</span>
        <div className="stat-number">{formatCurrency(dayMetric.total)}</div>
        {dayMetric.diff !== 0 && (
          <div className={`stat-pill ${dayMetric.diff > 0 ? 'pill-up' : 'pill-down'}`}>
            {dayMetric.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{Math.abs(dayMetric.diffPct)}% vs ayer</span>
          </div>
        )}
      </div>

      {/* TARJETA ESTA SEMANA */}
      <div
        className="simple-stat-card"
        onClick={() => onSelectPeriodComparison?.('week')}
      >
        <span className="stat-label">Esta semana</span>
        <div className="stat-number">{formatCurrency(weekMetric.total)}</div>
        {weekMetric.diff !== 0 && (
          <div className={`stat-pill ${weekMetric.diff > 0 ? 'pill-up' : 'pill-down'}`}>
            {weekMetric.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{Math.abs(weekMetric.diffPct)}% vs semana ant.</span>
          </div>
        )}
      </div>

      {/* TARJETA ESTE MES - DESTACADA */}
      <div
        className="simple-stat-card stat-highlight"
        onClick={() => onSelectPeriodComparison?.('month')}
      >
        <span className="stat-label">Este mes</span>
        <div className="stat-number highlight-number">{formatCurrency(monthMetric.total)}</div>
        {monthMetric.diff !== 0 && (
          <div className={`stat-pill ${monthMetric.diff > 0 ? 'pill-up' : 'pill-down'}`}>
            {monthMetric.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{Math.abs(monthMetric.diffPct)}% vs mes pasado</span>
          </div>
        )}
      </div>
    </div>
  );
};
