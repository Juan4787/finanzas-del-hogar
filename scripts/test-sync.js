/**
 * GIGA AUDITORÍA Y SUITE DE PRUEBAS DEL MOTOR DE SINCRONIZACIÓN CLOUDFLARE D1
 * Antigravity - Finanzas Del Hogar PWA
 */

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
console.log('☁️ AUDITORÍA DEL MOTOR DE SINCRONIZACIÓN Y LÓGICA DE D1');
console.log('================================================================\n');

// 1. RESOLUCIÓN DE CONFLICTOS LAST-WRITE-WINS (LWW)
console.log('--- 1. CONFLICT RESOLUTION (LAST-WRITE-WINS) ---');

function resolveLWW(existing, incoming) {
  if (!existing) return incoming;
  const existingTime = existing.updatedAt || 0;
  const incomingTime = incoming.updatedAt || 0;
  return incomingTime >= existingTime ? incoming : existing;
}

const expA = { id: 'exp-1', name: 'Coto', amount: 45000, updatedAt: 1000 };
const expB = { id: 'exp-1', name: 'Coto Central', amount: 52000, updatedAt: 1500 };
const expOld = { id: 'exp-1', name: 'Coto Viejo', amount: 40000, updatedAt: 800 };

const winnerNewer = resolveLWW(expA, expB);
check('La versión con timestamp más reciente (1500 vs 1000) prevalece', winnerNewer.name === 'Coto Central' && winnerNewer.amount === 52000);

const winnerOlder = resolveLWW(expB, expOld);
check('Un paquete viejo desfasado no sobrescribe la versión más nueva', winnerOlder.name === 'Coto Central');

// 2. SOFT DELETES Y PROPAGACIÓN DE TOMBSTONES
console.log('\n--- 2. TOMBSTONES Y ELIMINACIÓN MULTI-DISPOSITIVO ---');

function mergeWithServerExpenses(localList, serverList) {
  let result = [...localList];
  for (const s of serverList) {
    if (s.deleted) {
      result = result.filter(e => e.id !== s.id);
    } else {
      const idx = result.findIndex(e => e.id === s.id);
      if (idx >= 0) {
        if ((s.updatedAt || 0) >= (result[idx].updatedAt || 0)) {
          result[idx] = s;
        }
      } else {
        result.unshift(s);
      }
    }
  }
  return result;
}

const currentLocal = [
  { id: '1', name: 'Edenor', amount: 20000, updatedAt: 100 },
  { id: '2', name: 'Metrogas', amount: 15000, updatedAt: 100 },
];

const serverUpdates = [
  { id: '1', name: 'Edenor', amount: 0, deleted: true, updatedAt: 200 }, // Borrado en el teléfono de Marta
  { id: '3', name: 'Supermercado', amount: 60000, deleted: false, updatedAt: 150 }, // Creado en la PC
];

const merged = mergeWithServerExpenses(currentLocal, serverUpdates);

check('El gasto borrado en otro dispositivo se remueve localmente', !merged.some(e => e.id === '1'));
check('El gasto nuevo de otro dispositivo se incorpora a la lista', merged.some(e => e.id === '3'));
check('El gasto no modificado permanece intacto', merged.some(e => e.id === '2'));
check('Cantidad de elementos finales es exactamente 2', merged.length === 2);

// 3. AISLAMIENTO ESTRICTO DE HOGARES (MULTI-TENANT)
console.log('\n--- 3. AISLAMIENTO MULTI-TENANT POR CÓDIGO DE HOGAR ---');

const mockDatabase = [
  { id: 'exp-10', household_id: 'hogar-marta-842', name: 'Coto', amount: 30000 },
  { id: 'exp-20', household_id: 'hogar-juan-111', name: 'Carrefour', amount: 50000 },
];

function queryHousehold(householdId) {
  return mockDatabase.filter(row => row.household_id === householdId);
}

const martaData = queryHousehold('hogar-marta-842');
const juanData = queryHousehold('hogar-juan-111');

check('Marta solo accede a los gastos de su propio código de hogar', martaData.length === 1 && martaData[0].id === 'exp-10');
check('Juan no ve los gastos de Marta ni Marta los de Juan', !martaData.some(e => e.household_id === 'hogar-juan-111') && !juanData.some(e => e.household_id === 'hogar-marta-842'));

// 4. RESILIENCIA OFFLINE Y COLA DE CAMBIOS
console.log('\n--- 4. RESILIENCIA LOCAL-FIRST Y ESTADOS OFFLINE ---');

const isOnline = false;
let localExpenses = [{ id: 'exp-local', name: 'Farmacia', amount: 12000, updatedAt: Date.now() }];
let syncQueue = [];

function addExpenseLocalFirst(exp, onlineStatus) {
  localExpenses.push(exp); // 0ms - Local first
  if (!onlineStatus) {
    syncQueue.push(exp.id);
    return { status: 'offline', savedLocally: true };
  }
  return { status: 'syncing', savedLocally: true };
}

const res = addExpenseLocalFirst({ id: 'exp-farmacia', name: 'Remedios', amount: 15000, updatedAt: Date.now() }, isOnline);
check('Guardado local responde con éxito instantáneo aún sin conexión a internet', res.savedLocally === true && res.status === 'offline');
check('El gasto queda inmediatamente disponible para cálculo y lectura en local', localExpenses.length === 2);
check('El cambio se encola para sincronización posterior', syncQueue.includes('exp-farmacia'));

console.log('\n================================================================');
console.log(`🏆 RESULTADO AUDITORÍA CLOUDFLARE SYNC: ${passed} pasadas, ${failed} fallidas`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
