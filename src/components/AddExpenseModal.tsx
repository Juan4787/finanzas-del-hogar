import React, { useState, useEffect, useRef } from 'react';
import type { Expense } from '../types/finance';
import { getNowLocalISO } from '../utils/dateUtils';
import {
  normalizeCategoryName,
  getSuggestedCategory,
  getTopFrequentCategories,
} from '../utils/financeCalculations';
import { ArrowLeft, X, Check, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (expense: Expense) => void;
  allExpenses: Expense[];
}

const DRAFT_KEY = 'finanzas_draft_expense_v1';

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  onAddExpense,
  allExpenses,
}) => {
  // Cargar borrador previo si existe para que no se pierda al salir de la pantalla
  const [name, setName] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}').name || ''; } catch { return ''; }
  });
  const [amountStr, setAmountStr] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}').amountStr || ''; } catch { return ''; }
  });
  const [categoryInput, setCategoryInput] = useState(() => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}').categoryInput || ''; } catch { return ''; }
  });
  const [timestamp, setTimestamp] = useState(getNowLocalISO());
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [suggestedCat, setSuggestedCat] = useState('Otros');

  const amountInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Guardar borrador en tiempo real mientras escribe
  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, amountStr, categoryInput }));
    }
  }, [name, amountStr, categoryInput, isOpen]);

  // Al abrir el modal
  useEffect(() => {
    if (isOpen) {
      if (!timestamp) setTimestamp(getNowLocalISO());
      setShowCustomDate(false);
      setSuggestedCat(getSuggestedCategory(name, allExpenses));

      // Push history state para que el botón "Atrás" del celular cierre el modal en vez de salirse
      window.history.pushState({ modalOpen: true }, '');

      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const sug = getSuggestedCategory(name, allExpenses);
    setSuggestedCat(sug);
  }, [name, allExpenses]);

  if (!isOpen) return null;

  const topCategories = getTopFrequentCategories(allExpenses, 6);

  const handleCloseModal = () => {
    onClose();
  };

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

    const newExpense: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      amount: cleanAmount,
      timestamp: timestamp || getNowLocalISO(),
      category: finalCategory,
    };

    onAddExpense(newExpense);

    // Limpiar borrador al guardar exitosamente
    localStorage.removeItem(DRAFT_KEY);
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

  // Cálculo de tamaño de fuente fluido para que jamás se corte ningún número
  const getAmountFontSize = () => {
    const len = amountStr.length;
    if (len >= 8) return 'clamp(1.5rem, 5vw, 2rem)';
    if (len >= 6) return 'clamp(1.8rem, 6vw, 2.4rem)';
    if (len >= 4) return 'clamp(2.1rem, 7vw, 2.7rem)';
    return 'clamp(2.4rem, 8vw, 3.2rem)';
  };

  return (
    <div className="modal-overlay" onClick={handleCloseModal}>
      <div
        className="modal-content mobile-sheet animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="modal-header-simple">
          <button className="btn-back-modal" onClick={handleCloseModal} aria-label="Volver atrás">
            <ArrowLeft size={20} />
            <span>Volver</span>
          </button>
          <h2 className="modal-simple-title">Anotar Gasto</h2>
          <button className="btn-close-simple" onClick={handleCloseModal} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-simple-form">
          {/* Monto fluido que se adapta a cualquier tamaño sin cortarse jamás */}
          <div className="simple-amount-card">
            <label className="simple-label">¿Cuánto gastaste?</label>
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
                onChange={(e) => {
                  const num = e.target.value.replace(/\D/g, '');
                  setAmountStr(num);
                }}
                required
              />
            </div>
          </div>

          {/* Nombre / Concepto */}
          <div className="simple-field">
            <label className="simple-label">¿En qué?</label>
            <input
              ref={nameInputRef}
              type="text"
              className="simple-input"
              placeholder="Ej: Coto, Nafta, Panadería, Farmacia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Categoría simple con sugerencia */}
          <div className="simple-field">
            <label className="simple-label">Categoría <span className="label-sub">(opcional)</span></label>
            
            <input
              type="text"
              className="simple-input"
              placeholder={suggestedCat && suggestedCat !== 'Otros' ? `Ej: ${suggestedCat}` : 'Opcional'}
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (!categoryInput.trim() && suggestedCat && suggestedCat !== 'Otros') {
                    setCategoryInput(suggestedCat);
                  } else {
                    handleSubmit();
                  }
                }
              }}
            />

            {suggestedCat && suggestedCat.toLowerCase() !== 'otros' && (
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
            <span className="simple-date-text">
              📅 Fecha: <strong>{new Date(timestamp).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</strong> a las <strong>{new Date(timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</strong>
            </span>
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

          {/* Botón Guardar */}
          <button type="submit" className="btn-simple-save">
            <Check size={22} />
            <span>Guardar Gasto</span>
          </button>
        </form>
      </div>
    </div>
  );
};
