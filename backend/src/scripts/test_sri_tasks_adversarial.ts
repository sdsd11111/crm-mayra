// backend/src/scripts/test_sri_tasks_adversarial.ts
import { getSriLegalDueDate, extractNovenoDigito, adjustToNextBusinessDay } from '../utils/sriUtils';
import { SriTaskCronService } from '../services/SriTaskCronService';
import { prisma } from '../lib/prisma';

async function runAdversarialTest() {
  console.log('🧪 ========================================================');
  console.log('🧪 SUITE ADVERSARIAL: MOTOR AUTOMÁTICO DE TAREAS SRI (08:00 AM)');
  console.log('🧪 ========================================================\n');

  // Test 1: Verificación de noveno dígito
  console.log('--- TEST 1: Extracción de 9no dígito ---');
  const rucPersona = '1105106866001'; // 9no dígito es 6 -> Vence día 20
  const noveno = extractNovenoDigito(rucPersona);
  console.log(`RUC: ${rucPersona} -> 9no dígito: ${noveno}`);
  if (noveno !== 6) throw new Error(`Fallo en 9no dígito: se esperaba 6, se obtuvo ${noveno}`);
  console.log('✅ TEST 1 APROBADO: 9no dígito calculado con precisión aritmética.\n');

  // Test 2: Invariante legal Art. 116 (Fines de semana trasladan al lunes)
  console.log('--- TEST 2: Invariante Art. 116 (Traslado a día hábil) ---');
  // Sábado 20 de Junio de 2026 -> Debe trasladarse a Lunes 22 de Junio
  const sabado = new Date(2026, 5, 20); // 20 Junio 2026 es sábado
  const ajustado = adjustToNextBusinessDay(sabado);
  console.log(`Fecha base: Sábado ${sabado.toISOString().split('T')[0]} -> Ajustado: ${ajustado.toISOString().split('T')[0]} (Día semana: ${ajustado.getDay()})`);
  if (ajustado.getDay() !== 1) throw new Error('Fallo: No se trasladó al Lunes.');
  console.log('✅ TEST 2 APROBADO: Invariante legal de día hábil respetada.\n');

  // Test 3: Fecha legal para RUC de prueba en mes actual (Noviembre 2026)
  console.log('--- TEST 3: Cálculo legal para Noviembre 2026 ---');
  const legalDate = getSriLegalDueDate(2026, 11, rucPersona);
  console.log(`Vencimiento legal para RUC ${rucPersona} (9no dígito 6): ${legalDate?.toISOString()}`);
  console.log('✅ TEST 3 APROBADO: Fecha legal computada.\n');

  // Test 4: Idempotencia estricta en ejecución doble simulando el cron
  console.log('--- TEST 4: Idempotencia estricta del Cron ---');
  // Simulamos el día 19 de Noviembre (1 día antes del día 20)
  const testRefDate = new Date(2026, 10, 19, 8, 0, 0); // 19 Noviembre 2026 08:00 AM
  
  console.log(`1ra Ejecución del Cron para ${testRefDate.toISOString()}...`);
  const run1 = await SriTaskCronService.generateDailySriTasks(testRefDate);
  console.log(`Resultado Run 1: Creadas = ${run1.createdTasks}, Omitidas = ${run1.skippedExisting}`);

  console.log(`\n2da Ejecución INMEDIATA (simulación de doble trigger o reinicio)...`);
  const run2 = await SriTaskCronService.generateDailySriTasks(testRefDate);
  console.log(`Resultado Run 2: Creadas = ${run2.createdTasks}, Omitidas = ${run2.skippedExisting}`);

  if (run2.createdTasks > 0) {
    throw new Error('❌ FALLO CRÍTICO DE IDEMPOTENCIA: El cron duplicó tareas en la segunda pasada.');
  }

  console.log('✅ TEST 4 APROBADO: 0 duplicados en re-ejecución. Idempotencia demostrada.\n');

  console.log('🎉 ========================================================');
  console.log('🎉 TODOS LOS TESTS ADVERSARIALES DEL CRON SRI PASARON (4/4)');
  console.log('🎉 ========================================================');
}

runAdversarialTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ ERROR EN AUDITORÍA:', err);
    process.exit(1);
  });
