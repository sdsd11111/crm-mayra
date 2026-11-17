// backend/src/services/bot/tools/botToolsRegistry.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { EvolutionApiService } from '../../EvolutionApiService';
import { calculateClientBalance } from '../../../utils/balanceUtils';
import { io } from '../../../index';

export interface ToolExecutionContext {
  phone: string;
  clientOwnerId?: number;
  ticketId: number;
}

export class BotToolsRegistry {
  /**
   * 1. verify_security_pin: Valida en código TS duro y actualiza BotSession por 15 min
   */
  public static async verifySecurityPin(
    ctx: ToolExecutionContext,
    args: { pin: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!ctx.clientOwnerId) {
      return { success: false, message: 'El número no corresponde a un cliente con PIN configurado.' };
    }

    const client = await prisma.clientOwner.findUnique({
      where: { id: ctx.clientOwnerId },
      select: { securityPin: true },
    });

    const cleanInput = String(args.pin || '').trim();
    if (!client?.securityPin || client.securityPin !== cleanInput) {
      return { success: false, message: 'PIN de seguridad incorrecto.' };
    }

    const validUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await prisma.botSession.upsert({
      where: { whatsappPhone: ctx.phone },
      update: { pinVerifiedUntil: validUntil, lastInteractionAt: new Date() },
      create: { whatsappPhone: ctx.phone, pinVerifiedUntil: validUntil },
    });

    return {
      success: true,
      message: 'PIN verificado con éxito. Acceso seguro autorizado por los próximos 15 minutos.',
    };
  }

  /**
   * 2. send_client_document: Busca en Document. Exige PIN en código si es sensible.
   */
  public static async sendClientDocument(
    ctx: ToolExecutionContext,
    args: { ruc?: string; category: string; year?: number; month?: number }
  ): Promise<{ success: boolean; message: string }> {
    // Escudo de seguridad en código TS para firmas y claves
    const isSensitive =
      args.category === 'FIRMA_ELECTRONICA_P12' ||
      args.category.includes('CLAVE') ||
      args.category.includes('PASSWORD');

    if (isSensitive) {
      const session = await prisma.botSession.findUnique({
        where: { whatsappPhone: ctx.phone },
      });

      const now = new Date();
      if (!session?.pinVerifiedUntil || session.pinVerifiedUntil < now) {
        return {
          success: false,
          message: 'PIN_REQUIRED: Para acceder a documentos o firmas con claves confidenciales, debe ingresar primero su PIN de seguridad de 4 dígitos.',
        };
      }
    }

    const whereDoc: any = {};
    if (args.category) whereDoc.category = args.category;
    if (args.year) whereDoc.periodYear = Number(args.year);
    if (args.month) whereDoc.periodMonth = Number(args.month);

    if (args.ruc) {
      if (!ctx.clientOwnerId) {
        return { success: false, message: 'Operación no permitida para usuarios no registrados.' };
      }
      const tp = await prisma.taxpayer.findFirst({
        where: {
          ruc: args.ruc,
          clientOwnerId: ctx.clientOwnerId, // ESCUDO ESTRICTO MULTI-TENANT
        },
      });
      if (tp) {
        whereDoc.taxpayerId = tp.id;
      } else {
        return {
          success: false,
          message: 'No posee ninguna empresa asociada a su cuenta con el RUC indicado.',
        };
      }
    } else if (ctx.clientOwnerId) {
      const taxpayers = await prisma.taxpayer.findMany({
        where: { clientOwnerId: ctx.clientOwnerId },
        select: { id: true },
      });
      whereDoc.taxpayerId = { in: taxpayers.map(t => t.id) };
    } else {
      return { success: false, message: 'Operación no autorizada.' };
    }

    const doc = await prisma.document.findFirst({
      where: whereDoc,
      orderBy: { createdAt: 'desc' },
    });

    if (doc) {
      // Envía el enlace seguro del documento
      await EvolutionApiService.sendTextMessage({
        number: ctx.phone,
        text: `📄 Aquí tiene su documento oficial: *${doc.title}*\n${doc.bunnyUrl}`,
      });
      return { success: true, message: `Documento "${doc.title}" enviado al cliente por WhatsApp.` };
    }

    // Si no existe, enruta a las asistentes para que lo carguen
    await prisma.chatTicket.update({
      where: { id: ctx.ticketId },
      data: { queueType: 'OPERATIVA_CHICAS' },
    });

    return {
      success: false,
      message: `El documento solicitado (${args.category}) aún no consta en el sistema. Se ha notificado al equipo de asistentes para que lo elaboren o carguen.`,
    };
  }

  /**
   * 3. get_account_balance_and_banks: Consulta saldo exacto y cuentas bancarias oficiales
   */
  public static async getAccountBalanceAndBanks(
    ctx: ToolExecutionContext
  ): Promise<{ saldoPendiente: number; banks: string; message: string }> {
    if (!ctx.clientOwnerId) {
      return {
        saldoPendiente: 0,
        banks: 'Pichincha, Banco de Loja, Cooperativa JEP',
        message: 'No posee una ficha de cliente activa. Para consultas de honorarios se le derivará con Mayra Castillo.',
      };
    }

    const entries = await prisma.ledgerEntry.findMany({
      where: { clientOwnerId: ctx.clientOwnerId },
    });

    const balance = calculateClientBalance(entries);

    const bankDetails = `
*Cuentas Autorizadas para Transferencias:*
• *Banco Pichincha* (Cta. Corriente / Ahorros)
• *Banco de Loja*
• *Cooperativa JEP*
• *Efectivo / Caja* en oficina
_Por favor enviar el comprobante con la referencia para conciliar en su estado de cuenta._
`.trim();

    return {
      saldoPendiente: balance,
      banks: bankDetails,
      message: `Saldo pendiente total: $${balance.toFixed(2)}.`,
    };
  }

