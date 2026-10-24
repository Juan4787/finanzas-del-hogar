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

  const getMetricData = (
    summary: typeof todaySummary,
    prevSummary: typeof yesterdaySummary,
    comparison: typeof todayComparison
  ) => {
    const total = settings.enabled ? summary.totalConstant : summary.totalNominal;
    const prevTotal = settings.enabled ? prevSummary.totalConstant : prevSummary.totalNominal;
    const diff = settings.enabled ? comparison.differenceConstant : comparison.differenceNominal;
    const diffPct = settings.enabled ? comparison.differencePercentConstant : comparison.differencePercentNominal;
    return { total, prevTotal, diff, diffPct };
  };

  const dayMetric = getMetricData(todaySummary, yesterdaySummary, todayComparison);
  const weekMetric = getMetricData(thisWeekSummary, lastWeekSummary, weekComparison);
  const monthMetric = getMetricData(thisMonthSummary, lastMonthSummary, monthComparison);

  const renderComparisonPill = (metric: ReturnType<typeof getMetricData>, prevLabel: string) => {
    if (metric.prevTotal === 0) {
      return (
        <div className="stat-pill pill-neutral">
          <span>{metric.total > 0 ? `Sin gastos ${prevLabel}` : 'Sin movimientos'}</span>
        </div>
      );
    }

    if (metric.diff === 0) {
      return (
        <div className="stat-pill pill-neutral">
          <span>0% vs {prevLabel}</span>
        </div>
      );
    }

    return (
      <div className={`stat-pill ${metric.diff > 0 ? 'pill-up' : 'pill-down'}`}>
        {metric.diff > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        <span>{Math.abs(metric.diffPct)}% vs {prevLabel}</span>
      </div>
    );
  };

  const handleCardKeyDown = (e: React.KeyboardEvent, period: 'day' | 'week' | 'month') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectPeriodComparison?.(period);
    }
  };

  return (
    <div className="simple-summary-grid">
      {/* TARJETA HOY */}
      <div
        className="simple-stat-card"
        role="button"
        tabIndex={0}
        onClick={() => onSelectPeriodComparison?.('day')}
        onKeyDown={(e) => handleCardKeyDown(e, 'day')}
      >
        <span className="stat-label">Hoy</span>
        <div className="stat-number">{formatCurrency(dayMetric.total)}</div>
        {renderComparisonPill(dayMetric, 'ayer')}
      </div>

      {/* TARJETA ESTA SEMANA */}
      <div
        className="simple-stat-card"
        role="button"
        tabIndex={0}
        onClick={() => onSelectPeriodComparison?.('week')}
        onKeyDown={(e) => handleCardKeyDown(e, 'week')}
      >
        <span className="stat-label">Esta semana</span>
        <div className="stat-number">{formatCurrency(weekMetric.total)}</div>
        {renderComparisonPill(weekMetric, 'sem. ant.')}
      </div>

      {/* TARJETA ESTE MES - DESTACADA */}
      <div
        className="simple-stat-card stat-highlight"
        role="button"
        tabIndex={0}
        onClick={() => onSelectPeriodComparison?.('month')}
        onKeyDown={(e) => handleCardKeyDown(e, 'month')}
      >
        <span className="stat-label">Este mes</span>
        <div className="stat-number highlight-number">{formatCurrency(monthMetric.total)}</div>
        {renderComparisonPill(monthMetric, 'mes pasado')}
      </div>
    </div>
  );
};
