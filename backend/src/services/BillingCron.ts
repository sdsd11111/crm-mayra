// backend/src/services/BillingCron.ts
import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { EntryType, BankAccount, BillingFrequency } from '@prisma/client';
import { PdfService } from './PdfService';
import { BunnyStorageService } from './BunnyStorageService';
import { OutboundQueueService } from './bot/outboundQueueService';
import { calculateClientBalance } from '../utils/balanceUtils';
import { SriTaskCronService } from './SriTaskCronService';

export class BillingCron {
  /**
   * Ejecuta la facturación automática para un mes y año específico.
   * Utilizable tanto por el Cron programado como manualmente para pruebas.
   */
  public static async executeBillingRun(referenceDate: Date = new Date()): Promise<{
    processed: number;
    createdEntries: number;
    totalAmount: number;
  }> {
    const currentMonth = referenceDate.getMonth() + 1;
    const currentYear = referenceDate.getFullYear();
    const periodText = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    console.log(`⏰ [BillingCron] Iniciando ciclo de facturación para período ${periodText}...`);

    const taxpayers = await prisma.taxpayer.findMany({
      where: {
        autoBillFreq: { not: BillingFrequency.NONE },
        autoBillAmount: { gt: 0 },
      },
      include: { clientOwner: true },
    });

    let createdEntries = 0;
    let totalAmount = 0;

    for (const t of taxpayers) {
      let shouldBill = false;
      let conceptLabel = '';

      if (t.autoBillFreq === BillingFrequency.MENSUAL) {
        shouldBill = true;
        conceptLabel = `Honorarios Contables Mensuales (${periodText})`;
      } else if (t.autoBillFreq === BillingFrequency.SEMESTRAL) {
        if (currentMonth === 1 || currentMonth === 7) {
          shouldBill = true;
          conceptLabel = `Honorarios Semestrales Semestre ${currentMonth === 1 ? 'I' : 'II'}/${currentYear}`;
        }
      } else if (t.autoBillFreq === BillingFrequency.ANUAL) {
        if (
          (t.regimen === 'COMPANIA_SUPERCIAS' && currentMonth === 4) ||
          (t.regimen !== 'COMPANIA_SUPERCIAS' && currentMonth === 3)
        ) {
          shouldBill = true;
          conceptLabel = `Honorarios Declaración Anual ${currentYear}`;
        }
      }

      // Priorizar servicesBreakdown si existe
      const rawBreakdown = t.servicesBreakdown || t.declaDetalle;
      let servicesList: Array<{ concepto: string; monto: number; freq?: string }> = [];
      if (rawBreakdown && rawBreakdown.trim().startsWith('[') && rawBreakdown.trim().endsWith(']')) {
        try {
          const parsed = JSON.parse(rawBreakdown);
          if (Array.isArray(parsed) && parsed.length > 0) {
            servicesList = parsed
              .filter(s => s && typeof s.concepto === 'string' && Number(s.monto) > 0)
              .map(s => ({
                concepto: String(s.concepto).trim(),
                monto: Number(s.monto),
                freq: s.freq ? String(s.freq).toUpperCase() : undefined,
              }));
          }
        } catch (_) {
          // Si no es JSON válido, usamos el concepto normal
        }
      }

      if (servicesList.length === 0) {
        if (!shouldBill) continue;
        const baseAmount = Number(t.autoBillAmount);
        if (baseAmount > 0) {
          const customConcept = t.declaDetalle && !t.declaDetalle.startsWith('[') ? t.declaDetalle.trim() : conceptLabel;
          servicesList = [{ concepto: `${customConcept} - ${t.razonSocial}`, monto: baseAmount }];
        }
      }

      for (let sIndex = 0; sIndex < servicesList.length; sIndex++) {
        const service = servicesList[sIndex];
        const finalAmount = service.monto;

        // Si el servicio individual tiene su propia frecuencia, evaluar si le toca facturarse este mes
        const effectiveFreq = service.freq || t.autoBillFreq;
        let serviceShouldBill = false;
        if (effectiveFreq === 'MENSUAL') {
          serviceShouldBill = true;
        } else if (effectiveFreq === 'SEMESTRAL') {
          if (currentMonth === 1 || currentMonth === 7) serviceShouldBill = true;
        } else if (effectiveFreq === 'ANUAL') {
          if (
            (t.regimen === 'COMPANIA_SUPERCIAS' && currentMonth === 4) ||
            (t.regimen !== 'COMPANIA_SUPERCIAS' && currentMonth === 3)
          ) {
            serviceShouldBill = true;
          }
        } else if (effectiveFreq === 'NONE') {
          serviceShouldBill = false;
        } else {
          serviceShouldBill = shouldBill;
        }

        if (!serviceShouldBill) continue;

        const fullConcept = service.concepto.includes(t.razonSocial)
          ? `${service.concepto} (${periodText})`
          : `${service.concepto} (${periodText}) - ${t.razonSocial}`;

        // Subíndice de período para idempotencia en MySQL si hay múltiples servicios
        const subPeriodText = servicesList.length > 1 ? `${periodText}-S${sIndex + 1}` : periodText;

        try {
          await prisma.ledgerEntry.create({
            data: {
              clientOwnerId: t.clientOwnerId,
              taxpayerId: t.id,
              entryType: EntryType.CARGO_AUTOMATICO,
              concept: fullConcept,
              periodText: subPeriodText,
              amount: finalAmount,
              bankAccount: BankAccount.NO_APLICA,
            },
          });
          createdEntries++;
          totalAmount += finalAmount;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            console.log(`   ⭕ Cargo ya existe para ${t.razonSocial} (${subPeriodText}). Omitiendo.`);
            continue;
          }
          throw err;
        }
      }
    }

