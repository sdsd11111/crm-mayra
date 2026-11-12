// backend/src/services/bot/outboundQueueService.ts
import { prisma } from '../../lib/prisma';
import { EvolutionApiService } from '../EvolutionApiService';

export class OutboundQueueService {
  private static isRunning = false;
  private static workerInterval: NodeJS.Timeout | null = null;

  /**
   * Encola un nuevo trabajo de salida persistente en MySQL
   */
  public static async enqueue({
    whatsappPhone,
    jobType,
    textContent,
    mediaUrl,
    fileName,
    scheduledFor,
  }: {
    whatsappPhone: string;
    jobType: 'COBRANZA_MENSUAL' | 'PROMESA_HOY' | 'FIRMA_CADUCA' | 'PROYECCION_RENTA';
    textContent: string;
    mediaUrl?: string;
    fileName?: string;
    scheduledFor?: Date;
  }): Promise<number> {
    const cleanPhone = whatsappPhone.replace(/\D/g, '');
    const job = await prisma.outboundQueueJob.create({
      data: {
        whatsappPhone: cleanPhone,
        jobType,
        textContent,
        mediaUrl,
        fileName,
        scheduledFor: scheduledFor || new Date(),
        status: 'PENDIENTE',
      },
    });

    // Iniciar el worker si está dormido
    this.startWorker();
    return job.id;
  }

  /**
   * Retorna el conteo actual de trabajos pendientes para la barra superior del CRM
   */
  public static async getQueueStatus(): Promise<{ pendingCount: number; processingCount: number; sentTodayCount: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [pending, processing, sentToday] = await Promise.all([
      prisma.outboundQueueJob.count({ where: { status: 'PENDING' } }),
      prisma.outboundQueueJob.count({ where: { status: 'PROCESSING' } }),
      prisma.outboundQueueJob.count({
        where: {
          status: 'SENT',
          sentAt: { gte: today },
        },
      }),
    ]);

    return {
      pendingCount: pending,
      processingCount: processing,
      sentTodayCount: sentToday,
    };
  }

  /**
   * Verifica si la hora actual en Ecuador está en el rango hábil permitido (08:30 a 19:00, Lunes a Sábado)
   */
  public static isWithinAllowedSchedule(): boolean {
    const ecString = new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' });
    const ecDate = new Date(ecString);
    const day = ecDate.getDay(); // 0 = Domingo, 6 = Sábado
    if (day === 0) return false; // Domingo cerrado

    const hour = ecDate.getHours();
    const minute = ecDate.getMinutes();
    const timeVal = hour + minute / 60;

    return timeVal >= 8.5 && timeVal <= 19.0;
  }

  /**
   * Genera delay aleatorio entre 25 y 55 segundos
   */
  private static getRandomAntiBanDelayMs(): number {
    const min = 25000;
    const max = 55000;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Inicia el ciclo del worker
   */
  public static startWorker(): void {
    if (this.workerInterval) return;

    this.workerInterval = setInterval(async () => {
      if (this.isRunning) return;

      // 1. Respetar ventana de horario hábil en Ecuador
      if (!this.isWithinAllowedSchedule()) {
        return;
      }

      this.isRunning = true;
      try {
        await this.processNextJob();
      } catch (err) {
        console.error('[OutboundQueueService] Error procesando job:', err);
      } finally {
        this.isRunning = false;
      }
    }, 10000); // Revisa cada 10s si hay jobs pendientes
  }

  /**
   * Procesa exactamente 1 solo job a la vez con delay humano
   */
  private static async processNextJob(): Promise<void> {
    const now = new Date();

    const nextJob = await prisma.outboundQueueJob.findFirst({
      where: {
        status: 'PENDING',
        scheduledFor: { lte: now },
        attempts: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextJob) return;

    // Marcar como en proceso
    await prisma.outboundQueueJob.update({
      where: { id: nextJob.id },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });

    try {
      // 1. Simular presencia escribiendo por 2 segundos
      await new Promise(r => setTimeout(r, 2000));

      let sendResult: any = null;

      // 2. Si tiene documento/media o si es solo texto
      if (nextJob.mediaUrl) {
        sendResult = await EvolutionApiService.sendMediaUrl({
          number: nextJob.whatsappPhone,
          mediaUrl: nextJob.mediaUrl,
          caption: nextJob.textContent,
          fileName: nextJob.fileName || 'documento.pdf',
        });
      } else {
        sendResult = await EvolutionApiService.sendTextMessage({
          number: nextJob.whatsappPhone,
          text: nextJob.textContent,
        });
      }

      // 3. REGISTRO OBLIGATORIO: Guardar evolutionMessageId para que el escudo fromMe NO auto-pause el bot
      const sentMessageId = sendResult?.data?.key?.id;
      if (sentMessageId) {
        await prisma.processedWebhookEvent.create({
          data: { messageId: sentMessageId },
        }).catch(() => {});
      }

      // 4. Buscar o crear ticket para reflejar el envío en el CRM
      const ticket = await prisma.chatTicket.findFirst({
        where: { whatsappPhone: nextJob.whatsappPhone },
        orderBy: { updatedAt: 'desc' },
      });

      if (ticket) {
        await prisma.chatMessage.create({
          data: {
            ticketId: ticket.id,
            sender: 'BOT',
            senderType: 'BOT',
            evolutionMessageId: sentMessageId || null,
            content: nextJob.textContent,
            mediaUrl: nextJob.mediaUrl,
            fileName: nextJob.fileName,
          },
        });
      }

      // 5. Marcar como completado
      await prisma.outboundQueueJob.update({
        where: { id: nextJob.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });

      console.log(`✅ [OutboundQueue] Job #${nextJob.id} enviado exitosamente a +${nextJob.whatsappPhone}.`);

      // 6. Pausa aleatoria anti-baneo de 25 a 55 segundos antes del siguiente
      const delay = this.getRandomAntiBanDelayMs();
      console.log(`⏱️ [OutboundQueue] Esperando ${Math.round(delay / 1000)}s para proteger el chip...`);
      await new Promise(r => setTimeout(r, delay));

    } catch (error: any) {
      console.error(`❌ [OutboundQueue] Error enviando job #${nextJob.id}:`, error.message);
      await prisma.outboundQueueJob.update({
        where: { id: nextJob.id },
        data: {
          status: nextJob.attempts >= 2 ? 'FAILED' : 'PENDING',
          lastError: error.message || 'Error desconocido',
        },
      });
    }
  }
}

