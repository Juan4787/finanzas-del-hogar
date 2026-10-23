import React, { useState } from 'react';
import type { Expense, InflationSettings } from '../types/finance';
import { formatCurrency, getExpenseConstantAmount } from '../utils/financeCalculations';

interface EvolutionChartProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  granularity: 'day' | 'month';
}

export const EvolutionChart: React.FC<EvolutionChartProps> = ({
  expenses,
  settings,
  indices,
  granularity = 'day',
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    key: string;
    label: string;
    nominal: number;
    constant: number;
    count: number;
    x: number;
    y: number;
    activeVal: number;
  } | null>(null);

  // Agrupamos los gastos por clave (día 'YYYY-MM-DD' o mes 'YYYY-MM')
  const groupedData: Record<string, { label: string; nominal: number; constant: number; count: number; dateObj: Date }> = {};

  expenses.forEach(exp => {
    const d = new Date(exp.timestamp);
    let key: string;
    let label: string;

    if (granularity === 'month') {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      key = `${year}-${month}`;
      label = d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' });
    } else {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      key = `${year}-${month}-${day}`;
      label = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }

    if (!groupedData[key]) {
      groupedData[key] = { label, nominal: 0, constant: 0, count: 0, dateObj: d };
    }

    groupedData[key].nominal += Math.round(exp.amount);
    groupedData[key].constant += getExpenseConstantAmount(exp, settings, indices);
    groupedData[key].count += 1;
  });

  // Ordenar cronológicamente
  const sortedKeys = Object.keys(groupedData).sort();
  const displayKeys = granularity === 'day' ? sortedKeys.slice(-14) : sortedKeys.slice(-12);

  if (displayKeys.length === 0) {
    return (
      <div className="card evolution-card empty-chart">
        <h3 className="card-title">Evolución de Gastos</h3>
        <p className="empty-chart-placeholder">No hay datos suficientes para graficar la evolución.</p>
      </div>
    );
  }

  const chartData = displayKeys.map(k => ({
    key: k,
    ...groupedData[k],
  }));

  const maxVal = Math.max(
    ...chartData.map(d => (settings.enabled ? d.constant : d.nominal)),
    100
  );

  const width = 600;
  const height = 240;
  const paddingLeft = 65;
  const paddingRight = 25;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = chartData.map((d, index) => {
    const x = paddingLeft + (index / Math.max(chartData.length - 1, 1)) * chartWidth;
    const val = settings.enabled ? d.constant : d.nominal;
    const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
    return { ...d, x, y, activeVal: val };
  });

  const pathLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathArea = `${pathLine} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  // Ticks eje Y
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map(pct => {
    const val = Math.round(maxVal * pct);
    const y = paddingTop + chartHeight - pct * chartHeight;
    return { val, y };
  });

  return (
    <div className="card evolution-card">
      <div className="chart-header">
        <div>
          <h3 className="card-title">Evolución Temporal de Gastos</h3>
          <p className="card-subtitle">
            {granularity === 'day' ? 'Evolución diaria reciente' : 'Evolución mensual comparativa'}
          </p>
        </div>
        <div className="badge-group">
          {settings.enabled ? (
            <span className="badge badge-accent">Valores Reales (Ajustados por Inflación)</span>
          ) : (
            <span className="badge badge-neutral">Valores Nominales</span>
          )}
        </div>
      </div>

      <div className="evolution-chart-wrapper">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="evolution-svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas horizontales de guía */}
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={tick.y}
                x2={width - paddingRight}
                y2={tick.y}
                stroke="var(--border-subtle, rgba(255,255,255,0.08))"
                strokeDasharray="4 4"
              />
              <text
                x={paddingLeft - 8}
                y={tick.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted, #94a3b8)"
              >
                {tick.val >= 1000 ? `${Math.round(tick.val / 1000)}k` : tick.val}
              </text>
            </g>
          ))}

          {/* Área sombreada */}
          <path d={pathArea} fill="url(#areaGradient)" />

          {/* Línea principal */}
          <path
            d={pathLine}
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos y etiquetas */}
          {points.map((p, i) => (
            <g key={i}>
              {/* Círculo del punto */}
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredPoint?.key === p.key ? 6 : 4}
                fill="#10b981"
                stroke="var(--bg-card, #0f172a)"
                strokeWidth="2"
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredPoint(p)}
                onMouseLeave={() => setHoveredPoint(null)}
              />

              {/* Etiqueta Eje X */}
              <text
                x={p.x}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fontSize="10"
                fill="var(--text-muted, #94a3b8)"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip de punto flotante */}
        {hoveredPoint && (
          <div
            className="evolution-tooltip"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <div className="tooltip-date">{hoveredPoint.label}</div>
            <div className="tooltip-amount">{formatCurrency(hoveredPoint.activeVal)}</div>
            {settings.enabled && hoveredPoint.nominal !== hoveredPoint.constant && (
              <div className="tooltip-nominal-sub">
                Nominal: {formatCurrency(hoveredPoint.nominal)}
              </div>
            )}
            <div className="tooltip-count">{hoveredPoint.count} gasto(s)</div>
          </div>
        )}
      </div>
    </div>
  );
};
