-- ============================================================================
-- FINANZAS DEL HOGAR - ESQUEMA CLOUDFLARE D1 (SQLite)
-- Diseñado para replicación en el Edge con resolución Last-Write-Wins (LWW)
-- ============================================================================

-- Tabla de Gastos por Hogar
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  notes TEXT,
  deleted_at INTEGER DEFAULT NULL,
  updated_at INTEGER NOT NULL
);

-- Índices para búsquedas y sincronizaciones ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_expenses_sync 
ON expenses (household_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_expenses_active 
ON expenses (household_id, deleted_at, timestamp DESC);

-- Tabla de Configuración de Inflación por Hogar
CREATE TABLE IF NOT EXISTS inflation_settings (
  household_id TEXT PRIMARY KEY,
  rates_json TEXT NOT NULL,
  base_month_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
