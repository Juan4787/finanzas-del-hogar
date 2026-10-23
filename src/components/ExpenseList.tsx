import React, { useState } from 'react';
import type { Expense, InflationSettings } from '../types/finance';
import {
  formatCurrency,
  getExpenseConstantAmount,
  getCategoryColor,
  normalizeCategoryName,
} from '../utils/financeCalculations';
import { formatDateTime } from '../utils/dateUtils';
import { Search, Trash2 } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  onDeleteExpense: (id: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  settings,
  indices,
  onDeleteExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = expenses.filter(e => {
    const normCat = normalizeCategoryName(e.category);
    return (
      searchTerm.trim() === '' ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      normCat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="simple-card">
      <div className="simple-list-header">
        <h3 className="simple-section-title">Últimos Gastos</h3>
        <span className="simple-badge-count">{expenses.length} anotados</span>
      </div>

      {/* Buscador Rápido y Sencillo */}
      <div className="simple-search-wrapper">
        <Search size={18} className="search-icon-simple" />
        <input
          type="text"
          placeholder="Buscar gasto o rubro..."
          className="simple-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
            ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="simple-empty-state">
          <p>No hay gastos encontrados.</p>
        </div>
      ) : (
        <div className="simple-expense-items-list">
          {filtered.map((item) => {
            const normCat = normalizeCategoryName(item.category);
            const color = getCategoryColor(normCat);
            const nominal = Math.round(item.amount);
            const constant = getExpenseConstantAmount(item, settings, indices);
            const displayAmount = settings.enabled ? constant : nominal;

            return (
              <div key={item.id} className="simple-expense-item">
                <div className="expense-left-side">
                  <span className="simple-cat-dot" style={{ backgroundColor: color }} />
                  <div className="expense-details">
                    <span className="expense-item-name">{item.name}</span>
                    <div className="expense-meta-row">
                      <span className="expense-item-cat">{normCat}</span>
                      <span className="meta-separator">•</span>
                      <span className="expense-item-time">{formatDateTime(item.timestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="expense-right-side">
                  <span className="expense-item-amount">{formatCurrency(displayAmount)}</span>
                  <button
                    className="btn-trash-simple"
                    aria-label={`Borrar gasto ${item.name}`}
                    onClick={() => {
                      if (confirm(`¿Borrar "${item.name}" por ${formatCurrency(nominal)}?`)) {
                        onDeleteExpense(item.id);
                      }
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