    console.log(
      `✅ [BillingCron] Ciclo finalizado: ${createdEntries} cargos generados por un total de $${totalAmount.toFixed(2)}.`
    );

    return {
      processed: taxpayers.length,
      createdEntries,
      totalAmount: Number(totalAmount.toFixed(2)),
    };
  }

  /**
   * Encola el Estado de Cuenta (PDF) por WhatsApp a todos los clientes con saldo > $0
   * a través de la cola OutboundQueueService (anti-baneo con cadencia 25-55s en horario laboral).
   * Se dispara automáticamente los días 1-5 de cada mes a las 09:00 AM.
   * También puede dispararse manualmente desde el Dashboard.
   */
  public static async executeCollectionRun(): Promise<{ enqueued: number; errors: number }> {
    console.log('📲 [BillingCron] Iniciando encolamiento masivo de cobranza por WhatsApp...');

    // Obtener todos los ClientOwners con saldo pendiente
    const clients = await prisma.clientOwner.findMany({
      where: { whatsappPhone: { not: '' } },
      include: {
        taxpayers: true,
        ledgerEntries: true,
      },
    });

    let enqueued = 0;
    let errors = 0;

    for (const client of clients) {
      // Calcular saldo total usando la fuente única de verdad
      const balance = calculateClientBalance(client.ledgerEntries);

      if (balance <= 0) continue;

      try {
        const monthName = new Date().toLocaleString('es-EC', { month: 'long', year: 'numeric' });
        const textContent =
          `Estimado/a *${client.fullName}*, le saludamos del Estudio Contable Mayra Castillo. 🏢\n\n` +
          `Le adjuntamos su *Estado de Cuenta de ${monthName}*. Su saldo pendiente es de *$${balance.toFixed(2)}*.\n\n` +
          `Para cancelar puede hacerlo a nuestras cuentas bancarias (Pichincha, Banco de Loja o JEP) ` +
          `y enviar el comprobante a este mismo número. ¡Gracias por su confianza! 🙏`;

        // Generar PDF estado de cuenta y subirlo a BunnyStorage
        const pdfBuffer = await PdfService.generateStatement(client.id);
        const fileName = `Estado_Cuenta_${client.fullName.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        const uploadResult = await BunnyStorageService.uploadWhatsappMedia({
          phone: client.whatsappPhone,
          fileName,
          fileBuffer: pdfBuffer,
          contentType: 'application/pdf',
        });

        await OutboundQueueService.enqueue({
          whatsappPhone: client.whatsappPhone,
          jobType: 'COBRANZA_MENSUAL',
          textContent,
          mediaUrl: uploadResult?.bunnyUrl || undefined,
          fileName: `Estado_Cuenta_${client.fullName.replace(/\s+/g, '_')}.pdf`,
        });

        enqueued++;
        console.log(`   📥 Cobranza encolada para ${client.fullName} (${client.whatsappPhone}) — Saldo: $${balance.toFixed(2)}`);
      } catch (err) {
        errors++;
        console.error(`   ❌ Error encolando cobranza para ${client.fullName}:`, err);
      }
    }

    console.log(`📲 [CobranzaCron] Finalizado: ${enqueued} encolados, ${errors} errores.`);
    return { enqueued, errors };
  }

  /**
   * Revisa promesas de pago vencidas/pendientes y envía recordatorios WhatsApp.
   * Cron diario a las 09:00 AM.
   */
  public static async executePromiseReminders(): Promise<{ enqueued: number }> {
    console.log('⏰ [BillingCron] Revisando promesas de pago pendientes para encolar...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const duePromises = await prisma.paymentPromise.findMany({
      where: {
        status: 'PENDIENTE',
        promisedDate: { lte: tomorrow },
      },
      include: {
        clientOwner: true,
      },
    });

    let enqueued = 0;

    for (const promise of duePromises) {
      const client = promise.clientOwner;
      if (!client.whatsappPhone) continue;

      const isPastDue = promise.promisedDate < today;

      const message = isPastDue
        ? `Hola *${client.fullName}*, le saludamos del Estudio Contable Mayra Castillo. 👋\n\n` +
          `Le recordamos que tenía un compromiso de pago pendiente con nosotros. ` +
          `¿Pudo realizar el depósito/transferencia? Por favor envíenos el comprobante cuando pueda. 🙏\n\n` +
          `Nuestras cuentas: Banco Pichincha, Banco de Loja o Cooperativa JEP.`
        : `Hola *${client.fullName}*, le saludamos del Estudio Contable Mayra Castillo. 📅\n\n` +
          `Le recordamos que hoy es la fecha acordada para su pago pendiente. ` +
          `Puede realizar el depósito a nuestras cuentas bancarias y enviarnos el comprobante. ¡Gracias! 💙`;

      try {
        await OutboundQueueService.enqueue({
          whatsappPhone: client.whatsappPhone,
          jobType: 'PROMESA_HOY',
          textContent: message,
        });

        if (isPastDue) {
          await prisma.paymentPromise.update({
            where: { id: promise.id },
            data: { status: 'VENCIDA' },
          });
        }

        enqueued++;
        console.log(`   📱 Recordatorio de promesa encolado para ${client.fullName}`);
      } catch (err) {
        console.error(`   ❌ Error encolando recordatorio a ${client.fullName}:`, err);
      }
    }

    console.log(`⏰ [PromisesReminder] Finalizado: ${enqueued} promesas encoladas.`);
    return { enqueued };
  }

  public static async checkFirmaExpiry(): Promise<{ enqueued: number }> {
    console.log('🔑 [BillingCron] Verificando firmas electrónicas por expirar a 30 días para retención y venta...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const alertThreshold = new Date(today);
    alertThreshold.setDate(alertThreshold.getDate() + 30); // 30 días como exige Mayra

    const expiringTaxpayers = await prisma.taxpayer.findMany({
      where: {
        firmaExpira: {
          gte: today,
          lte: alertThreshold,
        },
      },
      include: {
        clientOwner: true,
      },
    });

    let enqueued = 0;

    for (const taxpayer of expiringTaxpayers) {
      const client = taxpayer.clientOwner;
      if (!client.whatsappPhone) continue;

      const daysLeft = Math.ceil(
        (taxpayer.firmaExpira!.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Activar sesión conversacional para captura interactiva guiada
      await prisma.botSession.upsert({
        where: { whatsappPhone: client.whatsappPhone },
        update: {
          currentFlow: 'FIRMA_STEPS',
          flowData: {
            taxpayerId: taxpayer.id,
            razonSocial: taxpayer.razonSocial,
            daysLeft,
            step: 'OFERTA_ENVIADA',
            startedAt: new Date().toISOString(),
          },
        },
        create: {
          whatsappPhone: client.whatsappPhone,
          currentFlow: 'FIRMA_STEPS',
          flowData: {
            taxpayerId: taxpayer.id,
            razonSocial: taxpayer.razonSocial,
            daysLeft,
            step: 'OFERTA_ENVIADA',
            startedAt: new Date().toISOString(),
          },
        },
      });

      const message =
        `🔐 *Aviso Preventivo de Firma Electrónica* — Estudio Contable Mayra Castillo\n\n` +
        `Estimado/a *${client.fullName}*, le informamos que la firma electrónica (.p12) de *${taxpayer.razonSocial}* caduca en *${daysLeft} días* (${taxpayer.firmaExpira!.toLocaleDateString('es-EC')}).\n\n` +
        `Como somos *distribuidores autorizados de firmas electrónicas*, podemos gestionar su renovación de inmediato para evitar bloqueos en la emisión de sus facturas del SRI.\n\n` +
        `¿Desea que gestionemos su renovación ahora mismo? Responda *SÍ* y le indicaremos los planes y requisitos según sea Persona Natural o Empresa. ✍️`;

      try {
        await OutboundQueueService.enqueue({
          whatsappPhone: client.whatsappPhone,
          jobType: 'FIRMA_CADUCA',
          textContent: message,
        });
        enqueued++;
        console.log(`   🔑 Alerta y flujo de firma a 30 días encolada para ${client.fullName} — ${taxpayer.razonSocial} (${daysLeft} días)`);
      } catch (err) {
        console.error(`   ❌ Error encolando alerta firma a ${client.fullName}:`, err);
      }
    }

    console.log(`🔑 [FirmaExpiry] Finalizado: ${enqueued} alertas preventivas a 30 días encoladas.`);
    return { enqueued };
  }

  public static init(): void {
    // Iniciar worker de la cola anti-baneo persistente
    OutboundQueueService.startWorker();

    // 1. Facturación automática: Día 1 de cada mes a las 00:05 AM
    cron.schedule('5 0 1 * *', async () => {
      try {
        await this.executeBillingRun();
      } catch (err) {
        console.error('❌ Error ejecutando BillingCron:', err);
      }
    });

    // 2. Cobranza masiva WhatsApp: Días 1 al 5 de cada mes a las 09:00 AM
    cron.schedule('0 9 1-5 * *', async () => {
      try {
        await this.executeCollectionRun();
      } catch (err) {
        console.error('❌ Error ejecutando CobranzaCron:', err);
      }
    });

    // 3. Recordatorios de promesas de pago: Diario a las 09:00 AM
    cron.schedule('0 9 * * *', async () => {
      try {
        await this.executePromiseReminders();
      } catch (err) {
        console.error('❌ Error ejecutando PromisesReminder:', err);
      }
    });

    // 5. Recordatorios de cargos recurrentes manuales: Diario a las 09:05 AM
    cron.schedule('5 9 * * *', async () => {
      try {
        await this.executeRecurringChargeReminders();
      } catch (err) {
        console.error('❌ Error ejecutando RecurringChargesReminder:', err);
      }
    });

    // 4. Alertas de firma electrónica por expirar: Diario a las 08:00 AM
    cron.schedule('0 8 * * *', async () => {
      try {
        await this.checkFirmaExpiry();
      } catch (err) {
        console.error('❌ Error ejecutando FirmaExpiryCron:', err);
      }
    });

    // 5. Generador Automático de Tareas SRI (Regla Días Pares / 1 día antes): Diario a las 08:00 AM
    cron.schedule('0 8 * * *', async () => {
      try {
        console.log('⏰ [Cron 08:00 AM] Ejecutando generador de tareas SRI automáticas...');
        await SriTaskCronService.generateDailySriTasks();
      } catch (err) {
        console.error('❌ Error ejecutando SriTaskCron:', err);
      }
    });

    console.log('⏰ BillingCron iniciado con 6 jobs programados:');
    console.log('   📋 Facturación automática: Día 1 de mes a las 00:05 AM');
    console.log('   📲 Cobranza WhatsApp: Días 1-5 de mes a las 09:00 AM');
    console.log('   📅 Recordatorio promesas: Diario a las 09:00 AM');
    console.log('   🔁 Recordatorio cargos recurrentes: Diario a las 09:05 AM');
    console.log('   🔑 Alerta firmas .p12: Diario a las 08:00 AM');
    console.log('   ⚡ Tareas SRI (Días Pares / Anticipación): Diario a las 08:00 AM');
  }

  /**
   * Revisa LedgerEntries con recurringFreq activo cuya nextChargeDate ya llegó,
   * crea una Task de recordatorio para Mayra y avanza la nextChargeDate al siguiente período.
   */
  public static async executeRecurringChargeReminders(): Promise<{ reminded: number }> {
    console.log('🔁 [BillingCron] Revisando cargos recurrentes pendientes...');
    const now = new Date();
    let reminded = 0;

    // Buscar el usuario ADMIN_MAYRA para asignarle la Task
    const mayra = await prisma.user.findFirst({ where: { role: 'ADMIN_MAYRA' } });
    if (!mayra) {
      console.warn('⚠️ [RecurringCharges] No se encontró usuario ADMIN_MAYRA para asignar tareas.');
      return { reminded: 0 };
    }

    const dueEntries = await prisma.ledgerEntry.findMany({
      where: {
        recurringFreq: { not: null },
        nextChargeDate: { lte: now },
        entryType: 'CARGO_MANUAL',
      },
      include: {
        clientOwner: { select: { id: true, fullName: true } },
      },
    });

    for (const entry of dueEntries) {
      try {
        // Crear Task de recordatorio
        await prisma.task.create({
          data: {
            title: `💳 Cargo recurrente: ${entry.concept}`,
            description: `Recordatorio automático: aplicar cargo "${entry.concept}" por $${Number(entry.amount).toFixed(2)} al cliente "${entry.clientOwner.fullName}" (recurrencia: ${entry.recurringFreq}).`,
            dueDate: entry.nextChargeDate,
            status: 'PENDIENTE',
            createdById: mayra.id,
            assignedToId: mayra.id,
          },
        });

        // Calcular la siguiente nextChargeDate
        const base = entry.nextChargeDate ? new Date(entry.nextChargeDate) : new Date();
        if (entry.recurringFreq === 'MENSUAL') base.setMonth(base.getMonth() + 1);
        else if (entry.recurringFreq === 'SEMESTRAL') base.setMonth(base.getMonth() + 6);
        else if (entry.recurringFreq === 'ANUAL') base.setFullYear(base.getFullYear() + 1);

        await prisma.ledgerEntry.update({
          where: { id: entry.id },
          data: { nextChargeDate: base },
        });

        reminded++;
        console.log(`   🔁 Recordatorio creado para "${entry.clientOwner.fullName}" — ${entry.concept}`);
      } catch (err) {
        console.error(`   ❌ Error procesando cargo recurrente id=${entry.id}:`, err);
      }
    }

    console.log(`🔁 [RecurringCharges] Finalizado: ${reminded} recordatorios creados.`);
    return { reminded };
  }
}
