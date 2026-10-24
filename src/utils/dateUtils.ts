/**
 * Utilidades de fecha y períodos para Finanzas Del Hogar
 */

/**
 * Obtiene la fecha y hora actual en formato local 'YYYY-MM-DDTHH:mm'
 * listo para alimentar un <input type="datetime-local">.
 */
export function getNowLocalISO(): string {
  return toLocalDateTimeInput(new Date());
}

/**
 * Convierte cualquier Date o string ISO a formato local 'YYYY-MM-DDTHH:mm'
 * compatible con <input type="datetime-local">.
 */
export function toLocalDateTimeInput(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const hours = String(validDate.getHours()).padStart(2, '0');
  const minutes = String(validDate.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Obtiene la fecha local actual en formato 'YYYY-MM-DD'
 * para alimentar <input type="date"> sin desfase UTC.
 */
export function getTodayDateInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formatea de manera segura la vista previa de fecha y hora en el modal
 */
export function formatModalDatePreview(isoString: string): { datePart: string; timePart: string } {
  const parsed = isoString ? new Date(isoString) : new Date();
  const validDate = isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    datePart: validDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
    timePart: validDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/**
 * Formatea un timestamp ISO para mostrar en listas (ej: "23 oct 2026, 16:20 hs")
 */
export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

  if (isToday) {
    return `Hoy, ${timeStr} hs`;
  }
  if (isYesterday) {
    return `Ayer, ${timeStr} hs`;
  }

  const dateStr = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  return `${dateStr}, ${timeStr} hs`;
}

/**
 * Rango para "Hoy"
 */
export function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Rango para "Ayer"
 */
export function getYesterdayRange(): { start: string; end: string } {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
  const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Rango para "Esta Semana" (Lunes a Domingo actual)
 */
export function getThisWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay(); // 0 es domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday.toISOString(), end: sunday.toISOString() };
}

/**
 * Rango para "Semana Anterior"
 */
export function getLastWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day === 0 ? -6 : 1 - day) - 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday.toISOString(), end: sunday.toISOString() };
}

/**
 * Rango para "Este Mes"
 */
export function getThisMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: nextMonth.toISOString() };
}

/**
 * Rango para "Mes Anterior"
 */
export function getLastMonthRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Convierte un rango 'YYYY-MM-DD' a ISO start y end.
 * Si el usuario invierte el orden (inicio > fin), los intercambia automáticamente.
 */
export function dateInputToRange(startDateInput: string, endDateInput: string): { start: string; end: string } {
  const [sy, sm, sd] = (startDateInput || getTodayDateInput()).split('-').map(Number);
  const [ey, em, ed] = (endDateInput || getTodayDateInput()).split('-').map(Number);

  const d1 = new Date(sy, (sm || 1) - 1, sd || 1);
  const d2 = new Date(ey, (em || 1) - 1, ed || 1);

  const earlier = d1.getTime() <= d2.getTime() ? d1 : d2;
  const later = d1.getTime() <= d2.getTime() ? d2 : d1;

  const start = new Date(earlier.getFullYear(), earlier.getMonth(), earlier.getDate(), 0, 0, 0, 0);
  const end = new Date(later.getFullYear(), later.getMonth(), later.getDate(), 23, 59, 59, 999);

  return { start: start.toISOString(), end: end.toISOString() };
}
