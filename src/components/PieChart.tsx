import React, { useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut, Pie } from 'react-chartjs-2';
import { formatCurrency } from '../utils/financeCalculations';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface PieChartItem {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface PieChartProps {
  data: PieChartItem[];
  title?: string;
}

export const PieChart: React.FC<PieChartProps> = ({
  data,
  title = 'En qué se fue la plata',
}) => {
  const [chartType, setChartType] = useState<'pie' | 'doughnut'>('doughnut');
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const totalValue = data.reduce((acc, item) => acc + item.value, 0);

  if (!data || data.length === 0 || totalValue === 0) {
    return (
      <div className="simple-card">
        <h3 className="simple-section-title">{title}</h3>
        <p className="simple-empty-text">Aún no hay gastos registrados este mes.</p>
      </div>
    );
  }

  // Ordenar por monto descendente para una presentación limpia
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const selectedItem = selectedLabel
    ? sortedData.find((d) => d.label === selectedLabel) || null
    : null;

  const chartData = {
    labels: sortedData.map((d) => d.label),
    datasets: [
      {
        data: sortedData.map((d) => d.value),
        backgroundColor: sortedData.map((d) =>
          selectedItem && d.label !== selectedItem.label ? `${d.color}55` : d.color
        ),
        borderColor: '#131b2c',
        borderWidth: 2.5,
        hoverOffset: 10,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 450,
      easing: 'easeOutQuart',
    },
    cutout: chartType === 'doughnut' ? '60%' : 0,
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0) {
        const idx = elements[0].index;
        const clicked = sortedData[idx];
        if (clicked) {
          setSelectedLabel((prev) => (prev === clicked.label ? null : clicked.label));
        }
      } else {
        setSelectedLabel(null);
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#ffffff',
        titleFont: { size: 14, weight: 'bold' },
        bodyColor: '#34d399',
        bodyFont: { size: 15, weight: '800' },
        padding: 12,
        cornerRadius: 10,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            const val = context.raw || 0;
            const pct = totalValue > 0 ? ((val / totalValue) * 100).toFixed(1) : '0';
            return ` ${formatCurrency(val)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="simple-card">
      <div className="chart-title-toggle-row">
        <h3 className="simple-section-title">{title}</h3>
        <div className="chart-mode-toggle">
          <button
            type="button"
            className={`btn-chart-mode ${chartType === 'pie' ? 'active' : ''}`}
            onClick={() => setChartType('pie')}
          >
            Torta
          </button>
          <button
            type="button"
            className={`btn-chart-mode ${chartType === 'doughnut' ? 'active' : ''}`}
            onClick={() => setChartType('doughnut')}
          >
            Dona
          </button>
        </div>
      </div>

      <div className="chartjs-container-wrapper">
        <div className="chartjs-canvas-box">
          {chartType === 'doughnut' ? (
            <>
              <Doughnut data={chartData} options={chartOptions} />
              <div className="donut-center-info">
                <span className="donut-center-label">
                  {selectedItem ? selectedItem.label : 'Total'}
                </span>
                <span
                  className="donut-center-amount"
                  style={selectedItem ? { color: selectedItem.color } : undefined}
                >
                  {formatCurrency(selectedItem ? selectedItem.value : totalValue)}
                </span>
                {selectedItem && (
                  <span className="donut-center-sub">
                    {selectedItem.percentage.toFixed(1)}% del mes
                  </span>
                )}
              </div>
            </>
          ) : (
            <Pie data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Lista táctil con porcentajes claros */}
      <div className="simple-legend-list">
        {sortedData.map((item) => {
          const isSelected = selectedItem?.label === item.label;
          return (
            <div
              key={item.label}
              className={`simple-legend-row ${isSelected ? 'active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelectedLabel((prev) => (prev === item.label ? null : item.label))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedLabel((prev) => (prev === item.label ? null : item.label));
                }
              }}
            >
              <span className="legend-dot" style={{ backgroundColor: item.color }} />
              <span className="legend-title">{item.label}</span>
              <span className="legend-amount">{formatCurrency(item.value)}</span>
              <span className="legend-pct-pill">{item.percentage.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
