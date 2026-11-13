// backend/src/services/bot/skills/callCenterDispatcherSkill.ts
import { prisma } from '../../../lib/prisma';
import { io } from '../../../index';
import { CallCenterQueue } from '../types';

export class CallCenterDispatcherSkill {
  /**
   * Crea o actualiza el Ticket en la base de datos y emite el WebSocket al CRM
   */
  public static async dispatchTicket({
    clientPhone,
    clientName,
    clientOwnerId,
    taxpayerId,
    queue,
    incomingText,
    responseText,
    mediaInfo,
    isEscalated,
    escalationReason,
  }: {
    clientPhone: string;
    clientName: string;
    clientOwnerId?: number;
    taxpayerId?: number;
    queue: CallCenterQueue;
    incomingText: string;
    responseText?: string;
    mediaInfo?: {
      mediaType: string;
      mediaUrl: string;
      fileName: string;
      mimeType: string;
    };
    isEscalated?: boolean;
    escalationReason?: string;
  }): Promise<number> {
    const cleanPhone = clientPhone.replace(/\D/g, '');

    // Buscar ticket abierto existente
    let ticket = await prisma.chatTicket.findFirst({
      where: {
        whatsappPhone: cleanPhone,
        status: { in: ['OPEN', 'ABIERTO', 'PENDING'] },
      },
    });

    if (!ticket) {
      ticket = await prisma.chatTicket.create({
        data: {
          whatsappPhone: cleanPhone,
          clientOwnerId: clientOwnerId || null,
          queueType: queue,
          subject: `Chat Call Center - ${clientName || 'Cliente'}`,
          status: 'ABIERTO',
        },
      });
    } else {
      // Actualizar cola y estado
      ticket = await prisma.chatTicket.update({
        where: { id: ticket.id },
        data: {
          queueType: queue,
          status: isEscalated ? 'ABIERTO' : ticket.status,
        },
      });
    }

    // 1. Guardar mensaje del cliente
    const clientMsg = await prisma.chatMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'CLIENT',
        senderType: 'CLIENT',
        content: incomingText,
        mediaType: mediaInfo?.mediaType || null,
        mediaUrl: mediaInfo?.mediaUrl || null,
        mimeType: mediaInfo?.mimeType || null,
        fileName: mediaInfo?.fileName || null,
      },
    });

    // 2. Si el bot respondió, guardar su mensaje
    let botMsg = null;
    if (responseText) {
      botMsg = await prisma.chatMessage.create({
        data: {
          ticketId: ticket.id,
          sender: 'BOT',
          senderType: 'BOT',
          content: responseText,
        },
      });
    }

    // 3. Emitir WebSocket en tiempo real para Mayra y las asistentes
    if (io) {
      io.emit('whatsapp:new-message', {
        ticketId: ticket.id,
        queue: ticket.queueType,
        clientPhone: cleanPhone,
        clientName: clientName || 'Cliente',
        message: clientMsg,
        botReply: botMsg,
        isEscalated,
        escalationReason,
      });
    }

    return ticket.id;
  }
}
