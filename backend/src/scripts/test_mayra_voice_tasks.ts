// backend/src/scripts/test_mayra_voice_tasks.ts
import { prisma } from '../lib/prisma';
import { MayraVoiceTaskService } from '../services/MayraVoiceTaskService';

async function runTest() {
  console.log('🧪 Iniciando pruebas de MayraVoiceTaskService...\n');

  // 1. Obtener usuario Mayra
  const mayra = await prisma.user.findFirst({ where: { role: 'ADMIN_MAYRA' } });
  if (!mayra) {
    console.error('❌ No se encontró usuario ADMIN_MAYRA');
    process.exit(1);
  }

  const mayraPhone = mayra.phone || '0967491847';

  // Test Case 1: Saludo genérico (NO debe crear tarea)
  console.log('Test 1: Evaluando saludo ("Hola chicas, buenos días, hoy llego tarde")...');
  const res1 = await MayraVoiceTaskService.processMayraMessage({
    mayraUser: { id: mayra.id, fullName: mayra.fullName },
    mayraPhone,
    rawText: 'Hola chicas, buenos días, hoy llego a las 11 al estudio',
  });
  console.log(`Resultado 1: isTask=${res1.created} (Esperado: false) -> ${!res1.created ? '✅ PASÓ' : '❌ FALLÓ'}`);

  // Test Case 2: Orden explícita con cliente y trámite (DEBE crear tarea)
  console.log('\nTest 2: Evaluando orden ("Por favor chicas hacer la declaración de IVA de Pedro Delgado para hoy")...');
  const res2 = await MayraVoiceTaskService.processMayraMessage({
    mayraUser: { id: mayra.id, fullName: mayra.fullName },
    mayraPhone,
    rawText: 'Por favor chicas hacer la declaración de IVA de Pedro Delgado para hoy que ya vence',
    audioUrl: 'https://boveda.mayracastillo.com/audios/nota_voz_mayra_test.ogg',
    audioFileName: 'nota_voz_mayra_test.ogg',
  });
  console.log(`Resultado 2: isTask=${res2.created} (Esperado: true) -> ${res2.created ? '✅ PASÓ' : '❌ FALLÓ'}`);
  if (res2.created) {
    console.log(`   📌 Título: "${res2.task.title}"`);
    console.log(`   ⚡ Prioridad: "${res2.task.priority}"`);
    console.log(`   👤 Asignado a ID: ${res2.task.assignedToId}`);
    console.log(`   📎 Audio URL: ${res2.task.fileUrl}`);

    // Limpieza de prueba
    await prisma.task.delete({ where: { id: res2.task.id } });
    console.log('   🧹 Tarea de prueba eliminada de la base de datos.');
  }

  // Test Case 3: Instrucción con asistente específica
  console.log('\nTest 3: Evaluando orden con asignación ("Asistente 1 revisar la clave del SRI de Darma que no entra")...');
  const res3 = await MayraVoiceTaskService.processMayraMessage({
    mayraUser: { id: mayra.id, fullName: mayra.fullName },
    mayraPhone,
    rawText: 'Asistente 1 por favor revisar la clave del SRI de Darma que cambiaron y no podemos entrar',
  });
  console.log(`Resultado 3: isTask=${res3.created} (Esperado: true) -> ${res3.created ? '✅ PASÓ' : '❌ FALLÓ'}`);
  if (res3.created) {
    console.log(`   📌 Título: "${res3.task.title}"`);
    console.log(`   👤 Asignada a: "${res3.task.assignedTo?.fullName}"`);

    // Limpieza de prueba
    await prisma.task.delete({ where: { id: res3.task.id } });
    console.log('   🧹 Tarea de prueba eliminada de la base de datos.');
  }

  console.log('\n🎉 Todas las pruebas unitarias completadas.');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Error en pruebas:', err);
  process.exit(1);
});
