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

  const chartData = {
    labels: sortedData.map((d) => d.label),
    datasets: [
      {
        data: sortedData.map((d) => d.value),
        backgroundColor: sortedData.map((d) => d.color),
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
      duration: 650,
      easing: 'easeOutQuart',
    },
    cutout: chartType === 'doughnut' ? '60%' : 0,
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
            className={`btn-chart-mode ${chartType === 'pie' ? 'active' : ''}`}
            onClick={() => setChartType('pie')}
          >
            Torta
          </button>
          <button
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
                <span className="donut-center-label">Total</span>
                <span className="donut-center-amount">{formatCurrency(totalValue)}</span>
              </div>
            </>
          ) : (
            <Pie data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* Lista táctil con porcentajes claros */}
      <div className="simple-legend-list">
        {sortedData.map((item, idx) => (
          <div key={idx} className="simple-legend-row">
            <span className="legend-dot" style={{ backgroundColor: item.color }} />
            <span className="legend-title">{item.label}</span>
            <span className="legend-amount">{formatCurrency(item.value)}</span>
            <span className="legend-pct-pill">{item.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