  /**
   * 4. register_payment_promise: Registra la fecha comprometida de pago
   */
  public static async registerPaymentPromise(
    ctx: ToolExecutionContext,
    args: { promisedDate: string; amount?: number; notes?: string }
  ): Promise<{ success: boolean; message: string }> {
    if (!ctx.clientOwnerId) {
      return { success: false, message: 'Solo clientes registrados pueden asentar promesas de pago.' };
    }

    const pDate = new Date(args.promisedDate);
    await prisma.paymentPromise.create({
      data: {
        clientOwnerId: ctx.clientOwnerId,
        promisedDate: isNaN(pDate.getTime()) ? new Date(Date.now() + 3 * 24 * 3600 * 1000) : pDate,
        promisedAmount: args.amount ? args.amount : null,
        notes: args.notes || 'Registrado por el Bot de WhatsApp',
        status: 'PENDIENTE',
      },
    });

    return {
      success: true,
      message: `Promesa de pago agendada para el ${pDate.toLocaleDateString('es-EC')}.`,
    };
  }

  /**
   * 5. save_firma_electronica_step: Guarda avance en BotSession.flowData en MySQL
   */
  public static async saveFirmaElectronicaStep(
    ctx: ToolExecutionContext,
    args: { hasRuc?: boolean; years?: number; stepCompleted: string; notes?: string }
  ): Promise<{ success: boolean; message: string }> {
    const session = await prisma.botSession.upsert({
      where: { whatsappPhone: ctx.phone },
      update: { currentFlow: 'FIRMA_STEPS', lastInteractionAt: new Date() },
      create: { whatsappPhone: ctx.phone, currentFlow: 'FIRMA_STEPS' },
    });

    const currentData: any = session.flowData ? session.flowData : {};
    currentData[args.stepCompleted] = {
      completedAt: new Date().toISOString(),
      notes: args.notes || null,
      hasRuc: args.hasRuc,
      years: args.years,
    };

    await prisma.botSession.update({
      where: { id: session.id },
      data: { flowData: currentData },
    });

    if (args.stepCompleted === 'DATOS_COMPLETOS' || args.stepCompleted === 'PAGO_CONFIRMADO') {
      // Notificar y transferir a Mayra para validación de cobro y a las asistentes para la emisión
      await prisma.chatTicket.update({
        where: { id: ctx.ticketId },
        data: {
          queueType: 'GERENCIAL_MAYRA',
          botPaused: true,
        },
      });

      // Crear Task de alta prioridad para Mayra
      const mayraUser = await prisma.user.findFirst({ where: { role: 'ADMIN_MAYRA' } });
      if (mayraUser) {
        await prisma.task.create({
          data: {
            title: `🔐 Firma Electrónica por Emitir: ${currentData?.razonSocial || 'Cliente'}`,
            description: `El cliente ha completado los requisitos de firma electrónica y envió confirmación de pago por WhatsApp. Validar acreditación bancaria y autorizar emisión a las asistentes. Tel: ${ctx.phone}`,
            dueDate: new Date(),
            status: 'PENDIENTE',
            createdById: mayraUser.id,
            assignedToId: mayraUser.id,
          },
        }).catch(() => {});
      }

      if (io) {
        io.emit('whatsapp:new-message', {
          ticketId: ctx.ticketId,
          queue: 'GERENCIAL_MAYRA',
          clientPhone: ctx.phone,
          isEscalated: true,
          escalationReason: `Requisitos de firma completados y pago enviado. Requiere validación de Mayra.`,
        });
      }
    }

    return {
      success: true,
      message: `Paso de firma electrónica registrado: ${args.stepCompleted}.`,
    };
  }

  /**
   * 6. transfer_to_human: Cambia la cola, activa botPaused y emite WebSocket
   */
  public static async transferToHuman(
    ctx: ToolExecutionContext,
    args: { queue: 'OPERATIVA_CHICAS' | 'GERENCIAL_MAYRA'; summary: string }
  ): Promise<{ success: boolean; message: string }> {
    const updated = await prisma.chatTicket.update({
      where: { id: ctx.ticketId },
      data: {
        queueType: args.queue,
        botPaused: true,
      },
    });

    if (io) {
      io.emit('whatsapp:new-message', {
        ticketId: updated.id,
        queue: updated.queueType,
        clientPhone: ctx.phone,
        isEscalated: true,
        escalationReason: args.summary,
      });
    }

    return {
      success: true,
      message: `Conversación transferida a ${args.queue}. Bot pausado para atención humana.`,
    };
  }

  /**
   * 7. reset_active_flow: Marca el trámite como no deseado o completado y vuelve a IDLE sin pausar el bot
   */
  public static async resetActiveFlow(
    ctx: ToolExecutionContext
  ): Promise<{ success: boolean; message: string }> {
    const existing = await prisma.botSession.findUnique({
      where: { whatsappPhone: ctx.phone },
    });

    const currentData: any = existing?.flowData ? { ...(existing.flowData as any) } : {};
    currentData.rejectedAt = new Date().toISOString();
    currentData.status = 'RECHAZADO_POR_CLIENTE';

    await prisma.botSession.upsert({
      where: { whatsappPhone: ctx.phone },
      update: {
        currentFlow: 'IDLE',
        flowData: currentData,
        lastInteractionAt: new Date(),
      },
      create: {
        whatsappPhone: ctx.phone,
        currentFlow: 'IDLE',
        flowData: currentData,
      },
    });

    return {
      success: true,
      message: 'Flujo de renovación cerrado como rechazado por el cliente. Estado del bot en reposo.',
    };
  }
}

