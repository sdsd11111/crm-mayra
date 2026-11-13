// backend/src/services/bot/botOrchestrator.ts
import { DebounceQueueSkill } from './skills/debounceQueueSkill';
import { ClientLookupSkill } from './skills/clientLookupSkill';
import { SlidingMemorySkill } from './skills/slidingMemorySkill';
import { ReasonerLlmSkill } from './skills/reasonerLlmSkill';
import { HumanBubbleSkill } from './skills/humanBubbleSkill';
import { CallCenterDispatcherSkill } from './skills/callCenterDispatcherSkill';
import { EvolutionApiService } from '../EvolutionApiService';
import { prisma } from '../../lib/prisma';

export interface IncomingBotMessage {
  fromPhone: string;
  senderName?: string;
  messageText: string;
  mediaInfo?: {
    mediaType: string;
    mediaUrl: string;
    fileName: string;
    mimeType: string;
  };
}

export class BotOrchestrator {
  /**
   * Orquesta la llegada de un mensaje con arquitectura de skills y buffer de 10s
   */
  public static async processMessage(msg: IncomingBotMessage): Promise<{
    handled: boolean;
    replyText: string;
    queue: string;
  }> {
    const rawPhone = msg.fromPhone.replace(/\D/g, '');

    // 1. Buffer de coalescencia humana: 10 segundos para acumular líneas seguidas
    const consolidatedText = await DebounceQueueSkill.enqueueMessage(rawPhone, msg.messageText);

    // 2. Skill de Búsqueda y Registro Automático de Clientes
    const { client, isNewClient } = await ClientLookupSkill.identifyClient(rawPhone, msg.senderName);

    // 3. Skill de Memoria Deslizante (10 mensajes + resumen acumulado)
    const { summary, recentMessages } = await SlidingMemorySkill.getMemory(rawPhone);

    // 4. Obtener o crear ticket inicial para contexto de ejecución
    const existingTicket = await prisma.chatTicket.findFirst({
      where: { whatsappPhone: rawPhone },
      orderBy: { updatedAt: 'desc' },
    });

    let currentTicketId = existingTicket?.id;
    if (!currentTicketId) {
      const createdT = await prisma.chatTicket.create({
        data: {
          whatsappPhone: rawPhone,
          clientOwnerId: client?.id || null,
          queueType: 'OPERATIVA_CHICAS',
          subject: `Chat - ${client?.fullName || msg.senderName || 'Cliente WhatsApp'}`,
          status: 'ABIERTO',
        },
      });
      currentTicketId = createdT.id;
    }

    // 5. Skill Razonadora (LLM DeepSeek estructurado con Function Calling nativo)
    const turnResult = await ReasonerLlmSkill.executeTurn({
      incomingText: consolidatedText,
      summary,
      recentMessages,
      clientProfile: client,
      phone: rawPhone,
      ticketId: currentTicketId,
    });

    // 6. Skill de Despacho Call Center & WebSocket a las pantallas del CRM
    const ticketId = await CallCenterDispatcherSkill.dispatchTicket({
      clientPhone: rawPhone,
      clientName: client?.fullName || msg.senderName || 'Cliente WhatsApp',
      clientOwnerId: client?.id,
      taxpayerId: turnResult.identifiedTaxpayerId,
      queue: turnResult.targetQueue,
      incomingText: consolidatedText,
      responseText: turnResult.replyText,
      isEscalated: turnResult.requiresHuman,
      escalationReason: turnResult.humanReason,
    });

    // 7. Regla VIP: Alerta personal si es cliente VIP fuera de horario
    if (client && (client as any).isVip) {
      const ecHour = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })).getHours();
      const isOutsideHours = ecHour < 8 || ecHour >= 19;
      const personalPhone = process.env.MAYRA_PERSONAL_PHONE;
      if (isOutsideHours && personalPhone) {
        EvolutionApiService.sendTextMessage({
          number: personalPhone,
          text: `⭐ *ALERTA CLIENTE VIP*: El cliente VIP *${client.fullName}* ha escrito fuera de horario: "${consolidatedText}".`,
        }).catch(() => {});
      }
    }

    // 8. Actualizar resumen semántico de memoria si excede los 10 mensajes
    await SlidingMemorySkill.updateSummaryIfNeeded(
      ticketId,
      summary,
      recentMessages.length + 2,
      (text) => ReasonerLlmSkill.compressHistory(text)
    );

    // 9. Skill de Burbujas Humanas: dividir respuesta en mensajes naturales espaciados
    const bubbles = HumanBubbleSkill.splitBubbles(turnResult.replyText);

    for (let i = 0; i < bubbles.length; i++) {
      if (i > 0 && process.env.BOT_DEBOUNCE_MS === undefined) {
        // Pausa de 1.2s entre burbujas para simular escritura humana (solo en producción)
        await new Promise((r) => setTimeout(r, 1200));
      }
      const sendRes = await EvolutionApiService.sendTextMessage({
        number: rawPhone,
        text: bubbles[i],
      });

      // Registrar messageId de salida del bot para evitar auto-sabotaje por eco de fromMe
      const sentMsgId = (sendRes?.data as any)?.key?.id;
      if (sentMsgId) {
        await prisma.processedWebhookEvent.create({
          data: { messageId: sentMsgId },
        }).catch(() => {});
      }
    }

    return {
      handled: true,
      replyText: turnResult.replyText,
      queue: turnResult.targetQueue,
    };
  }
}
