import React, { useState } from 'react';
import type { Expense, InflationSettings } from '../types/finance';
import {
  formatCurrency,
  getExpenseConstantAmount,
  getCategoryColor,
  normalizeCategoryName,
  normalizeSearchText,
} from '../utils/financeCalculations';
import { formatDateTime } from '../utils/dateUtils';
import { Search, Trash2, Pencil } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface ExpenseListProps {
  expenses: Expense[];
  settings: InflationSettings;
  indices: Record<string, number>;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  settings,
  indices,
  onEditExpense,
  onDeleteExpense,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const normalizedQuery = normalizeSearchText(searchTerm);

  const filtered = expenses.filter(e => {
    if (!normalizedQuery) return true;
    const normCat = normalizeCategoryName(e.category);
    return (
      normalizeSearchText(e.name).includes(normalizedQuery) ||
      normalizeSearchText(normCat).includes(normalizedQuery)
    );
  });

  filtered.sort((a, b) => {
    const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  const handleConfirmDelete = () => {
    if (expenseToDelete) {
      onDeleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    }
  };

  const badgeLabel = normalizedQuery
    ? `${filtered.length} de ${expenses.length}`
    : `${expenses.length} ${expenses.length === 1 ? 'anotado' : 'anotados'}`;

  return (
    <div className="simple-card">
      <div className="simple-list-header">
        <h3 className="simple-section-title">Últimos Gastos</h3>
        <span className="simple-badge-count">{badgeLabel}</span>
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
          <button className="clear-search-btn" onClick={() => setSearchTerm('')} aria-label="Limpiar búsqueda">
            ✕
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="simple-empty-state">
          <p className="simple-empty-text">
            {expenses.length === 0
              ? 'No hay gastos anotados todavía. ¡Toca "Anotar Gasto" para comenzar!'
              : 'No se encontraron gastos con esa búsqueda.'}
          </p>
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
                  <div className="expense-amount-stack">
                    <span className="expense-item-amount">{formatCurrency(displayAmount)}</span>
                    {settings.enabled && constant !== nominal && (
                      <span className="expense-constant-hint" title="Monto nominal original">
                        Orig: {formatCurrency(nominal)}
                      </span>
                    )}
                  </div>
                  
                  {/* Botones de acción: Editar (Lápiz) y Borrar (Tacho) */}
                  <div className="expense-action-buttons">
                    <button
                      type="button"
                      className="btn-action-icon btn-edit-pencil"
                      title="Editar gasto"
                      aria-label={`Editar ${item.name}`}
                      onClick={() => onEditExpense(item)}
                    >
                      <Pencil size={17} />
                    </button>
                    
                    <button
                      type="button"
                      className="btn-action-icon btn-trash-delete"
                      title="Borrar gasto"
                      aria-label={`Borrar ${item.name}`}
                      onClick={() => setExpenseToDelete(item)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de confirmación estilizado sin alert nativo */}
      <ConfirmModal
        isOpen={Boolean(expenseToDelete)}
        title="¿Borrar este gasto?"
        message={`Se eliminará "${expenseToDelete?.name}" por ${formatCurrency(expenseToDelete?.amount || 0)}.`}
        confirmLabel="Sí, borrar"
        cancelLabel="Cancelar"
        isDestructive={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setExpenseToDelete(null)}
      />
    </div>
  );
};
