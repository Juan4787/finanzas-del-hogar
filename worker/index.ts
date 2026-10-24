/**
 * CLOUDFLARE WORKER - FINANZAS DEL HOGAR API (D1 SQLite)
 * Edge backend para sincronización multi-dispositivo y respaldo seguro en la nube.
 */

export interface Env {
  DB: D1Database;
}

interface IncomingExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  timestamp: string;
  notes?: string;
  deleted?: boolean;
  updatedAt?: number;
}

interface IncomingInflationSettings {
  rates: Record<string, number>;
  baseMonthKey: string;
  enabled: boolean;
  updatedAt?: number;
}

interface SyncRequestBody {
  householdId: string;
  since?: number;
  expenses?: IncomingExpense[];
  inflationSettings?: IncomingInflationSettings | null;
}

// Cabeceras CORS universales
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    try {
      // 1. Health check
      if (url.pathname === '/' || url.pathname === '/api/health') {
        return jsonResponse({
          status: 'ok',
          service: 'finanzas-hogar-d1',
          serverTime: Date.now(),
        });
      }

      // 2. GET /api/sync?householdId=...&since=...
      if (request.method === 'GET' && url.pathname === '/api/sync') {
        const householdId = url.searchParams.get('householdId')?.trim();
        if (!householdId) {
          return jsonResponse({ success: false, error: 'householdId es requerido' }, 400);
        }

        const since = parseInt(url.searchParams.get('since') || '0', 10) || 0;
        const now = Date.now();

        // Gastos actualizados o borrados después de 'since'
        const expensesQuery = await env.DB.prepare(
          `SELECT id, name, amount, category, timestamp, notes, deleted_at, updated_at
           FROM expenses
           WHERE household_id = ? AND updated_at > ?
           ORDER BY updated_at ASC`
        ).bind(householdId, since).all();

        // Configuración de inflación si cambió después de 'since'
        const inflationRow = await env.DB.prepare(
          `SELECT rates_json, base_month_key, enabled, updated_at
           FROM inflation_settings
           WHERE household_id = ? AND updated_at > ?`
        ).bind(householdId, since).first<{
          rates_json: string;
          base_month_key: string;
          enabled: number;
          updated_at: number;
        }>();

        const formattedExpenses = (expensesQuery.results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          amount: row.amount,
          category: row.category,
          timestamp: row.timestamp,
          notes: row.notes || undefined,
          deleted: Boolean(row.deleted_at),
          updatedAt: row.updated_at,
        }));

        let formattedInflation = null;
        if (inflationRow) {
          try {
            formattedInflation = {
              rates: JSON.parse(inflationRow.rates_json || '{}'),
              baseMonthKey: inflationRow.base_month_key,
              enabled: Boolean(inflationRow.enabled),
              updatedAt: inflationRow.updated_at,
            };
          } catch {
            formattedInflation = null;
          }
        }

        return jsonResponse({
          success: true,
          serverTime: now,
          expenses: formattedExpenses,
          inflationSettings: formattedInflation,
        });
      }

      // 3. POST /api/sync (Sincronización bidireccional atómica)
      if (request.method === 'POST' && url.pathname === '/api/sync') {
        let body: SyncRequestBody;
        try {
          body = await request.json() as SyncRequestBody;
        } catch {
          return jsonResponse({ success: false, error: 'JSON inválido' }, 400);
        }

        const householdId = body.householdId?.trim();
        if (!householdId || householdId.length < 3 || householdId.length > 64) {
          return jsonResponse({
            success: false,
            error: 'householdId inválido (debe tener entre 3 y 64 caracteres)',
          }, 400);
        }

        const since = body.since || 0;
        const now = Date.now();
        const batchStatements: D1PreparedStatement[] = [];

        // Upsert de gastos entrantes
        if (Array.isArray(body.expenses) && body.expenses.length > 0) {
          for (const exp of body.expenses) {
            if (!exp.id || !exp.name) continue;

            const updatedAt = exp.updatedAt || now;
            const deletedAt = exp.deleted ? (exp.updatedAt || now) : null;
            const amount = Math.round(Number(exp.amount) || 0);

            batchStatements.push(
              env.DB.prepare(
                `INSERT INTO expenses (id, household_id, name, amount, category, timestamp, notes, deleted_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   amount = excluded.amount,
                   category = excluded.category,
                   timestamp = excluded.timestamp,
                   notes = excluded.notes,
                   deleted_at = excluded.deleted_at,
                   updated_at = excluded.updated_at
                 WHERE excluded.updated_at >= expenses.updated_at
                   AND expenses.household_id = excluded.household_id`
              ).bind(
                exp.id,
                householdId,
                exp.name,
                amount,
                exp.category || 'Otros',
                exp.timestamp,
                exp.notes || null,
                deletedAt,
                updatedAt
              )
            );
          }
        }

        // Upsert de configuración de inflación si fue enviada
        if (body.inflationSettings) {
          const inf = body.inflationSettings;
          const updatedAt = inf.updatedAt || now;
          const ratesJson = JSON.stringify(inf.rates || {});

          batchStatements.push(
            env.DB.prepare(
              `INSERT INTO inflation_settings (household_id, rates_json, base_month_key, enabled, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(household_id) DO UPDATE SET
                 rates_json = excluded.rates_json,
                 base_month_key = excluded.base_month_key,
                 enabled = excluded.enabled,
                 updated_at = excluded.updated_at
               WHERE excluded.updated_at >= inflation_settings.updated_at`
            ).bind(
              householdId,
              ratesJson,
              inf.baseMonthKey || new Date().toISOString().slice(0, 7),
              inf.enabled ? 1 : 0,
              updatedAt
            )
          );
        }

        // Ejecución en lote en D1 (transaccional y atómica)
        if (batchStatements.length > 0) {
          await env.DB.batch(batchStatements);
        }

        // Obtener novedades generadas por otros dispositivos desde 'since'
        const serverExpensesQuery = await env.DB.prepare(
          `SELECT id, name, amount, category, timestamp, notes, deleted_at, updated_at
           FROM expenses
           WHERE household_id = ? AND updated_at > ?
           ORDER BY updated_at ASC`
        ).bind(householdId, since).all();

        const serverExpenses = (serverExpensesQuery.results || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          amount: row.amount,
          category: row.category,
          timestamp: row.timestamp,
          notes: row.notes || undefined,
          deleted: Boolean(row.deleted_at),
          updatedAt: row.updated_at,
        }));

        const serverInflationRow = await env.DB.prepare(
          `SELECT rates_json, base_month_key, enabled, updated_at
           FROM inflation_settings
           WHERE household_id = ? AND updated_at > ?`
        ).bind(householdId, since).first<{
          rates_json: string;
          base_month_key: string;
          enabled: number;
          updated_at: number;
        }>();

        let serverInflation = null;
        if (serverInflationRow) {
          try {
            serverInflation = {
              rates: JSON.parse(serverInflationRow.rates_json || '{}'),
              baseMonthKey: serverInflationRow.base_month_key,
              enabled: Boolean(serverInflationRow.enabled),
              updatedAt: serverInflationRow.updated_at,
            };
          } catch {
            serverInflation = null;
          }
        }

        return jsonResponse({
          success: true,
          serverTime: now,
          serverExpenses,
          serverInflationSettings: serverInflation,
        });
      }

      // Ruta no encontrada
      return jsonResponse({ success: false, error: 'Ruta no encontrada' }, 404);
    } catch (err: any) {
      console.error('Error en Cloudflare Worker:', err);
      return jsonResponse({
        success: false,
        error: err?.message || 'Error interno del servidor',
      }, 500);
    }
  },
};
