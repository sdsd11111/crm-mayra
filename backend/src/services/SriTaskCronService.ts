// backend/src/services/SriTaskCronService.ts
import { prisma } from '../lib/prisma';
import { getSriLegalDueDate, extractNovenoDigito } from '../utils/sriUtils';

let ioInstance: any = null;

export interface SriTaskRunResult {
  evaluated: number;
  createdTasks: number;
  skippedExisting: number;
  errors: number;
  details: Array<{
    taxpayer: string;
    ruc: string;
    dueDate: string;
    action: 'CREATED' | 'SKIPPED_EXISTING' | 'NOT_DUE';
  }>;
}

export class SriTaskCronService {
  public static setSocketIo(io: any) {
    ioInstance = io;
  }

  /**
   * Genera de forma automática e idempotente las tareas tributarias
   * para los contribuyentes cuyo vencimiento legal del SRI es HOY o MAÑANA.
   *
   * @param referenceDate Fecha de evaluación (por defecto: ahora en Ecuador)
   */
  public static async generateDailySriTasks(referenceDate: Date = new Date()): Promise<SriTaskRunResult> {
    // Normalizar a zona horaria de Ecuador (UTC-5)
    const ecDateStr = referenceDate.toLocaleString('en-US', { timeZone: 'America/Guayaquil' });
    const ecNow = new Date(ecDateStr);

    const year = ecNow.getFullYear();
    const month = ecNow.getMonth() + 1; // 1-12

    // Inicio y fin de HOY en Ecuador
    const startOfToday = new Date(ecNow);
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date(ecNow);
    endOfToday.setHours(23, 59, 59, 999);

    // Inicio y fin de MAÑANA en Ecuador
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const endOfTomorrow = new Date(endOfToday);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);

    console.log(`⚡ [SriTaskCronService] Evaluando tareas SRI para fecha Ecuador: ${startOfToday.toISOString().split('T')[0]}`);

    // 1. Obtener usuarios para asignación (Mayra como supervisora y asistentes operativas)
    const [mayra, assistants] = await Promise.all([
      prisma.user.findFirst({ where: { role: 'ADMIN_MAYRA' } }),
      prisma.user.findMany({ where: { role: 'ASISTENTE', isActive: true } }),
    ]);

    if (!mayra) {
      console.error('❌ [SriTaskCronService] No se encontró la cuenta principal de ADMIN_MAYRA.');
      return { evaluated: 0, createdTasks: 0, skippedExisting: 0, errors: 1, details: [] };
    }

    // 2. Obtener contribuyentes activos con RUC
    const taxpayers = await prisma.taxpayer.findMany({
      where: {
        ruc: { not: null },
      },
      include: {
        clientOwner: { select: { id: true, fullName: true, whatsappPhone: true } },
      },
    });

    let createdTasks = 0;
    let skippedExisting = 0;
    let errors = 0;
    const details: SriTaskRunResult['details'] = [];

    let assistantRoundRobin = 0;

    for (const t of taxpayers) {
      if (!t.ruc || t.ruc.trim().length < 9) continue;

      // Calcular fecha legal del SRI para este mes
      const legalDueDate = getSriLegalDueDate(year, month, t.ruc);
      if (!legalDueDate) continue;

      const isDueToday = legalDueDate >= startOfToday && legalDueDate <= endOfToday;

      // El aviso y la tarea se generan únicamente el DÍA EXACTO de la obligación (a las 08:00 AM)
      if (!isDueToday) {
        details.push({
          taxpayer: t.razonSocial,
          ruc: t.ruc,
          dueDate: legalDueDate.toISOString().split('T')[0],
          action: 'NOT_DUE',
        });
        continue;
      }

      const periodKey = `${year}-${String(month).padStart(2, '0')}`;
      const noveno = extractNovenoDigito(t.ruc);
      const obligationTitle = `⚡ Declaración SRI: ${t.razonSocial}`;

      // 3. IDEMPOTENCIA: Verificar si ya existe una tarea creada para este contribuyente y período
      const existingTask = await prisma.task.findFirst({
        where: {
          title: { contains: t.razonSocial },
          description: { contains: periodKey },
        },
      });

      if (existingTask) {
        skippedExisting++;
        details.push({
          taxpayer: t.razonSocial,
          ruc: t.ruc,
          dueDate: legalDueDate.toISOString().split('T')[0],
          action: 'SKIPPED_EXISTING',
        });
        continue;
      }

      // 4. Asignación inteligente: repartir equitativamente entre asistentes disponibles
      let targetAssigneeId = mayra.id;
      if (assistants.length > 0) {
        const selected = assistants[assistantRoundRobin % assistants.length];
        targetAssigneeId = selected.id;
        assistantRoundRobin++;
      }

      const priority = 'URGENTE';
      const promptUrgency = '¡VENCE HOY!';

      const taskDescription = [
        `Declaración de impuestos SRI correspondiente al período ${periodKey}.`,
        `Régimen: ${t.regimen || 'MENSUAL'} · 9no Dígito: ${noveno}.`,
        `Fecha Límite Legal SRI: ${legalDueDate.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} (${promptUrgency}).`,
        `Obligaciones del cliente: ${[t.checkDecla ? 'DECLA' : '', t.checkIce ? 'ICE' : '', t.checkAnexo ? 'ANEXOS' : ''].filter(Boolean).join(', ') || 'General'}.`,
        `RUC: ${t.ruc} · Dueño: ${t.clientOwner.fullName} (${t.clientOwner.whatsappPhone || 'Sin tel'}).`,
        `⚠️ Recuerda: verificar fondos y conciliación previa. Multa SRI de $60 por declaración omitida.`,
      ].join('\n');

      try {
        const newTask = await prisma.task.create({
          data: {
            title: obligationTitle,
            description: taskDescription,
            priority,
            status: 'PENDIENTE',
            dueDate: legalDueDate,
            createdById: mayra.id,
            assignedToId: targetAssigneeId,
          },
          include: {
            assignedTo: { select: { id: true, fullName: true, username: true } },
            createdBy: { select: { id: true, fullName: true, username: true } },
          },
        });

        createdTasks++;
        details.push({
          taxpayer: t.razonSocial,
          ruc: t.ruc,
          dueDate: legalDueDate.toISOString().split('T')[0],
          action: 'CREATED',
        });

        // 5. Emitir en tiempo real al frontend vía WebSockets para que se refresque en vivo
        if (ioInstance) {
          ioInstance.emit('task:created', {
            task: newTask,
            source: 'SRI_AUTO_CRON',
          });
        }
      } catch (err) {
        console.error(`❌ [SriTaskCronService] Error creando tarea para ${t.razonSocial}:`, err);
        errors++;
      }
    }

    console.log(`✅ [SriTaskCronService] Finalizado: ${createdTasks} tareas creadas, ${skippedExisting} omitidas por idempotencia.`);

    return {
      evaluated: taxpayers.length,
      createdTasks,
      skippedExisting,
      errors,
      details,
    };
  }
}
