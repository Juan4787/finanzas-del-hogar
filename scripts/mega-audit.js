/**
 * MEGA AUDITORÍA EXHAUSTIVA DE CÁLCULOS FINANCIEROS Y LÓGICA DE NEGOCIO
 * Antigravity - Finanzas Del Hogar PWA
 */

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

let passed = 0;
let failed = 0;

function check(testName, condition, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}: ${details}`);
    failed++;
  }
}

console.log('================================================================');
console.log('🔬 GIGA AUDITORÍA FINANCIERA, MATEMÁTICA Y DE INTEGRIDAD');
console.log('================================================================\n');

// 1. AUDITORÍA DE NORMALIZACIÓN DE CATEGORÍAS
console.log('--- 1. NORMALIZACIÓN ESTRICTA DE CATEGORÍAS ---');
const n1 = normalizeCategoryName('nafta');
const n2 = normalizeCategoryName('Nafta');
const n3 = normalizeCategoryName('NAFTA');
const n4 = normalizeCategoryName('   nafta   ');
check('Normalización de nafta a Title Case', n1 === 'Nafta', `Obtenido: ${n1}`);
check('Todas las variantes de mayúsculas/minúsculas convergen a la misma categoría', n1 === n2 && n2 === n3 && n3 === n4);

const c1 = normalizeCategoryName('comida de mascotas');
const c2 = normalizeCategoryName('Comida De Mascotas');
const c3 = normalizeCategoryName('COMIDA DE MASCOTAS');
check('Normalización de palabras compuestas (Comida De Mascotas)', c1 === 'Comida De Mascotas' && c1 === c2 && c2 === c3);

const abl = normalizeCategoryName('ABL');
check('Preservación de siglas en mayúscula (ABL)', abl === 'ABL', `Obtenido: ${abl}`);

check('Categoría vacía resulta en "Otros"', normalizeCategoryName('') === 'Otros');
check('Categoría con espacios vacíos resulta en "Otros"', normalizeCategoryName('   ') === 'Otros');
check('Categoría nula o indefinida resulta en "Otros"', normalizeCategoryName(null) === 'Otros');

// 2. AUDITORÍA DE ÍNDICES DE PRECIOS Y PRECIOS CONSTANTES
console.log('\n--- 2. FÓRMULAS DE INFLACIÓN Y PRECIOS CONSTANTES ---');
const monthlyRates = {
  '2026-05': 10.0, // Base
  '2026-06': 5.0,  // +5%
  '2026-07': 4.0,  // +4%
  '2026-08': 2.5,  // +2.5%
  '2026-09': 3.0,  // +3.0%
  '2026-10': 3.5,  // +3.5%
};
const months = Object.keys(monthlyRates).sort();
const indices = computeCumulativePriceIndices(monthlyRates, months);

check('Mes inicial (2026-05) tiene IPC = 100.0', Math.abs(indices['2026-05'] - 100.0) < 0.0001);

// 2026-06: 100 * 1.05 = 105.0
check('Segundo mes (2026-06) acumulado exacto = 105.0', Math.abs(indices['2026-06'] - 105.0) < 0.0001);

// 2026-07: 105 * 1.04 = 109.2
check('Tercer mes (2026-07) acumulado exacto = 109.2', Math.abs(indices['2026-07'] - 109.2) < 0.0001);

// Factor del mismo mes
const fSame = getInflationFactor('2026-10', '2026-10', indices).factor;
check('Factor del mismo mes de referencia es exactamente 1.0', fSame === 1.0);

// Factor de Mayo a Octubre
const fMayToOct = getInflationFactor('2026-05', '2026-10', indices).factor;
const expectedFactor = indices['2026-10'] / indices['2026-05'];
check('Factor de conversión Mayo a Octubre coincide matemáticamente con IPC_base / IPC_origen', Math.abs(fMayToOct - expectedFactor) < 0.0001);

// Gasto real de $50.000 de Mayo en precios de Octubre
const nominalMay = 50000;
const realMayInOct = Math.round(nominalMay * fMayToOct);
check('El gasto histórico se ajusta hacia arriba reflejando la pérdida de valor adquisitivo de la moneda', realMayInOct > nominalMay);
check('El monto constante resultante es estrictamente un número entero (sin centavos)', Number.isInteger(realMayInOct));

// 3. AUDITORÍA DE COMPARACIÓN DE PERÍODOS Y PARADOJA INFLACIONARIA
console.log('\n--- 3. COMPARACIÓN DE PERÍODOS (NOMINAL VS REAL) ---');
// Simulación:
// Período A (anterior): $ 100.000 nominal
// Inflación: 20%
// Período B (actual): $ 110.000 nominal
// Nominalmente parece que gastó $10.000 más (+10%).
// Pero a precios reales de B, los $100.000 de A equivalían a $120.000!
// Por ende, en términos reales el gasto CAYÓ de $120.000 a $110.000 (Ahorro real de $10.000 / -8.33%)!
const gastoNominalA = 100000;
const gastoNominalB = 110000;
const factorAtoB = 1.20; // 20% de inflación

const gastoRealA = Math.round(gastoNominalA * factorAtoB); // 120.000
const gastoRealB = gastoNominalB; // 110.000

const deltaNominal = gastoNominalB - gastoNominalA; // +10.000
const deltaReal = gastoRealB - gastoRealA; // -10.000

check('Detección correcta de la ilusión monetaria nominal vs real', deltaNominal > 0 && deltaReal < 0);
check('El ahorro real es de exactamente $ 10.000 a precios constantes', deltaReal === -10000);

// 4. AUDITORÍA DE DESGLOSE DE CATEGORÍAS Y SUMAS
console.log('\n--- 4. INTEGRIDAD DE SUMAS Y PORCENTAJES ---');
const sampleExpenses = [
  { id: '1', name: 'Super', amount: 35000, category: 'Supermercado' },
  { id: '2', name: 'Gym', amount: 20000, category: 'Gimnasio' },
  { id: '3', name: 'Edenor', amount: 15000, category: 'Electricidad' },
  { id: '4', name: 'Metrogas', amount: 10000, category: 'Gas' },
  { id: '5', name: 'Alimento Perro', amount: 20000, category: 'Comida De Mascotas' },
];

const totalSum = sampleExpenses.reduce((acc, e) => acc + e.amount, 0);
check('Suma de gastos coincide exactamente con la suma individual ($ 100.000)', totalSum === 100000);

const percentages = sampleExpenses.map(e => (e.amount / totalSum) * 100);
const sumPct = percentages.reduce((acc, p) => acc + p, 0);
check('La suma de porcentajes de las categorías totaliza exactamente el 100%', Math.abs(sumPct - 100.0) < 0.001);

// 5. AUDITORÍA DE DIVISIÓN POR CERO EN COMPARACIONES
console.log('\n--- 5. CASOS BORDE Y ROBUSTEZ ---');
const prevZero = 0;
const currentAmount = 50000;
const safeDiffPct = prevZero > 0 ? ((currentAmount - prevZero) / prevZero) * 100 : 0;
check('Manejo seguro de división por cero cuando el período anterior es $0', !isNaN(safeDiffPct) && isFinite(safeDiffPct));

console.log('\n================================================================');
console.log(`🏆 RESULTADO MEGA AUDITORÍA: ${passed} pasadas, ${failed} fallidas`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
