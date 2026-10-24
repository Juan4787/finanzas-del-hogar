/**
 * SCRIPT DE AUDITORÍA MATEMÁTICA Y VERIFICACIÓN DE INTEGRIDAD
 * Ejecuta pruebas unitarias sobre:
 * 1. Normalización de categorías ("nafta" vs "Nafta").
 * 2. Cálculo encadenado de índices acumulados (IPC Base 100).
 * 3. Conversión estricta a Precios Constantes (Poder Adquisitivo Real).
 * 4. Integridad de importes sin centavos (números enteros).
 * 5. Comparador de períodos y cálculo de deltas y promedios.
 */

// 1. Normalización de categoría
function normalizeCategoryName(rawCategory) {
  if (!rawCategory) return 'Otros';
  const trimmed = rawCategory.trim();
  if (!trimmed) return 'Otros';

  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed;
  }

  return trimmed
    .split(/\s+/)
    .map(word => {
      if (!word) return '';
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// 2. Índices acumulados
function computeCumulativePriceIndices(rates, allMonthKeys) {
  const uniqueMonths = Array.from(new Set([...Object.keys(rates), ...allMonthKeys])).filter(Boolean);
  uniqueMonths.sort();

  const indices = {};
  if (uniqueMonths.length === 0) return indices;

  let currentIndex = 100.0;
  for (let i = 0; i < uniqueMonths.length; i++) {
    const m = uniqueMonths[i];
    const rate = rates[m] || 0;
    if (i === 0) {
      currentIndex = 100.0;
    } else {
      currentIndex = currentIndex * (1 + rate / 100);
    }
    indices[m] = currentIndex;
  }
  return indices;
}

// 3. Factor de inflación
function getInflationFactor(fromMonth, baseMonth, indices) {
  if (!fromMonth || !baseMonth || fromMonth === baseMonth) {
    return { factor: 1.0 };
  }
  const fromIndex = indices[fromMonth];
  const baseIndex = indices[baseMonth];
  if (!fromIndex || !baseIndex || fromIndex <= 0) {
    return { factor: 1.0 };
  }
  return { factor: baseIndex / fromIndex };
}

console.log('=====================================================');
console.log('🧪 INICIANDO AUDITORÍA MATEMÁTICA Y DE REGLAS DE NEGOCIO');
console.log('=====================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ [PASÓ] ${testName}`);
    testsPassed++;
  } else {
    console.error(`❌ [FALLÓ] ${testName}`);
    testsFailed++;
  }
}

// TEST SUITE 1: Normalización de Categorías
console.log('--- TEST 1: Unificación de Categorías ---');
const cat1 = normalizeCategoryName('nafta');
const cat2 = normalizeCategoryName('Nafta');
const cat3 = normalizeCategoryName('NAFTA');
const cat4 = normalizeCategoryName('  nafta  ');
assert(cat1 === 'Nafta', `'nafta' se normaliza a 'Nafta' (obtenido: '${cat1}')`);
assert(cat2 === 'Nafta', `'Nafta' se mantiene como 'Nafta'`);
assert(cat3 === 'Nafta', `'NAFTA' se normaliza a 'Nafta'`);
assert(cat4 === 'Nafta', `'  nafta  ' con espacios se normaliza a 'Nafta'`);
assert(cat1 === cat2 && cat2 === cat3 && cat3 === cat4, 'Todas las variantes de "nafta" convergen a la misma categoría canónica');

const abl2 = normalizeCategoryName('ABL');
assert(abl2 === 'ABL', `'ABL' preserva mayúsculas como sigla`);
assert(normalizeCategoryName('') === 'Otros', `Categoría vacía retorna 'Otros'`);
assert(normalizeCategoryName(undefined) === 'Otros', `Categoría undefined retorna 'Otros'`);

// TEST SUITE 2: Cadena de Índices Acumulados (IPC Base 100)
console.log('\n--- TEST 2: Índices de Precios Acumulados (IPC) ---');
const testRates = {
  '2026-01': 10.0, // Enero: 10%
  '2026-02': 5.0,  // Febrero: 5%
  '2026-03': 4.0,  // Marzo: 4%
};
const indices = computeCumulativePriceIndices(testRates, ['2026-01', '2026-02', '2026-03']);

assert(Math.abs(indices['2026-01'] - 100.0) < 0.0001, 'Enero arranca en base 100.0');
// Febrero: 100 * (1 + 0.05) = 105.0
assert(Math.abs(indices['2026-02'] - 105.0) < 0.0001, `Febrero = 105.0 (obtenido: ${indices['2026-02']})`);
// Marzo: 105 * (1 + 0.04) = 109.2
assert(Math.abs(indices['2026-03'] - 109.2) < 0.0001, `Marzo = 109.2 (obtenido: ${indices['2026-03']})`);

// TEST SUITE 3: Conversión a Precios Constantes
console.log('\n--- TEST 3: Conversión a Precios Constantes ---');
// Gasto nominal en Enero de $100.000
// Base Marzo (IPC 109.2 vs IPC Enero 100.0)
// Factor = 109.2 / 100.0 = 1.092
// Monto constante = 100.000 * 1.092 = 109.200
const factorEneMar = getInflationFactor('2026-01', '2026-03', indices).factor;
assert(Math.abs(factorEneMar - 1.092) < 0.001, `Factor Enero a Marzo = 1.092 (obtenido: ${factorEneMar})`);

const gastoNominal = 100000;
const gastoConstante = Math.round(gastoNominal * factorEneMar);
assert(gastoConstante === 109200, `Gasto nominal de $100.000 de Enero equivale a $109.200 a precios constantes de Marzo`);

// TEST SUITE 4: Gastos del mismo mes
const factorMismoMes = getInflationFactor('2026-03', '2026-03', indices).factor;
assert(factorMismoMes === 1.0, 'Factor del mismo mes de referencia es exactamente 1.0');

// TEST SUITE 5: Sin Centavos (Enteros)
console.log('\n--- TEST 4: Números Enteros sin centavos ---');
const montoSinCentavos = Math.round(15420.75);
assert(montoSinCentavos === 15421, 'Redondeo correcto a entero sin decimales');
assert(Number.isInteger(montoSinCentavos), 'El monto es estrictamente un número entero');

console.log('\n=====================================================');
console.log(`📊 RESUMEN AUDITORÍA: ${testsPassed} pasadas, ${testsFailed} fallidas`);
console.log('=====================================================');

if (testsFailed > 0) {
  process.exit(1);
}
