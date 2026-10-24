import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Expense } from '../types/finance';
import { getNowLocalISO, toLocalDateTimeInput, formatModalDatePreview } from '../utils/dateUtils';
import {
  normalizeCategoryName,
  getSuggestedCategory,
  getTopFrequentCategories,
} from '../utils/financeCalculations';
import { ArrowLeft, X, Check, Sparkles, Pencil } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveExpense: (expense: Expense) => void;
  allExpenses: Expense[];
  expenseToEdit?: Expense | null;
}

const DRAFT_KEY = 'finanzas_draft_expense_v1';

function readDraft(): { name: string; amountStr: string; categoryInput: string } {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    return {
      name: draft.name || '',
      amountStr: draft.amountStr || '',
      categoryInput: draft.categoryInput || '',
    };
  } catch {
    return { name: '', amountStr: '', categoryInput: '' };
  }
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onSaveExpense,
  allExpenses,
  expenseToEdit,
}) => {
  const isEditing = Boolean(expenseToEdit);

  const [name, setName] = useState(() =>
    expenseToEdit ? expenseToEdit.name : readDraft().name
  );
  const [amountStr, setAmountStr] = useState(() =>
    expenseToEdit ? String(Math.round(expenseToEdit.amount)) : readDraft().amountStr
  );
  const [categoryInput, setCategoryInput] = useState(() =>
    expenseToEdit ? expenseToEdit.category || '' : readDraft().categoryInput
  );
  const [timestamp, setTimestamp] = useState(() =>
    expenseToEdit ? toLocalDateTimeInput(expenseToEdit.timestamp) : getNowLocalISO()
  );
  const [showCustomDate, setShowCustomDate] = useState(false);

  const suggestedCat = useMemo(
    () => getSuggestedCategory(name, allExpenses),
    [name, allExpenses]
  );

  const amountInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Guardar borrador en tiempo real SOLO si estamos creando uno nuevo
  useEffect(() => {
    if (isOpen && !isEditing) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, amountStr, categoryInput }));
    }
  }, [name, amountStr, categoryInput, isOpen, isEditing]);

  if (!isOpen) return null;

  const topCategories = getTopFrequentCategories(allExpenses, 5);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanAmount = parseInt(amountStr.replace(/\D/g, ''), 10);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      amountInputRef.current?.focus();
      return;
    }

    const cleanName = name.trim();
    if (!cleanName) {
      nameInputRef.current?.focus();
      return;
    }

    const finalCategory = normalizeCategoryName(categoryInput.trim() || 'Otros');

    const expensePayload: Expense = {
      id: expenseToEdit ? expenseToEdit.id : `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      amount: cleanAmount,
      timestamp: timestamp || getNowLocalISO(),
      category: finalCategory,
    };

    onSaveExpense(expensePayload);

    // Limpiar borrador
    if (!isEditing) {
      localStorage.removeItem(DRAFT_KEY);
    }

    setName('');
    setAmountStr('');
    setCategoryInput('');

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try { navigator.vibrate(25); } catch {}
    }

    try {
      confetti({
        particleCount: 20,
        spread: 50,
        origin: { y: 0.85 },
        colors: ['#10b981', '#3b82f6', '#f59e0b'],
      });
    } catch {}

    onClose();
  };

  const getAmountFontSize = () => {
    const len = amountStr.length;
    if (len >= 8) return 'clamp(1.5rem, 5vw, 2rem)';
    if (len >= 6) return 'clamp(1.8rem, 6vw, 2.4rem)';
    if (len >= 4) return 'clamp(2.1rem, 7vw, 2.7rem)';
    return 'clamp(2.4rem, 8vw, 3.2rem)';
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
      <div
        className="modal-content mobile-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header-simple">
          <button className="btn-back-modal" onClick={onClose} aria-label="Volver atrás">
            <ArrowLeft size={20} />
            <span>Volver</span>
          </button>
          
          <div className="modal-title-with-icon">
            {isEditing && <Pencil size={18} className="text-emerald" />}
            <h2 className="modal-simple-title">
              {isEditing ? 'Editar Gasto' : 'Anotar Gasto'}
            </h2>
          </div>

          <button className="btn-close-simple" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-simple-form">
          {/* Monto fluido que se adapta a cualquier tamaño sin cortarse jamás */}
          <div className="simple-amount-card">
            <label className="simple-label">
              {isEditing ? 'Monto a modificar' : '¿Cuánto gastaste?'}
            </label>
            <div className="simple-amount-row-fluid">
              <span className="simple-currency-fluid">$</span>
              <input
                ref={amountInputRef}
                type="text"
                inputMode="numeric"
                placeholder="0"
                className="simple-amount-input-fluid"
                style={{ fontSize: getAmountFontSize() }}
                value={amountStr ? Number(amountStr).toLocaleString('es-AR') : ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const num = e.target.value.replace(/\D/g, '');
                  setAmountStr(num);
                }}
                required
              />
              {amountStr && (
                <button
                  type="button"
                  className="btn-input-clear-fluid"
                  title="Borrar monto"
                  aria-label="Borrar monto"
                  onClick={() => {
                    setAmountStr('');
                    amountInputRef.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Nombre / Concepto con botón para limpiar rápido */}
          <div className="simple-field">
            <label className="simple-label">¿En qué?</label>
            <div className="simple-input-with-clear">
              <input
                ref={nameInputRef}
                type="text"
                className="simple-input"
                placeholder="Ej: Coto, Nafta, Panadería, Farmacia"
                value={name}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setName(e.target.value)}
                required
              />
              {name && (
                <button
                  type="button"
                  className="btn-input-clear"
                  title="Borrar nombre"
                  aria-label="Borrar nombre"
                  onClick={() => {
                    setName('');
                    nameInputRef.current?.focus();
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Categoría simple con sugerencia */}
          <div className="simple-field">
            <label className="simple-label">Categoría <span className="label-sub">(opcional)</span></label>
            
            <div className="simple-input-with-clear">
              <input
                type="text"
                className="simple-input"
                placeholder={suggestedCat ? `Ej: ${suggestedCat}` : 'Opcional'}
                value={categoryInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!categoryInput.trim() && suggestedCat) {
                      setCategoryInput(suggestedCat);
                    } else {
                      handleSubmit();
                    }
                  }
                }}
              />
              {categoryInput && (
                <button
                  type="button"
                  className="btn-input-clear"
                  title="Borrar categoría"
                  aria-label="Borrar categoría"
                  onClick={() => setCategoryInput('')}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Sugerencia inteligente de 1 tap si no está en modo edición */}
            {!isEditing && suggestedCat && (
              <button
                type="button"
                className="simple-suggestion-pill"
                onClick={() => setCategoryInput(suggestedCat)}
              >
                <Sparkles size={14} className="text-amber" />
                <span>Sugerido: <strong>{suggestedCat}</strong> (toca para aplicar)</span>
              </button>
            )}

            <div className="simple-category-chips">
              {topCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`simple-chip ${categoryInput.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
                  onClick={() => setCategoryInput(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha / Hora discreta */}
          <div className="simple-date-row">
            {(() => {
              const { datePart, timePart } = formatModalDatePreview(timestamp);
              return (
                <span className="simple-date-text">
                  📅 Fecha: <strong>{datePart}</strong> a las <strong>{timePart} hs</strong>
                </span>
              );
            })()}
            <button
              type="button"
              className="simple-link-btn"
              onClick={() => setShowCustomDate(!showCustomDate)}
            >
              {showCustomDate ? 'Listo' : 'Cambiar fecha'}
            </button>
          </div>

          {showCustomDate && (
            <div className="simple-custom-date animate-fade-in">
              <input
                type="datetime-local"
                className="simple-input"
                value={timestamp}
                onChange={(e) => setTimestamp(e.target.value)}
              />
            </div>
          )}

          {/* Botón Guardar / Guardar Cambios */}
          <button type="submit" className="btn-simple-save">
            <Check size={22} />
            <span>{isEditing ? 'Guardar Cambios' : 'Guardar Gasto'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
